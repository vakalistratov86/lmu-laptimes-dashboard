/**
 * SD-3: Чистые селекторы / билдеры для частей SessionDetailViewModel.
 * Файл не импортирует React / JSX.
 */
import type {
  SessionHeroStatItem,
  SessionResultRowView,
  DriverLapsGroupView,
  DriverLapRowView,
  TyreWear,
  DriverSectorSummary,
  LapProgressSeries,
  LapProgressPoint,
  SessionTabItem,
} from "@/components/session-detail/types";
import { formatLap, formatSector } from "./format";
import type { NormalizedSessionType } from "./sessionDetail.types";

// ────────────────────────────────────────────────────────────────────────────
// Вспомогательные утилиты
// ────────────────────────────────────────────────────────────────────────────

// Круг и сектор форматируются общими на всё приложение formatLap/formatSector
// (client/src/lib/format.ts) — обе принимают миллисекунды.
//
// Все величины ниже по файлу намеренно держатся в МИЛЛИСЕКУНДАХ от парсинга до
// форматирования (сравнения — best/worst/среднее — от единиц не зависят, порядок
// тот же что и в секундах). Раньше здесь было наоборот: парсинг сразу делил на
// 1000, а форматирование перед вызовом formatLap/formatSector умножало обратно —
// на значениях, для которых round-trip даёт нецелый ms (например 51669.999999…
// вместо 51670), из этого получался кривой вывод в СЕКТОР 2 (#см. правку с
// Math.round в format.ts). Работа в ms с самого начала убирает round-trip как
// класс, а не просто подстраховывается округлением на выходе.

/** Круговое время в МС: предпочитаем целочисленное *Ms поле, иначе секунды*1000. */
function parseLapMs(lap: AnyLap): number {
  const ms = Number(lap.lapTimeMs);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const sec = Number(lap.lapTimeSeconds ?? lap.time);
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  return NaN;
}

/** Время сектора в МС: тот же приоритет — целочисленное *Ms поле, иначе секунды*1000. */
function parseSectorMs(msProp: unknown, secProp: unknown, shortProp: unknown): number {
  const ms = Number(msProp);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const sec = Number(secProp ?? shortProp);
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  return NaN;
}

/** Форматирует отставание (gap) в секундах в строку «+X.XXX». */
export function formatGap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return `+${seconds.toFixed(3)}`;
}

/**
 * SD-18: Форматирует значение скорости в строку «XXX» (км/ч) или «—».
 * Принимает число в км/ч.
 */
function formatSpeed(raw: unknown): string {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return `${Math.round(v)}`;
}

/**
 * Форматирует остаток топлива в строку «XX» (% от полного бака) или «—».
 * LMU хранит fuelLevel как долю бака 0–1 (fuel="0.690" в логе) — не литры,
 * поэтому пересчитываем в процент, а не подставляем сырое значение.
 */
function formatFuelPercent(raw: unknown): string {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return "—";
  const pct = v > 1 ? v : v * 100;
  return `${Math.round(pct)}`;
}

/**
 * SD-18: Парсит значение состояния/износа шины в строку «XX» (целый %) или «—».
 * LMU хранит condition как долю 0–1 (1.0 = новая шина).
 * Отображаем как процент оставшегося ресурса: 1.0 → 100, 0.75 → 75.
 */
function formatWear(raw: unknown): string {
  const v = Number(raw);
  if (!Number.isFinite(v)) return "—";
  // Значение может быть 0–1 (доля) или 0–100 (проценты)
  const pct = v > 1 ? v : v * 100;
  return `${Math.round(pct)}`;
}

/**
 * SD-18: Формирует объект TyreWear из полей lap-записи.
 *
 * Реальные поля в session_laps (schema.ts):
 *   tyreFLCondition, tyreFRCondition, tyreRLCondition, tyreRRCondition
 *
 * Fallback-цепочка для совместимости с другими форматами импорта.
 */
