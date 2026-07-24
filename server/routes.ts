import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { storage, type LapFilter, db } from "./storage";
import {
  importJobs,
  importErrors,
  tracks,
  drivers,
  lapTimes,
  sessions,
  sessionResults,
  sessionLaps,
  sessionIncidents,
  sessionSectorBests,
  sessionTrackLimits,
  telemetryImportJobs,
  telemetrySessions,
  telemetryChannels,
  telemetrySamples,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { getSpecialEvents, invalidateCache } from "./eventsParser";
import { computeFileHash, generateId, getJobStatus, getJobErrors, runImport } from "./importWorker";
import { computeFileHashBinary, runTelemetryImport } from "./telemetryImportWorker";
import { listTelemetrySessions, getTelemetrySessionWithChannels, getSessionLaps, getLapSeries } from "./telemetryQuery";
import { requireAdminToken } from "./adminAuth";
import {
  IdParamSchema,
  LapNumberParamSchema,
  PaginationQuerySchema,
  LapsQuerySchema,
  BestLapsQuerySchema,
  formatZodError,
} from "@shared/validators";
import type { z } from "zod";

/**
 * Wraps an async route handler so that any rejected Promise is forwarded
 * to Express's next(err) — required in Express 4 which does NOT catch
 * unhandled rejections automatically (fixed only in Express 5).
 * Fixes issue #65.
 */
/**
 * Drizzle/pg query errors put the real Postgres reason (constraint violation,
 * type mismatch, etc.) in `error.cause`, not in `error.message` (which is just
 * "Failed query: <sql> params: <params>"). Without this, that reason was lost
 * both to the client response and to the server logs.
 */
function errorMessageWithCause(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error ? e.cause : undefined;
  const causeMessage = cause instanceof Error ? cause.message : undefined;
  return causeMessage ? `${message} — ${causeMessage}` : message;
}

const asyncRoute =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

/**
 * #121: разбор limit/offset из уже провалидированных Zod-схемой query-параметров
 * списочных эндпоинтов. defaultLimit применяется только когда клиент НЕ передал
 * limit явно — так эндпоинт никогда не отдаёт безусловно весь датасет, но не
 * мешает осознанному запросу большей страницы (в пределах maxLimit).
 *
 * #124: сам разбор строка→число и его корректность (конечное положительное
 * целое) проверяются на входе Zod-схемой (PaginationQuerySchema и её
 * расширения) — сюда попадают только уже валидные limit/offset либо undefined.
 */
function resolvePagination(
  parsed: { limit?: number; offset?: number },
  { defaultLimit, maxLimit }: { defaultLimit: number; maxLimit: number },
): { limit: number; offset: number } {
  const limit = parsed.limit != null ? Math.min(parsed.limit, maxLimit) : defaultLimit;
  const offset = parsed.offset ?? 0;
  return { limit, offset };
}

/**
 * #124: валидация числового параметра пути через Zod. При ошибке сама
 * отправляет 400 и возвращает undefined — вызывающий роут должен в этом
 * случае немедленно завершить обработку (return). По умолчанию — PK-схема
 * (положительное целое); для :lapNumber передаётся LapNumberParamSchema.
 */
function parseIdParam(
  raw: string | string[],
  res: Response,
  label = "id",
  schema: z.ZodType<number> = IdParamSchema,
): number | undefined {
  const result = schema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  if (!result.success) {
    res.status(400).json({ message: `Некорректный ${label}` });
    return undefined;
  }
  return result.data;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get(
    "/api/tracks",
    asyncRoute(async (_req, res) => {
      res.json(await storage.getTracks());
    }),
  );

  app.get(
    "/api/tracks/:id",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      const track = await storage.getTrack(id);
      if (!track) return res.status(404).json({ message: "Трасса не найдена" });
      res.json(track);
    }),
  );

  // fix: useDrivers()/DriverFilterBar вызывают этот эндпоинт БЕЗ limit —
  // раньше это всегда молча обрезалось до 500 записей (в отличие от
  // /api/laps, где лимит по умолчанию не применяется при отсутствии
  // фильтра). Список пилотов растёт вместе с реальным числом участников
  // сессий, а не с числом кругов — гораздо медленнее lap_times, поэтому
  // здесь достаточно высокого потолка вместо полноценной пагинации в UI.
  app.get(
    "/api/drivers",
    asyncRoute(async (req, res) => {
      const parsed = PaginationQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Некорректные параметры запроса", details: formatZodError(parsed.error) });
      }
      const pagination = resolvePagination(parsed.data, { defaultLimit: 5000, maxLimit: 5000 });
      res.json(await storage.getDrivers(pagination));
    }),
  );

  app.get(
    "/api/drivers/:id",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      const driver = await storage.getDriver(id);
      if (!driver) return res.status(404).json({ message: "Пилот не найден" });
      res.json(driver);
    }),
  );

  /**
   * GET /api/drivers/:id/incidents — инциденты и нарушения трек-лимитов
   * пилота по гоночным сессиям. Используется страницей профиля пилота.
   */
  app.get(
    "/api/drivers/:id/incidents",
    asyncRoute(async (req, res) => {
      const driverId = parseIdParam(req.params.id, res, "id пилота");
      if (driverId === undefined) return;
      res.json(await storage.getDriverIncidents(driverId));
    }),
  );

  app.get(
    "/api/laps",
    asyncRoute(async (req, res) => {
      const parsed = LapsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Некорректные параметры запроса", details: formatZodError(parsed.error) });
      }
      const { limit, offset, ...filterFields } = parsed.data;
      const filter: LapFilter = {};
      if (filterFields.trackId !== undefined) filter.trackId = filterFields.trackId;
      if (filterFields.driverId !== undefined) filter.driverId = filterFields.driverId;
      if (filterFields.carClass !== undefined) filter.carClass = filterFields.carClass;
      if (filterFields.conditions !== undefined) filter.conditions = filterFields.conditions;
      if (filterFields.sessionId !== undefined) filter.sessionId = filterFields.sessionId;
      if (filterFields.sessionCourse !== undefined) filter.sessionCourse = filterFields.sessionCourse;

      // #121: без фильтра и без явного limit — эндпоинт больше никогда не
      // отдаёт ВЕСЬ lap_times безусловно. С любым фильтром (уже ограничен
      // реальным числом строк по смыслу) лимит применяется только если его
      // явно попросили.
      const hasFilter = Object.keys(filter).length > 0;
      const explicitLimit = limit != null;
      const pagination =
        hasFilter && !explicitLimit
          ? undefined
          : resolvePagination({ limit, offset }, { defaultLimit: 500, maxLimit: 5000 });

      res.json(await storage.getLaps(filter, pagination));
    }),
  );

  /**
   * GET /api/laps/best — #121: личный лучший круг каждого пилота на каждой
   * трассе в каждом классе. Заменяет паттерн "выгрузить все круги и свернуть
   * на клиенте" (Leaderboards, Overview, Tracks, профиль пилота) — размер
   * ответа ограничен количеством комбинаций трасса×класс×пилот, а не общим
   * числом кругов, поэтому отдельной пагинации не требует.
   */
  app.get(
    "/api/laps/best",
    asyncRoute(async (req, res) => {
      const parsed = BestLapsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Некорректные параметры запроса", details: formatZodError(parsed.error) });
      }
      const filter: { trackId?: number; driverId?: number; carClass?: string; sessionCourse?: string } = {};
      if (parsed.data.trackId !== undefined) filter.trackId = parsed.data.trackId;
      if (parsed.data.driverId !== undefined) filter.driverId = parsed.data.driverId;
      if (parsed.data.carClass !== undefined) filter.carClass = parsed.data.carClass;
      if (parsed.data.sessionCourse !== undefined) filter.sessionCourse = parsed.data.sessionCourse;
      res.json(await storage.getBestLaps(filter));
    }),
  );

  // fix: useSessions() (Sessions.tsx summary, DriverProfile session history)
  // вызывает этот эндпоинт БЕЗ limit — раньше молча обрезалось до 500 самых
  // свежих сессий, без какой-либо пагинации в UI и без индикации усечения.
  app.get(
    "/api/sessions",
    asyncRoute(async (req, res) => {
      const parsed = PaginationQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Некорректные параметры запроса", details: formatZodError(parsed.error) });
      }
      const pagination = resolvePagination(parsed.data, { defaultLimit: 5000, maxLimit: 5000 });
      res.json(await storage.getSessions(pagination));
    }),
  );

  app.get(
    "/api/sessions/:id",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      const session = await storage.getSession(id);
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });
      res.json(session);
    }),
  );

  /**
   * GET /api/sessions/:id/laps — детальные данные по кругам сессии.
   * Возвращает записи из таблицы session_laps, обогащённые именем пилота.
   * Используется вкладками «Круги», «Секторы» и «Прогресс» на странице SessionDetail.
   */
  app.get(
    "/api/sessions/:id/laps",
    asyncRoute(async (req, res) => {
      const sessionId = parseIdParam(req.params.id, res, "id сессии");
      if (sessionId === undefined) return;

      const lapsRows = await db.select().from(sessionLaps).where(eq(sessionLaps.sessionId, sessionId));

      // Только пилоты этой сессии — а не вся таблица drivers на каждый показ
      // вкладок «Круги»/«Секторы»/«Прогресс» страницы сессии.
      const driverIds = Array.from(new Set(lapsRows.map((l) => l.driverId)));
      const driversInSession = driverIds.length
        ? await db.select().from(drivers).where(inArray(drivers.id, driverIds))
        : [];
      const driverMap = new Map(driversInSession.map((d) => [d.id, d]));

      // Получаем isPlayer из sessionResults для каждого пилота
      const srRows = await db.select().from(sessionResults).where(eq(sessionResults.sessionId, sessionId));
      const isPlayerMap = new Map(srRows.map((r) => [r.driverId, r.isPlayer]));
      const carNumberMap = new Map(srRows.map((r) => [r.driverId, r.carNumber ?? null]));

      const enriched = lapsRows.map((lap) => ({
        ...lap,
        // Поля для совместимости с sessionDetailSelectors (buildDriverLapGroups / buildLapProgressSeries)
        lapNumber: lap.lapNum,
        lapTimeSeconds: lap.lapTimeMs != null ? lap.lapTimeMs / 1000 : null,
        sector1: lap.sector1Ms != null ? lap.sector1Ms / 1000 : null,
        sector2: lap.sector2Ms != null ? lap.sector2Ms / 1000 : null,
        sector3: lap.sector3Ms != null ? lap.sector3Ms / 1000 : null,
        isPitLap: lap.isPitLap === 1,
        driverName: driverMap.get(lap.driverId)?.name ?? "—",
        carNumber: carNumberMap.get(lap.driverId) ?? null,
        isPlayer: isPlayerMap.get(lap.driverId) ?? 0,
      }));

      res.json(enriched);
    }),
  );

  // ── Телеметрия (просмотр) ────────────────────────────────────────
  app.get(
    "/api/telemetry/sessions",
    asyncRoute(async (_req, res) => {
      res.json(await listTelemetrySessions());
    }),
  );

  app.get(
    "/api/telemetry/sessions/:id",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      const result = await getTelemetrySessionWithChannels(id);
      if (!result) return res.status(404).json({ message: "Запись телеметрии не найдена" });
      res.json(result);
    }),
  );

  app.get(
    "/api/telemetry/sessions/:id/laps",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      res.json(await getSessionLaps(id));
    }),
  );

  app.get(
    "/api/telemetry/sessions/:id/laps/:lapNumber/series",
    asyncRoute(async (req, res) => {
      const id = parseIdParam(req.params.id, res);
      if (id === undefined) return;
      const lapNumber = parseIdParam(req.params.lapNumber, res, "номер круга", LapNumberParamSchema);
      if (lapNumber === undefined) return;
      const laps = await getSessionLaps(id);
      const lap = laps.find((l) => l.lapNumber === lapNumber);
      if (!lap) return res.status(404).json({ message: "Круг не найден" });
      res.json(await getLapSeries(id, lap));
    }),
  );

  /**
   * POST /api/import — synchronous ingestion.
   *
   * PostgreSQL transactions for typical LMU files (~5 000 rows) complete in
   * well under 500 ms, so there is no benefit to an async queue here.
   * runImport() is called directly and awaited; the response is sent
   * only after all files are persisted. Duplicate-file detection is
   * preserved via SHA-256 hash.
   */
  app.post(
    "/api/import",
    asyncRoute(async (req, res) => {
      const files = req.body?.files;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ message: "Не переданы файлы для импорта" });
      }

      const results: any[] = [];
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      let totalLaps = 0;

      for (const f of files) {
        const fileName = String(f?.fileName ?? "без_имени.xml");
        const content = String(f?.content ?? "");

        if (!content.trim()) {
          results.push({ fileName, ok: false, skipped: true, status: 409, message: "Пустой файл" });
          skipped++;
          continue;
        }

        // Idempotency check (#6): SHA-256 hash
        const fileHash = computeFileHash(content);
        const existingRows = await db.select().from(importJobs).where(eq(importJobs.fileHash, fileHash));
        const existing = existingRows[0];

        // Только НЕ-failed прошлая попытка считается настоящим дубликатом.
        // Файл, чей импорт раньше упал (временный сбой БД, диск и т.п.),
        // иначе был бы заблокирован от повторной загрузки НАВСЕГДА — тот же
        // fileHash уже занят в UNIQUE-колонке, а статус так и остаётся "failed".
        if (existing && existing.status !== "failed") {
          skipped++;
          results.push({
            fileName,
            ok: false,
            skipped: true,
            status: 409,
            message: "Файл уже был импортирован",
            importId: existing.id,
            importStatus: existing.status,
          });
          continue;
        }

        // Новый файл — создаём запись задачи; повтор после failed — переиспользуем
        // ту же строку (id, fileHash уникален), а не вставляем вторую с тем же хэшем.
        const id = existing ? existing.id : generateId();
        if (existing) {
          await db
            .update(importJobs)
            .set({ status: "processing", error: null, finishedAt: null })
            .where(eq(importJobs.id, id));
        } else {
          await db.insert(importJobs).values({
            id,
            fileHash,
            fileName,
            status: "processing",
            createdAt: Date.now(),
          });
        }

        try {
          const {
            sessionId,
            totalLaps: laps,
            validLaps,
            errorLaps,
            event,
            venue,
            sessionType,
            driverCount,
            replacedSessionId,
            replacedLapCount,
          } = await runImport({ id, fileHash, fileName, content });

          await db
            .update(importJobs)
            .set({ status: "completed", sessionId, totalLaps: laps, validLaps, errorLaps, finishedAt: Date.now() })
            .where(eq(importJobs.id, id));

          imported++;
          totalLaps += validLaps;
          results.push({
            fileName,
            ok: true,
            skipped: false,
            importId: id,
            sessionId,
            laps: validLaps,
            errorLaps,
            event,
            venue,
            sessionType,
            drivers: driverCount,
            replacedSessionId,
            replacedLapCount,
          });
        } catch (e: any) {
          if (e.code === "ZERO_LAPS" || e.code === "SUPERSEDED") {
            // ZERO_LAPS: файл валидный, но кругов/участников нет.
            // SUPERSEDED: в БД уже есть более полный дамп этой же сессии
            // (см. server/sessionSupersede.ts) — оба считаются пропуском, не ошибкой.
            await db
              .update(importJobs)
              .set({ status: "skipped", error: e.message, finishedAt: Date.now() })
              .where(eq(importJobs.id, id));
            skipped++;
            results.push({
              fileName,
              ok: false,
              skipped: true,
              status: 200,
              message: e.message,
              importId: id,
              ...(e.code === "SUPERSEDED"
                ? {
                    reason: "SUPERSEDED",
                    existingSessionId: e.existingSessionId,
                    existingLapCount: e.existingLapCount,
                    newLapCount: e.newLapCount,
                  }
                : {}),
            });
          } else {
            const message = errorMessageWithCause(e);
            console.error(`[import] ${fileName} failed:`, e);
            await db
              .update(importJobs)
              .set({ status: "failed", error: message, finishedAt: Date.now() })
              .where(eq(importJobs.id, id));
            errors++;
            results.push({ fileName, ok: false, skipped: false, status: 500, message, importId: id });
          }
        }
      }

      // 200 если есть хоть один успешный импорт или все «неуспехи» — только пропуски
      const httpStatus = imported > 0 || errors === 0 ? 200 : 400;
      res.status(httpStatus).json({ imported, skipped, totalLaps, total: results.length, results });
    }),
  );

  /**
   * DELETE /api/import/all — полная очистка БД.
   * Удаляет все импортированные данные: круги, сессии, пилоты, трассы,
   * задачи импорта и ошибки DLQ. Используется кнопкой "Очистить БД" на
   * вкладке импорта.
   */
  app.delete(
    "/api/import/all",
    requireAdminToken,
    asyncRoute(async (_req, res) => {
      await db.transaction(async (tx) => {
        await tx.delete(sessionTrackLimits);
        await tx.delete(sessionSectorBests);
        await tx.delete(sessionIncidents);
        await tx.delete(sessionLaps);
        await tx.delete(lapTimes);
        await tx.delete(sessionResults);
        await tx.delete(sessions);
        await tx.delete(importErrors);
        await tx.delete(importJobs);
        await tx.delete(drivers);
        await tx.delete(tracks);
      });
      res.json({ ok: true, message: "База данных успешно очищена" });
    }),
  );

  /**
   * POST /api/import/telemetry?fileName=<name> — импорт .duckdb файла телеметрии.
   *
   * Тело запроса — сырые байты файла (application/octet-stream), а не JSON:
   * .duckdb — бинарный формат, десятки МБ, base64-в-JSON был бы неэффективен.
   * Мидлварь express.raw() навешана только на этот роут, не трогая глобальный
   * express.json() в server/index.ts. Идемпотентность — по SHA-256 сырых байт,
   * как в POST /api/import для XML-логов.
   */
  app.post(
    "/api/import/telemetry",
    express.raw({ type: "application/octet-stream", limit: "150mb" }),
    asyncRoute(async (req, res) => {
      const fileName = String(req.query.fileName ?? "телеметрия.duckdb");
      const buffer = req.body;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({ message: "Не передано содержимое файла" });
      }

      const fileHash = computeFileHashBinary(buffer);
      const existingRows = await db
        .select()
        .from(telemetryImportJobs)
        .where(eq(telemetryImportJobs.fileHash, fileHash));
      const existing = existingRows[0];

      // Только НЕ-failed прошлая попытка блокирует повтор — иначе файл,
      // чей импорт однажды упал, никогда больше не загрузился бы (fileHash
      // уникален, а статус так и остаётся "failed" навсегда).
      if (existing && existing.status !== "failed") {
        return res.status(409).json({
          ok: false,
          fileName,
          message: "Файл уже был импортирован",
          importId: existing.id,
          importStatus: existing.status,
        });
      }

      const id = existing ? existing.id : generateId();
      if (existing) {
        await db
          .update(telemetryImportJobs)
          .set({ status: "processing", error: null, finishedAt: null })
          .where(eq(telemetryImportJobs.id, id));
      } else {
        await db.insert(telemetryImportJobs).values({
          id,
          fileHash,
          fileName,
          status: "processing",
          createdAt: Date.now(),
        });
      }

      try {
        const { telemetrySessionId, channelCount, sampleCount } = await runTelemetryImport({
          id,
          fileHash,
          fileName,
          buffer,
        });

        await db
          .update(telemetryImportJobs)
          .set({ status: "completed", telemetrySessionId, channelCount, sampleCount, finishedAt: Date.now() })
          .where(eq(telemetryImportJobs.id, id));

        res.json({ ok: true, fileName, importId: id, telemetrySessionId, channelCount, sampleCount });
      } catch (e: any) {
        const message = errorMessageWithCause(e);
        console.error(`[telemetryImport] ${fileName} failed:`, e);
        await db
          .update(telemetryImportJobs)
          .set({ status: "failed", error: message, finishedAt: Date.now() })
          .where(eq(telemetryImportJobs.id, id));
        res.status(500).json({ ok: false, fileName, message, importId: id });
      }
    }),
  );

  /**
   * DELETE /api/import/telemetry/all — очистка импортированной телеметрии.
   * Не затрагивает данные заездов (sessions/lap_times) — независимый набор таблиц.
   */
  app.delete(
    "/api/import/telemetry/all",
    requireAdminToken,
    asyncRoute(async (_req, res) => {
      await db.transaction(async (tx) => {
        await tx.delete(telemetrySamples);
        await tx.delete(telemetryChannels);
        await tx.delete(telemetrySessions);
        await tx.delete(telemetryImportJobs);
      });
      res.json({ ok: true, message: "Телеметрия успешно очищена" });
    }),
  );

  /**
   * GET /api/import/:id/status — статус задачи (#5)
   */
  app.get(
    "/api/import/:id/status",
    asyncRoute(async (req, res) => {
      const job = await getJobStatus(String(req.params.id));
      if (!job) return res.status(404).json({ message: "Задача не найдена" });
      res.json({
        importId: job.id,
        fileName: job.fileName,
        status: job.status,
        sessionId: job.sessionId ?? null,
        totalLaps: job.totalLaps ?? null,
        validLaps: job.validLaps ?? null,
        errorLaps: job.errorLaps ?? null,
        error: job.error ?? null,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt ?? null,
      });
    }),
  );

  /**
   * GET /api/import/:id/errors — просмотр DLQ ошибок импорта (#8)
   */
  app.get(
    "/api/import/:id/errors",
    asyncRoute(async (req, res) => {
      const job = await getJobStatus(String(req.params.id));
      if (!job) return res.status(404).json({ message: "Задача не найдена" });
      const errors = await getJobErrors(String(req.params.id));
      res.json({
        importId: job.id,
        fileName: job.fileName,
        status: job.status,
        totalErrors: errors.length,
        errors,
      });
    }),
  );

  // ── Special Events ──────────────────────────────────────────────
  app.get(
    "/api/special-events",
    asyncRoute(async (_req, res) => {
      const data = await getSpecialEvents();
      res.json(data);
    }),
  );

  app.post(
    "/api/special-events/refresh",
    asyncRoute(async (_req, res) => {
      invalidateCache();
      const data = await getSpecialEvents();
      res.json({ ok: true, fetchedAt: data.fetchedAt, count: data.events.length, source: data.source });
    }),
  );

  return httpServer;
}
