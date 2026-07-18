/**
 * importWorker.ts — async ingestion worker (#5, #11)
 *
 * Очередь задач реализована через setImmediate (zero-dependency, no Redis needed).
 * Каждая задача выполняется вне HTTP request-response цикла.
 * Batch insert выполняется в db.transaction() чанками по 500 записей (#11).
 *
 * Pipeline: parse → validate (#9) → normalize (#10) → persist / DLQ (#8)
 * Импорт считается успешным, если валидных круга >= VALID_LAP_THRESHOLD_PCT% (#8).
 * Файлы с 0 кругами пропускаются: счётчик skipped++, статус "skipped" (ZERO_LAPS).
 * Структурированное логирование JSON через server/logger.ts (#12).
 *
 * runImport() экспортирован для прямого вызова из routes.ts (синхронный импорт).
 * Внутренняя очередь (queue / processNext) остаётся без изменений.
 */
import crypto from "node:crypto";
import { db } from "./storage";
import {
  importJobs, importErrors, sessions, lapTimes, sessionResults,
  sessionLaps, sessionIncidents, sessionSectorBests, sessionTrackLimits,
  tracks, drivers,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { parseRaceResults, type ParsedSession } from "./logParser";
import { validateLapTime } from "@shared/validators";
import { normalizeLapTime, normalizeDriverNameForStorage, normalizeTrackName, toMilliseconds } from "./normalizer";
import type { Track, Driver } from "@shared/schema";
import {
  logImportStarted,
  logImportCompleted,
  logImportFailed,
  logImportSkipped,
  logParseError,
} from "./logger";

export const CHUNK_SIZE = 500;

/** Минимальный процент валидных кругов для успешного импорта (#8) */
export const VALID_LAP_THRESHOLD_PCT = 80;

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "skipped";

export interface ImportJobPayload {
  id: string;
  fileHash: string;
  fileName: string;
  content: string;
}

// Простая in-process очередь задач

const queue: ImportJobPayload[] = [];
let running = false;

/** Генерация id задачи (без внешних зависимостей) */
export function generateId(): string {
  return crypto.randomBytes(12).toString("hex");
}

/** SHA-256 хэш содержимого файла (#6) */
export function computeFileHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Поставить задачу импорта в очередь.
 * Возвращает importId.
 * Если файл уже импортирован — выбрасывает DuplicateFileError.
 */
export async function enqueueImport(fileName: string, content: string): Promise<string> {
  const fileHash = computeFileHash(content);

  // Idempotency check (#6): проверяем UNIQUE file_hash
  const existingRows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.fileHash, fileHash));
  const existing = existingRows[0];

  if (existing) {
    const err = new Error("Файл уже был импортирован");
    (err as any).code = "DUPLICATE_FILE";
    (err as any).importId = existing.id;
    (err as any).status = existing.status;
    throw err;
  }

  const id = generateId();
  await db.insert(importJobs).values({
    id,
    fileHash,
    fileName,
    status: "queued",
    createdAt: Date.now(),
  });

  queue.push({ id, fileHash, fileName, content });
  scheduleWorker();
  return id;
}

/** Получить статус задачи */
export async function getJobStatus(id: string) {
  const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
  return rows[0];
}

/** Получить ошибки DLQ для задачи (#8) */
export async function getJobErrors(jobId: string) {
  return await db.select().from(importErrors).where(eq(importErrors.importJobId, jobId));
}

function scheduleWorker() {
  if (running) return;
  setImmediate(processNext);
}