function parseTyreWear(lap: Record<string, any>): TyreWear | null {
  // Приоритет 1: реальные поля схемы БД (session_laps)
  const fl =
    lap.tyreFLCondition ??
    lap.tyreFLcondition ??
    lap.tyreWearFL ??
    lap.tireWearFL ??
    lap.wearFL ??
    lap.wear_fl ??
    lap.tyreWear?.fl ??
    lap.tireWear?.fl ??
    null;

  const fr =
    lap.tyreFRCondition ??
    lap.tyreFRcondition ??
    lap.tyreWearFR ??
    lap.tireWearFR ??
    lap.wearFR ??
    lap.wear_fr ??
    lap.tyreWear?.fr ??
    lap.tireWear?.fr ??
    null;

  const rl =
    lap.tyreRLCondition ??
    lap.tyreRLcondition ??
    lap.tyreWearRL ??
    lap.tireWearRL ??
    lap.wearRL ??
    lap.wear_rl ??
    lap.tyreWear?.rl ??
    lap.tireWear?.rl ??
    null;

  const rr =
    lap.tyreRRCondition ??
    lap.tyreRRcondition ??
    lap.tyreWearRR ??
    lap.tireWearRR ??
    lap.wearRR ??
    lap.wear_rr ??
    lap.tyreWear?.rr ??
    lap.tireWear?.rr ??
    null;

  if (fl == null && fr == null && rl == null && rr == null) return null;

  return {
    fl: formatWear(fl),
    fr: formatWear(fr),
    rl: formatWear(rl),
    rr: formatWear(rr),
  };
}

/**
 * SD-19: Извлекает «сырое» значение максимальной скорости из lap-записи
 * (используется как при форматировании отдельного круга, так и при
 * агрегации максимума по всей сессии для карточки пилота).
 */
function extractMaxSpeedRaw(lap: Record<string, any>): unknown {
  return (
    lap.topSpeedKph ?? lap.topSpeed ?? lap.maxSpeed ?? lap.maxSpeedKmh ?? lap.top_speed_kph ?? lap.top_speed ?? null
  );
}

/**
 * SD-19: Извлекает «сырое» значение остатка топлива из lap-записи.
 */
function extractFuelRaw(lap: Record<string, any>): unknown {
  return lap.fuelLevel ?? lap.fuelRemaining ?? lap.fuel ?? lap.fuel_level ?? lap.fuel_remaining ?? null;
}

/**
 * SD-18: Извлекает тип/состав шин из lap-записи.
 *
 * Реальные поля в session_laps (schema.ts):
 *   frontCompound, rearCompound, tyreFL, tyreFR, tyreRL, tyreRR
 *
 * Используем frontCompound как основной источник; если не задан —
 * пробуем tyreFL (текстовое название шины на конкретном колесе).
 */
function parseTyreType(lap: Record<string, any>): string {
  const raw =
    lap.frontCompound ??
    lap.tyreFL ??
    lap.rearCompound ??
    lap.tyreFR ??
    lap.tyreType ??
    lap.tireType ??
    lap.tyreCompound ??
    lap.tireCompound ??
    lap.compound ??
    lap.tyre ??
    lap.tire ??
    null;

  if (raw == null || raw === "") return "—";
  const str = String(raw);
  // Часть логов хранит компаунд в формате «0,Medium» (индекс,название) —
  // берём часть после запятой, если она есть.
  const cleaned = str.includes(",") ? str.split(",").pop()!.trim() : str.trim();
  return cleaned || "—";
}

// ────────────────────────────────────────────────────────────────────────────
// normalizeSessionType
// ────────────────────────────────────────────────────────────────────────────

const SESSION_TYPE_MAP: Record<string, NormalizedSessionType> = {
  race: "race",
  race1: "race",
  race2: "race",
  qualify: "qualify",
  qualifying: "qualify",
  superpole: "superpole",
  "superpole race": "race",
  warmup: "warmup",
  practice: "practice",
  fp1: "practice",
  fp2: "practice",
  fp3: "practice",
};

export function normalizeSessionType(raw: string): NormalizedSessionType {
  const key = raw.trim().toLowerCase();
  return SESSION_TYPE_MAP[key] ?? "practice";
}

// ────────────────────────────────────────────────────────────────────────────
// buildHeroStats
// ────────────────────────────────────────────────────────────────────────────

type AnySession = Record<string, any>;
type AnyLap = Record<string, any>;

/**
 * Ключ группировки кругов по пилоту. Предпочитаем driverId, когда он есть в
 * данных, а не driverName как единственный идентификатор — два разных
 * пилота могут случайно иметь одинаковое отображаемое имя (или оба быть
 * безымянными и попасть под общий 'Unknown'), из-за чего их круги молча
 * сливались бы в одну группу со смешанной статистикой.
 */
function driverKey(lap: AnyLap): string {
  const id = lap.driverId ?? lap.driver_id;
  if (id != null && Number.isFinite(Number(id))) return `id:${id}`;
  return `name:${String(lap.driverName ?? lap.driver ?? "Unknown")}`;
}

/** Является ли круг пит-лапом (учитываем оба варианта имени поля из разных источников). */
function isPitLap(lap: AnyLap): boolean {
  return Boolean(lap.isPitLap ?? lap.pitLap ?? false);
}

export function buildHeroStats(session: unknown): SessionHeroStatItem[] {
  const s = session as AnySession;
  const normalized = normalizeSessionType(String(s?.sessionType ?? ""));
  const stats: SessionHeroStatItem[] = [];

  const winner: string | undefined = s?.winner ?? s?.results?.[0]?.driverName;
  if (winner) {
    stats.push({
      label: normalized === "race" ? "Победитель" : "Polesitter",
      value: winner,
      subLabel: s?.results?.[0]?.teamName ?? null,
    });
  }

  const fastestLap: string | undefined = s?.fastestLap?.time ?? s?.fastestLapTime;
  const fastestDriver: string | undefined = s?.fastestLap?.driverName;
  if (fastestLap) {
    stats.push({
      label: "Fastest Lap",
      value: fastestLap,
      subLabel: fastestDriver ?? null,
    });
  }

  const totalLaps: number | undefined = s?.totalLaps ?? s?.laps;
  if (typeof totalLaps === "number") {
    stats.push({ label: "Кругов", value: String(totalLaps) });
  }

  return stats;
}

// ────────────────────────────────────────────────────────────────────────────
// buildResultRows
// ────────────────────────────────────────────────────────────────────────────