async function processNext() {
  const job = queue.shift();
  if (!job) { running = false; return; }

  running = true;
  await db.update(importJobs)
    .set({ status: "processing" })
    .where(eq(importJobs.id, job.id));

  const startedAt = Date.now();

  try {
    const { sessionId, totalLaps, validLaps, errorLaps } = await runImport(job);
    const durationMs = Date.now() - startedAt;
    await db.update(importJobs)
      .set({ status: "completed", sessionId, totalLaps, validLaps, errorLaps, finishedAt: Date.now() })
      .where(eq(importJobs.id, job.id));
    logImportCompleted({
      importJobId: job.id,
      fileName: job.fileName,
      totalRows: totalLaps,
      validRows: validLaps,
      errorRows: errorLaps,
      durationMs,
    });
  } catch (e) {
    const err = e as Error & { code?: string };

    // Файл пропущен из-за отсутствия кругов — это не ошибка
    if (err.code === 'ZERO_LAPS') {
      try {
        await db.update(importJobs)
          .set({ status: "skipped", error: err.message, finishedAt: Date.now() })
          .where(eq(importJobs.id, job.id));
      } catch (dbErr) {
        console.error("[importWorker] Failed to update job status to skipped:", dbErr);
      }
      // logImportSkipped уже вызван внутри runImport до броска ошибки
    } else {
      try {
        await db.update(importJobs)
          .set({ status: "failed", error: err.message, finishedAt: Date.now() })
          .where(eq(importJobs.id, job.id));
      } catch (dbErr) {
        console.error("[importWorker] Failed to update job status to failed:", dbErr);
      }
      logImportFailed(job.id, err);
    }
  } finally {
    setImmediate(processNext);
  }
}

export interface ImportResult {
  sessionId: number;
  totalLaps: number;
  validLaps: number;
  errorLaps: number;
}

/**
 * Парсинг и сохранение сессии.
 * Все операции записи обёрнуты в db.transaction() (#11).
 * Batch insert выполняется чанками по CHUNK_SIZE записей (#11).
 * Невалидные круги записываются в import_errors (DLQ) (#8).
 * Файлы с 0 кругами: статус "skipped", счётчик skipped++, краткое сообщение в лог.
 *
 * Экспортирована для прямого вызова из routes.ts (синхронный импорт).
 */
export async function runImport(job: ImportJobPayload): Promise<ImportResult> {
  let parsed: ParsedSession | null;
  try {
    parsed = parseRaceResults(job.content);
  } catch (e) {
    const err = e as Error;
    if ((err as any).code === 'UNSUPPORTED_LOG_VERSION') {
      throw new Error(`Неподдерживаемый формат лога: ${err.message}`);
    }
    throw new Error(`Ошибка разбора: ${err.message}`);
  }
  if (!parsed) {
    throw new Error("Не похоже на лог результатов LMU/rFactor (нет RaceResults)");
  }

  // Проверяем наличие кругов во всех водителях
  const totalParsedLaps = parsed.drivers.reduce((sum, d) => sum + d.lapList.length, 0);
  if (totalParsedLaps === 0) {
    logImportSkipped({
      importJobId: job.id,
      fileName: job.fileName,
      reason: 'ZERO_LAPS',
    });
    const err = new Error(`Файл пропущен: 0 кругов`);
    (err as any).code = 'ZERO_LAPS';
    throw err;
  }

  logImportStarted({
    importJobId: job.id,
    fileName: job.fileName,
    logVersion: parsed.logFormatVersion,
  });

  const result = await db.transaction(async (tx) => {
    const track = await findOrCreateTrack(tx, parsed!);
    const dateOnly = parsed!.dateTimeIso.slice(0, 10);

    const sessionRows = await tx.insert(sessions).values({
      trackId: track.id,
      event: parsed!.event,
      sessionType: parsed!.sessionType,
      venue: parsed!.venue,
      course: parsed!.course ?? null,
      trackLengthM: parsed!.trackLengthM ?? null,
      gameVersion: parsed!.gameVersion ?? null,
      dateTime: parsed!.dateTimeIso,
      dateTimeUnix: parsed!.dateTimeUnix ?? null,
      fileName: job.fileName,
      setting: parsed!.setting ?? null,
      driverCount: parsed!.drivers.length,
      lapCount: 0,
      raceLaps: parsed!.raceLaps ?? null,
      raceTimeMin: parsed!.raceTimeMin ?? null,
      mechFailRate: parsed!.mechFailRate ?? null,
      damageMult: parsed!.damageMult ?? null,
      fuelMult: parsed!.fuelMult ?? null,
      tireMult: parsed!.tireMult ?? null,
      vehiclesAllowed: parsed!.vehiclesAllowed ?? null,
      parcFerme: parsed!.parcFerme ?? null,
      fixedSetups: parsed!.fixedSetups ?? null,
      freeSettings: parsed!.freeSettings ?? null,
      fixedUpgrades: parsed!.fixedUpgrades ?? null,
      tireWarmers: parsed!.tireWarmers ?? null,
      dedicated: parsed!.dedicated ?? null,
      sessionDurationMin: parsed!.sessionDurationMin ?? null,
      sessionMaxLaps: parsed!.sessionMaxLaps ?? null,
      mostLapsCompleted: parsed!.mostLapsCompleted ?? null,
    }).returning();
    const session = sessionRows[0];

    const driverIdByName = new Map<string, number>();
    const lapTimeRows: any[] = [];
    const sessionLapRows: any[] = [];
    const dlqRows: any[] = [];
    let totalLapsCount = 0;
    let validLapsCount = 0;

    for (const d of parsed!.drivers) {
      const normalizedName = normalizeDriverNameForStorage(d.name);
      const driver = await findOrCreateDriver(tx, normalizedName, d.teamName);
      driverIdByName.set(normalizedName.toLowerCase(), driver.id);
      const cls = normalizeClass(d.carClass);

      const srRows = await tx.insert(sessionResults).values({
        sessionId: session.id,
        driverId: driver.id,
        isPlayer: d.isPlayer ? 1 : 0,
        position: d.position,
        classPosition: d.classPosition,
        lapRankIncludingDiscos: d.lapRankIncludingDiscos ?? null,
        carClass: cls,
        car: d.carType,
        carType: d.carType,
        team: d.teamName,
        carNumber: d.carNumber ?? null,
        vehFile: d.vehFile ?? null,
        vehName: d.vehName ?? null,
        category: d.category ?? null,
        laps: d.laps,
        pitstops: d.pitstops,
        bestLapMs: d.bestLapMs ?? null,
        finishStatus: d.finishStatus ?? null,
        controlAndAids: d.controlAndAids ?? null,
        connected: d.connected ?? null,
      }).returning();
      const sr = srRows[0];

      for (const lap of d.lapList) {
        totalLapsCount++;

        const s1 = lap.s1Ms;
        const s2 = lap.s2Ms;
        const s3 = lap.s3Ms != null
          ? lap.s3Ms
          : (s1 != null && s2 != null && lap.lapMs != null)
            ? Math.max(0, lap.lapMs - s1 - s2)
            : null;

        sessionLapRows.push({
          sessionResultId: sr.id,
          sessionId: session.id,
          driverId: driver.id,
          lapNum: lap.num,
          lapTimeMs: lap.lapMs,
          sector1Ms: s1,
          sector2Ms: s2,
          sector3Ms: s3,
          isPitLap: lap.isPit ? 1 : 0,
        });

        if (lap.lapMs != null && !lap.isPit) {
          const rawForValidation = {
            driverName: d.name,
            trackName: parsed!.venue,
            lapTimeMs: toMilliseconds(lap.lapMs),
            sessionDate: parsed!.dateTimeIso,
            carClass: cls,
            sector1Ms: s1 != null ? toMilliseconds(s1) : undefined,
            sector2Ms: s2 != null ? toMilliseconds(s2) : undefined,
            sector3Ms: s3 != null ? toMilliseconds(s3) : undefined,
          };

          const validation = validateLapTime(rawForValidation);

          if (!validation.ok) {
            logParseError(
              {
                importJobId: job.id,
                raw: JSON.stringify({ driverName: d.name, lapNum: lap.num, lapMs: lap.lapMs }),
                code: validation.errorCode,
              },
              `Failed to parse lap time: ${validation.errorMessage}`
            );
            dlqRows.push({
              importJobId: job.id,
              rawPayload: JSON.stringify({ driverName: d.name, lapNum: lap.num, lapMs: lap.lapMs }),
              errorCode: validation.errorCode,
              errorMessage: validation.errorMessage,
              occurredAt: Date.now(),
            });
            continue;
          }

          const normalized = normalizeLapTime(validation.data);

          const ltS1 = normalized.sector1Ms ?? null;
          const ltS2 = normalized.sector2Ms ?? null;
          const ltS3 = normalized.sector3Ms
            ?? (ltS1 != null && ltS2 != null
                ? Math.max(0, normalized.lapTimeMs - ltS1 - ltS2)
                : null);

          lapTimeRows.push({
            trackId: track.id,
            driverId: driver.id,
            carClass: cls,
            car: d.carType,
            lapMs: normalized.lapTimeMs,
            sector1Ms: ltS1,
            sector2Ms: ltS2,
            sector3Ms: ltS3,
            conditions: lap.conditions ?? "Сухо",
            tyre: lap.frontCompound ?? "Medium",
            date: dateOnly,
            source: "import",
            sessionId: session.id,
          });
          validLapsCount++;
        }
      }
    }

    // Batch insert session_laps чанками по CHUNK_SIZE (#11)
    for (let i = 0; i < sessionLapRows.length; i += CHUNK_SIZE) {
      await tx.insert(sessionLaps).values(sessionLapRows.slice(i, i + CHUNK_SIZE));
    }

    // Batch insert lap_times чанками по CHUNK_SIZE (#11)
    for (let i = 0; i < lapTimeRows.length; i += CHUNK_SIZE) {
      await tx.insert(lapTimes).values(lapTimeRows.slice(i, i + CHUNK_SIZE));
    }

    // Batch insert DLQ записей (#8)
    for (let i = 0; i < dlqRows.length; i += CHUNK_SIZE) {
      await tx.insert(importErrors).values(dlqRows.slice(i, i + CHUNK_SIZE));
    }

    // Проверяем порог валидных кругов (#8)
    const nonPitTotal = lapTimeRows.length + dlqRows.length;
    if (nonPitTotal > 0) {
      const validPct = (validLapsCount / nonPitTotal) * 100;
      if (validPct < VALID_LAP_THRESHOLD_PCT) {
        throw new Error(
          `Слишком много невалидных кругов: ${dlqRows.length} из ${nonPitTotal} ` +
          `(${validPct.toFixed(1)}% валидных, требуется >= ${VALID_LAP_THRESHOLD_PCT}%)`
        );
      }
    }

    // Инциденты
    for (const inc of parsed!.incidents) {
      const normalizedIncDriver = inc.driverName.trim().toLowerCase();
      const driverId = driverIdByName.get(normalizedIncDriver);
      if (driverId == null) continue;
      const targetDriverId = inc.targetDriverName
        ? (driverIdByName.get(inc.targetDriverName.trim().toLowerCase()) ?? null)
        : null;
      await tx.insert(sessionIncidents).values({
        sessionId: session.id,
        driverId,
        targetDriverId,
        elapsedTimeSec: inc.elapsedTimeSec,
        severity: inc.severity,
        isImmovable: inc.isImmovable ? 1 : 0,
      });
    }

    // Лучшие времена секторов
    for (const sb of parsed!.sectorBests) {
      const normalizedSbDriver = sb.driverName.trim().toLowerCase();
      const driverId = driverIdByName.get(normalizedSbDriver);
      if (driverId == null) continue;
      await tx.insert(sessionSectorBests).values({
        sessionId: session.id,
        driverId,
        carClass: normalizeClass(sb.carClass),
        sector: sb.sector,
        elapsedTimeSec: sb.elapsedTimeSec,
        lapNum: sb.lapNum ?? null,
      });
    }

    // Нарушения трассы
    for (const tl of parsed!.trackLimits) {
      const normalizedTlDriver = tl.driverName.trim().toLowerCase();
      const driverId = driverIdByName.get(normalizedTlDriver);
      if (driverId == null) continue;
      await tx.insert(sessionTrackLimits).values({
        sessionId: session.id,
        driverId,
        lapNum: tl.lapNum,
        elapsedTimeSec: tl.elapsedTimeSec,
        warningPoints: tl.warningPoints ?? null,
        currentPoints: tl.currentPoints ?? null,
        resolution: tl.resolution ?? null,
        decision: tl.decision ?? null,
      });
    }

    // Атомарное обновление lapCount внутри транзакции (#11)
    await tx.update(sessions)
      .set({ lapCount: validLapsCount })
      .where(eq(sessions.id, session.id));

    return { sessionId: session.id, totalLaps: totalLapsCount, validLaps: validLapsCount, errorLaps: dlqRows.length };
  });

  return result;
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

async function findOrCreateTrack(tx: any, parsed: ParsedSession): Promise<Track> {
  const all = await tx.select().from(tracks);
  const course = parsed.course;
  const canonicalName = canonicalTrackName(parsed.venue).name.toLowerCase();
  const parsedCourseNorm = (course ?? "").toLowerCase();

  const exactMatch = all.find((t: Track) => {
    const dbNameLower = t.name.toLowerCase();
    const layoutNorm = (t.layout ?? "").toLowerCase();
    if (course) return dbNameLower === canonicalName && layoutNorm === parsedCourseNorm;
    return dbNameLower === canonicalName;
  });
  if (exactMatch) return exactMatch;

  const canonical = canonicalTrackName(parsed.venue);
  const lengthKm = parsed.trackLengthM ? +(parsed.trackLengthM / 1000).toFixed(3) : 0;
  const rows = await tx.insert(tracks).values({
    name: canonical.name,
    country: canonical.country,
    lengthKm,
    turns: canonical.turns,
    layout: course ?? "Импорт",
  }).returning();
  return rows[0];
}

async function findOrCreateDriver(tx: any, name: string, team: string): Promise<Driver> {
  const all = await tx.select().from(drivers);
  const found = all.find((d: Driver) => d.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const rows = await tx.insert(drivers).values({
    name,
    team: team || "—",
    country: guessCountry(name),
  }).returning();
  return rows[0];
}

function normalizeClass(raw: string): string {
  const r = (raw || "").trim();
  if (!r || r === "—") return "GT3";
  return r;
}

function canonicalTrackName(venue: string): { name: string; country: string; turns: number } {
  const v = venue.toLowerCase();
  if (v.includes("carlos pace") || v.includes("interlagos")) return { name: "Interlagos", country: "Бразилия", turns: 15 };
  if (v.includes("le mans")) return { name: "Le Mans", country: "Франция", turns: 38 };
  if (v.includes("spa")) return { name: "Spa-Francorchamps", country: "Бельгия", turns: 20 };
  if (v.includes("monza")) return { name: "Monza", country: "Италия", turns: 11 };
  if (v.includes("fuji")) return { name: "Fuji Speedway", country: "Япония", turns: 16 };
  if (v.includes("sebring")) return { name: "Sebring", country: "США", turns: 17 };
  if (v.includes("bahrain") || v.includes("sakhir")) return { name: "Bahrain", country: "Бахрейн", turns: 15 };
  if (v.includes("imola")) return { name: "Imola", country: "Италия", turns: 19 };
  if (v.includes("portim") || v.includes("algarve")) return { name: "Portimão", country: "Португалия", turns: 15 };
  if (v.includes("cota") || v.includes("americas")) return { name: "COTA", country: "США", turns: 20 };
  if (v.includes("qatar") || v.includes("losail")) return { name: "Losail", country: "Катар", turns: 16 };
  return { name: venue, country: "—", turns: 0 };
}

function guessCountry(name: string): string {
  if (/[а-яёА-ЯЁ]/.test(name)) return "RU";
  const lower = name.toLowerCase();
  const jpNames = ["tanaka","suzuki","yamamoto","nakamura","kobayashi","sato","ito","kato","watanabe","yamada","hayashi","matsumoto","inoue","kimura","ogawa","fujita","hashimoto","ishikawa","nakanishi","okamoto"];
  const jpSuffixes = ["moto","hiko","yuki","taro","suke","nori","hide","kazu"];
  if (jpNames.some((n) => lower.includes(n))) return "JP";
  if (jpSuffixes.some((s) => lower.endsWith(s))) return "JP";
  const deSuffixes = ["mann","ner","ger","berger","schneider","bauer","müller","muller","wagner","hoffmann","schulz","schwarz","braun","koch","richter"];
  if (deSuffixes.some((s) => lower.includes(s))) return "DE";
  const frNames = ["blanc","dupont","martin","bernard","thomas","petit","robert","richard","durand","moreau","leroy","simon","laurent","michel","garcia","david","fontaine","rousseau","vincent","fournier"];
  if (frNames.some((n) => lower.includes(n))) return "FR";
  const itSuffixes = ["rossi","russo","ferrari","bianchi","ricci","romano","marino","colombo","conti","esposito","de luca","de santis","fontana","mancini","rinaldi","lombardi","barbieri","cattaneo"];
  if (itSuffixes.some((s) => lower.includes(s))) return "IT";
  const esSuffixes = ["rodriguez","garcia","martinez","fernandez","lopez","gonzalez","perez","sanchez","ramirez","torres","flores","diaz","reyes","morales","gutierrez","vargas","castillo"];
  if (esSuffixes.some((s) => lower.includes(s))) return "ES";
  const gbNames = ["smith","jones","williams","brown","wilson","taylor","davies","evans","thomas","johnson","white","martin","carter","walker"];
  if (gbNames.some((n) => lower.includes(n))) return "GB";
  return "—";
}