export function buildResultRows(session: unknown): SessionResultRowView[] {
  const s = session as AnySession;
  const rawResults: AnyLap[] = Array.isArray(s?.results) ? s.results : [];

  let minBestLapMs: number | null = null;
  for (const r of rawResults) {
    const ms = typeof r.bestLapMs === "number" ? r.bestLapMs : null;
    if (ms !== null && ms > 0 && (minBestLapMs === null || ms < minBestLapMs)) {
      minBestLapMs = ms;
    }
  }

  return rawResults.map((r, idx) => {
    const bestLapMs = typeof r.bestLapMs === "number" && r.bestLapMs > 0 ? r.bestLapMs : null;

    const bestLapTime =
      bestLapMs !== null
        ? formatLap(bestLapMs)
        : r.bestLapTime
          ? String(r.bestLapTime)
          : typeof r.bestLapTimeSeconds === "number"
            ? formatLap(r.bestLapTimeSeconds * 1000)
            : "—";

    let gapFormatted: string | null = null;
    if (r.gap != null) {
      const gapVal = Number(r.gap);
      gapFormatted = gapVal > 0 ? formatGap(gapVal) : null;
    } else if (bestLapMs !== null && minBestLapMs !== null && bestLapMs > minBestLapMs) {
      gapFormatted = formatGap((bestLapMs - minBestLapMs) / 1000);
    }

    let intervalFormatted: string | null = null;
    if (r.interval != null) {
      const intervalVal = Number(r.interval);
      intervalFormatted = intervalVal > 0 ? formatGap(intervalVal) : null;
    } else if (idx > 0 && bestLapMs !== null) {
      const prevMs =
        typeof rawResults[idx - 1].bestLapMs === "number" && rawResults[idx - 1].bestLapMs > 0
          ? (rawResults[idx - 1].bestLapMs as number)
          : null;
      if (prevMs !== null && bestLapMs > prevMs) {
        intervalFormatted = formatGap((bestLapMs - prevMs) / 1000);
      }
    }

    const pitStops: number | null =
      typeof r.pitStops === "number" ? r.pitStops : typeof r.pitstops === "number" ? r.pitstops : null;

    const totalLaps: number | null =
      typeof r.totalLaps === "number" ? r.totalLaps : typeof r.laps === "number" ? r.laps : null;

    const teamName: string | null =
      r.teamName && r.teamName !== "—" ? r.teamName : r.team && r.team !== "—" ? r.team : null;

    const finishStatus: string | null =
      r.finishStatus && r.finishStatus.trim()
        ? r.finishStatus.trim()
        : r.status && r.status.trim()
          ? r.status.trim()
          : null;

    const carClass: string | null = r.carClass && String(r.carClass).trim() ? String(r.carClass).trim() : null;

    return {
      position: r.position ?? idx + 1,
      driverName: String(r.driverName ?? r.driver ?? "—"),
      carNumber: r.carNumber ?? r.number ?? "",
      teamName,
      carModel: r.carModel ?? r.car ?? null,
      bestLapTime,
      gap: gapFormatted,
      interval: intervalFormatted,
      pitStops,
      totalLaps,
      finishStatus,
      isPlayer: r.isPlayer ?? null,
      carClass,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// buildLapProgressSeries
// ────────────────────────────────────────────────────────────────────────────

export function buildLapProgressSeries(laps: unknown[]): LapProgressSeries[] {
  const map = new Map<string, { driverName: string; carNumber: string | number; points: LapProgressPoint[] }>();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const key = driverKey(lap);
    const driverName = String(lap.driverName ?? lap.driver ?? "Unknown");
    const carNumber = lap.carNumber ?? lap.number ?? "";
    const lapNum = Number(lap.lapNumber ?? lap.lapNum ?? lap.lap ?? 0);
    const lapMs = parseLapMs(lap);

    if (!Number.isFinite(lapMs) || lapMs <= 0) continue;

    if (!map.has(key)) {
      map.set(key, { driverName, carNumber, points: [] });
    }
    // timeSeconds — числовое значение для оси графика (LapProgressChart), поэтому
    // остаётся в секундах; timeFormatted форматируется напрямую из lapMs, без
    // обратного умножения секунд на 1000.
    map.get(key)!.points.push({
      lap: lapNum,
      timeSeconds: lapMs / 1000,
      timeFormatted: formatLap(lapMs),
    });
  }

  return Array.from(map.values()).map(({ driverName, carNumber, points }) => ({
    driverName,
    carNumber,
    points: points.sort((a, b) => a.lap - b.lap),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// buildSectorSummary
// ────────────────────────────────────────────────────────────────────────────

export function buildSectorSummary(laps: unknown[]): DriverSectorSummary[] {
  const map = new Map<
    string,
    {
      driverName: string;
      carNumber: string | number;
      bestSMs: [number, number, number];
    }
  >();

  const absoluteBestMs: [number, number, number] = [Infinity, Infinity, Infinity];

  for (const raw of laps) {
    const lap = raw as AnyLap;
    if (isPitLap(lap)) continue; // пит-лапы не должны выигрывать "лучший сектор"
    const key = driverKey(lap);
    const driverName = String(lap.driverName ?? lap.driver ?? "Unknown");
    const carNumber = lap.carNumber ?? lap.number ?? "";

    const s1 = parseSectorMs(lap.sector1Ms, lap.sector1, lap.s1);
    const s2 = parseSectorMs(lap.sector2Ms, lap.sector2, lap.s2);
    const s3 = parseSectorMs(lap.sector3Ms, lap.sector3, lap.s3);

    if (!map.has(key)) {
      map.set(key, { driverName, carNumber, bestSMs: [Infinity, Infinity, Infinity] });
    }
    const entry = map.get(key)!;

    if (Number.isFinite(s1) && s1 < entry.bestSMs[0]) entry.bestSMs[0] = s1;
    if (Number.isFinite(s2) && s2 < entry.bestSMs[1]) entry.bestSMs[1] = s2;
    if (Number.isFinite(s3) && s3 < entry.bestSMs[2]) entry.bestSMs[2] = s3;

    if (Number.isFinite(s1) && s1 < absoluteBestMs[0]) absoluteBestMs[0] = s1;
    if (Number.isFinite(s2) && s2 < absoluteBestMs[1]) absoluteBestMs[1] = s2;
    if (Number.isFinite(s3) && s3 < absoluteBestMs[2]) absoluteBestMs[2] = s3;
  }

  return Array.from(map.values()).map(({ driverName, carNumber, bestSMs }) => {
    // fix: раньше отсутствующий сектор (bestSMs[i] всё ещё Infinity) тихо
    // заменялся на 0 в сумме — получался правдоподобный, но заниженный
    // "теоретический" круг из 2 секторов вместо 3. Теперь при неполном
    // наборе секторов результат — NaN, что formatLap корректно рисует как «—».
    const hasAllSectors = bestSMs.every((s) => Number.isFinite(s));
    const theoreticalMs = hasAllSectors ? bestSMs[0] + bestSMs[1] + bestSMs[2] : NaN;
    // SD-21: Абсолютный лучший по КАЖДОМУ сектору отдельно (не общий флаг) —
    // используется, чтобы красить именно тот сектор, который является рекордом сессии.
    const sectorAbsoluteBest: [boolean, boolean, boolean] = [
      Number.isFinite(bestSMs[0]) && bestSMs[0] === absoluteBestMs[0],
      Number.isFinite(bestSMs[1]) && bestSMs[1] === absoluteBestMs[1],
      Number.isFinite(bestSMs[2]) && bestSMs[2] === absoluteBestMs[2],
    ];

    return {
      driverName,
      carNumber,
      bestSectors: [formatSector(bestSMs[0]), formatSector(bestSMs[1]), formatSector(bestSMs[2])] as [
        string,
        string,
        string,
      ],
      // Теоретический лучший — сумма трёх лучших секторов, т.е. это круговое время, не сектор.
      theoreticalBest: formatLap(theoreticalMs),
      sectorAbsoluteBest,
      hasAbsoluteBest: sectorAbsoluteBest.some(Boolean),
    };
  });
}

// ────────────────────────────────────────────────────────────────────────────
// buildDriverLapGroups
// ────────────────────────────────────────────────────────────────────────────

export function buildDriverLapGroups(laps: unknown[]): DriverLapsGroupView[] {
  const map = new Map<
    string,
    {
      driverName: string;
      carNumber: string | number;
      isPlayer: number | null;
      rawLaps: AnyLap[];
    }
  >();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const key = driverKey(lap);
    const driverName = String(lap.driverName ?? lap.driver ?? "Unknown");
    const carNumber = lap.carNumber ?? lap.number ?? "";
    const isPlayer: number | null = lap.isPlayer ?? null;
    if (!map.has(key)) map.set(key, { driverName, carNumber, isPlayer, rawLaps: [] });
    map.get(key)!.rawLaps.push(lap);
  }

  let overallBestMs = Infinity;
  // SD-21: Абсолютный лучший сектор среди ВСЕХ пилотов сессии (по каждому из трёх).
  const overallBestSectorsMs: [number, number, number] = [Infinity, Infinity, Infinity];
  for (const { rawLaps } of map.values()) {
    for (const lap of rawLaps) {
      if (isPitLap(lap)) continue; // пит-лапы не должны выигрывать лучший круг/сектор сессии
      const t = parseLapMs(lap);
      if (Number.isFinite(t) && t < overallBestMs) overallBestMs = t;

      const s1 = parseSectorMs(lap.sector1Ms, lap.sector1, lap.s1);
      const s2 = parseSectorMs(lap.sector2Ms, lap.sector2, lap.s2);
      const s3 = parseSectorMs(lap.sector3Ms, lap.sector3, lap.s3);
      if (Number.isFinite(s1) && s1 < overallBestSectorsMs[0]) overallBestSectorsMs[0] = s1;
      if (Number.isFinite(s2) && s2 < overallBestSectorsMs[1]) overallBestSectorsMs[1] = s2;
      if (Number.isFinite(s3) && s3 < overallBestSectorsMs[2]) overallBestSectorsMs[2] = s3;
    }
  }

  const groups: DriverLapsGroupView[] = [];

  for (const { driverName, carNumber, isPlayer, rawLaps } of map.values()) {
    let personalBestMs = Infinity;
    // SD-21: Личный лучший сектор пилота за сессию (по каждому из трёх).
    const personalBestSectorsMs: [number, number, number] = [Infinity, Infinity, Infinity];
    for (const lap of rawLaps) {
      if (isPitLap(lap)) continue; // пит-лапы не должны выигрывать личный лучший круг/сектор
      const t = parseLapMs(lap);
      if (Number.isFinite(t) && t < personalBestMs) personalBestMs = t;

      const s1 = parseSectorMs(lap.sector1Ms, lap.sector1, lap.s1);
      const s2 = parseSectorMs(lap.sector2Ms, lap.sector2, lap.s2);
      const s3 = parseSectorMs(lap.sector3Ms, lap.sector3, lap.s3);
      if (Number.isFinite(s1) && s1 < personalBestSectorsMs[0]) personalBestSectorsMs[0] = s1;
      if (Number.isFinite(s2) && s2 < personalBestSectorsMs[1]) personalBestSectorsMs[1] = s2;
      if (Number.isFinite(s3) && s3 < personalBestSectorsMs[2]) personalBestSectorsMs[2] = s3;
    }

    const lapRows: DriverLapRowView[] = rawLaps
      .sort((a, b) => Number(a.lapNumber ?? a.lapNum ?? a.lap ?? 0) - Number(b.lapNumber ?? b.lapNum ?? b.lap ?? 0))
      .map((lap) => {
        const lapMs = parseLapMs(lap);
        const s1 = parseSectorMs(lap.sector1Ms, lap.sector1, lap.s1);
        const s2 = parseSectorMs(lap.sector2Ms, lap.sector2, lap.s2);
        const s3 = parseSectorMs(lap.sector3Ms, lap.sector3, lap.s3);

        // SD-18: Максимальная скорость и остаток топлива
        const maxSpeedRaw = extractMaxSpeedRaw(lap);
        const fuelRaw = extractFuelRaw(lap);

        return {
          lapNumber: Number(lap.lapNumber ?? lap.lapNum ?? lap.lap ?? 0),
          lapTime: formatLap(lapMs),
          isPersonalBest: Number.isFinite(lapMs) && lapMs === personalBestMs,
          isOverallBest: Number.isFinite(lapMs) && lapMs === overallBestMs,
          sectors: [formatSector(s1), formatSector(s2), formatSector(s3)] as [string, string, string],
          // SD-21: Личный лучший / абсолютный лучший сектор сессии, по каждому сектору
          sectorsPersonalBest: [
            Number.isFinite(s1) && s1 === personalBestSectorsMs[0],
            Number.isFinite(s2) && s2 === personalBestSectorsMs[1],
            Number.isFinite(s3) && s3 === personalBestSectorsMs[2],
          ] as [boolean, boolean, boolean],
          sectorsAbsoluteBest: [
            Number.isFinite(s1) && s1 === overallBestSectorsMs[0],
            Number.isFinite(s2) && s2 === overallBestSectorsMs[1],
            Number.isFinite(s3) && s3 === overallBestSectorsMs[2],
          ] as [boolean, boolean, boolean],
          isPitLap: Boolean(lap.isPitLap ?? lap.pitLap ?? false),
          // SD-18: Новые поля — имена взяты из реальной схемы session_laps
          maxSpeed: formatSpeed(maxSpeedRaw),
          fuelRemaining: formatFuelPercent(fuelRaw),
          tyreWear: parseTyreWear(lap),
          tyreType: parseTyreType(lap),
        };
      });

    // SD-19: Агрегированная статистика по кругам — для карточки деталей пилота.
    // rawLaps уже отсортированы по номеру круга (sort() выше мутирует массив).
    const sortedRawLaps = rawLaps as AnyLap[];
    const timedLaps = sortedRawLaps.filter((lap: AnyLap) => {
      const t = parseLapMs(lap);
      return Number.isFinite(t) && t > 0;
    });
    // Пит-лапы искажают среднее/худшее время — считаем без них,
    // но если все круги были пит-лапами, используем все круги как fallback.
    const nonPitTimedLaps = timedLaps.filter((lap: AnyLap) => !isPitLap(lap));
    const lapsForAvg = nonPitTimedLaps.length > 0 ? nonPitTimedLaps : timedLaps;
    const lapMsValues: number[] = lapsForAvg.map((lap: AnyLap) => parseLapMs(lap));
    const avgMs =
      lapMsValues.length > 0 ? lapMsValues.reduce((sum: number, t: number) => sum + t, 0) / lapMsValues.length : NaN;
    const worstMs = lapMsValues.length > 0 ? Math.max(...lapMsValues) : NaN;

    let maxSpeedRawAgg = -Infinity;
    const tyreTypesUsed = new Set<string>();
    for (const lap of sortedRawLaps) {
      const speed = Number(extractMaxSpeedRaw(lap));
      if (Number.isFinite(speed) && speed > maxSpeedRawAgg) maxSpeedRawAgg = speed;
      const tyre = parseTyreType(lap);
      if (tyre !== "—") tyreTypesUsed.add(tyre);
    }

    const fuelStartRaw = sortedRawLaps.length > 0 ? extractFuelRaw(sortedRawLaps[0]) : null;
    const fuelEndRaw = sortedRawLaps.length > 0 ? extractFuelRaw(sortedRawLaps[sortedRawLaps.length - 1]) : null;

    const pitLapsCount = sortedRawLaps.filter((lap: AnyLap) => Boolean(lap.isPitLap ?? lap.pitLap ?? false)).length;

    groups.push({
      driverName,
      carNumber,
      isPlayer,
      bestLapTime: formatLap(personalBestMs),
      laps: lapRows,
      avgLapTime: formatLap(avgMs),
      worstLapTime: formatLap(worstMs),
      maxSpeedObserved: formatSpeed(Number.isFinite(maxSpeedRawAgg) ? maxSpeedRawAgg : null),
      tyreTypesUsed: Array.from(tyreTypesUsed),
      fuelStart: formatFuelPercent(fuelStartRaw),
      fuelEnd: formatFuelPercent(fuelEndRaw),
      pitLapsCount,
    });
  }

  return groups;
}

// ────────────────────────────────────────────────────────────────────────────
// buildTabs — вкладка «Секторы» восстановлена
// ────────────────────────────────────────────────────────────────────────────

/** Формирует список вкладок страницы с учётом наличия данных о кругах. */
export function buildTabs(
  hasLapData: boolean,
  labels: { results: string; laps: string; lapProgress: string },
): SessionTabItem[] {
  const allTabs: SessionTabItem[] = [
    { key: "results", label: labels.results },
    { key: "laps", label: labels.laps, requiresLapData: true },
    { key: "lapProgress", label: labels.lapProgress, requiresLapData: true },
  ];
  return allTabs.filter((t) => !t.requiresLapData || hasLapData);
}
