/**
 * SD-3: Чистые селекторы / билдеры для частей SessionDetailViewModel.
 * Файл не импортирует React / JSX.
 */
import type {
  SessionHeroStatItem,
  SessionResultRowView,
  DriverLapsGroupView,
  DriverLapRowView,
  DriverSectorSummary,
  LapProgressSeries,
  LapProgressPoint,
  SessionTabItem,
} from '@/components/session-detail/types';
import type { NormalizedSessionType } from './sessionDetail.types';

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные утилиты
// ─────────────────────────────────────────────────────────────────────────────

/** Форматирует секунды (float) в строку «M:SS.mmm». */
export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const ss = Math.floor(s).toString().padStart(2, '0');
  const ms = Math.round((s % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${m}:${ss}.${ms}`;
}

/** Форматирует отставание (gap) в секундах в строку «+X.XXX». */
export function formatGap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return `+${seconds.toFixed(3)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeSessionType
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TYPE_MAP: Record<string, NormalizedSessionType> = {
  race: 'race',
  race1: 'race',
  race2: 'race',
  qualify: 'qualify',
  qualifying: 'qualify',
  superpole: 'superpole',
  'superpole race': 'race',
  warmup: 'warmup',
  practice: 'practice',
  fp1: 'practice',
  fp2: 'practice',
  fp3: 'practice',
};

/**
 * Нормализует сырую строку типа сессии в одно из пяти значений.
 * Неизвестные типы трактуются как 'practice'.
 */
export function normalizeSessionType(raw: string): NormalizedSessionType {
  const key = raw.trim().toLowerCase();
  return SESSION_TYPE_MAP[key] ?? 'practice';
}

// ─────────────────────────────────────────────────────────────────────────────
// buildHeroStats
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySession = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLap = Record<string, any>;

/**
 * Формирует массив KPI-метрик для герой-блока.
 * Определяет победителя / polesitter и fastest lap.
 */
export function buildHeroStats(session: unknown): SessionHeroStatItem[] {
  const s = session as AnySession;
  const normalized = normalizeSessionType(String(s?.sessionType ?? ''));
  const stats: SessionHeroStatItem[] = [];

  const winner: string | undefined = s?.winner ?? s?.results?.[0]?.driverName;
  if (winner) {
    stats.push({
      label: normalized === 'race' ? 'Победитель' : 'Polesitter',
      value: winner,
      subLabel: s?.results?.[0]?.teamName ?? null,
    });
  }

  const fastestLap: string | undefined = s?.fastestLap?.time ?? s?.fastestLapTime;
  const fastestDriver: string | undefined = s?.fastestLap?.driverName;
  if (fastestLap) {
    stats.push({
      label: 'Fastest Lap',
      value: fastestLap,
      subLabel: fastestDriver ?? null,
    });
  }

  const totalLaps: number | undefined = s?.totalLaps ?? s?.laps;
  if (typeof totalLaps === 'number') {
    stats.push({ label: 'Кругов', value: String(totalLaps) });
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildResultRows
// ─────────────────────────────────────────────────────────────────────────────

/** Трансформирует сырой массив результатов сессии в массив строк таблицы. */
export function buildResultRows(session: unknown): SessionResultRowView[] {
  const s = session as AnySession;
  const rawResults: AnyLap[] = Array.isArray(s?.results) ? s.results : [];

  return rawResults.map((r, idx) => ({
    position: r.position ?? idx + 1,
    driverName: String(r.driverName ?? r.driver ?? '—'),
    carNumber: r.carNumber ?? r.number ?? '',
    teamName: r.teamName ?? r.team ?? null,
    carModel: r.carModel ?? r.car ?? null,
    bestLapTime: r.bestLapTime
      ? String(r.bestLapTime)
      : typeof r.bestLapTimeSeconds === 'number'
        ? formatLapTime(r.bestLapTimeSeconds)
        : '—',
    gap: r.gap != null ? formatGap(Number(r.gap)) : null,
    interval: r.interval != null ? formatGap(Number(r.interval)) : null,
    pitStops: r.pitStops ?? null,
    totalLaps: r.totalLaps ?? r.laps ?? null,
    finishStatus: r.finishStatus ?? r.status ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildLapProgressSeries
// ─────────────────────────────────────────────────────────────────────────────

/** Строит серии для графика прогресса по кругам, группируя по пилотам. */
export function buildLapProgressSeries(laps: unknown[]): LapProgressSeries[] {
  const map = new Map<string, { carNumber: string | number; points: LapProgressPoint[] }>();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';
    const lapNum = Number(lap.lapNumber ?? lap.lap ?? 0);
    const timeSeconds = Number(lap.lapTimeSeconds ?? lap.time ?? 0);

    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) continue;

    if (!map.has(driver)) {
      map.set(driver, { carNumber, points: [] });
    }
    map.get(driver)!.points.push({
      lap: lapNum,
      timeSeconds,
      timeFormatted: formatLapTime(timeSeconds),
    });
  }

  return Array.from(map.entries()).map(([driverName, { carNumber, points }]) => ({
    driverName,
    carNumber,
    points: points.sort((a, b) => a.lap - b.lap),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSectorSummary
// ─────────────────────────────────────────────────────────────────────────────

/** Вычисляет лучшие секторы и теоретически лучший круг для каждого пилота. */
export function buildSectorSummary(laps: unknown[]): DriverSectorSummary[] {
  const map = new Map<
    string,
    {
      carNumber: string | number;
      bestS: [number, number, number];
    }
  >();

  // Абсолютные лучшие секторы в сессии
  const absoluteBest: [number, number, number] = [Infinity, Infinity, Infinity];

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';
    const s1 = Number(lap.sector1 ?? lap.s1 ?? NaN);
    const s2 = Number(lap.sector2 ?? lap.s2 ?? NaN);
    const s3 = Number(lap.sector3 ?? lap.s3 ?? NaN);

    if (!map.has(driver)) {
      map.set(driver, { carNumber, bestS: [Infinity, Infinity, Infinity] });
    }
    const entry = map.get(driver)!;

    if (Number.isFinite(s1) && s1 < entry.bestS[0]) entry.bestS[0] = s1;
    if (Number.isFinite(s2) && s2 < entry.bestS[1]) entry.bestS[1] = s2;
    if (Number.isFinite(s3) && s3 < entry.bestS[2]) entry.bestS[2] = s3;

    if (Number.isFinite(s1) && s1 < absoluteBest[0]) absoluteBest[0] = s1;
    if (Number.isFinite(s2) && s2 < absoluteBest[1]) absoluteBest[1] = s2;
    if (Number.isFinite(s3) && s3 < absoluteBest[2]) absoluteBest[2] = s3;
  }

  return Array.from(map.entries()).map(([driverName, { carNumber, bestS }]) => {
    const theoreticalSeconds = bestS.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
    const hasAbsoluteBest =
      bestS[0] === absoluteBest[0] ||
      bestS[1] === absoluteBest[1] ||
      bestS[2] === absoluteBest[2];

    return {
      driverName,
      carNumber,
      bestSectors: [
        formatLapTime(bestS[0]),
        formatLapTime(bestS[1]),
        formatLapTime(bestS[2]),
      ] as [string, string, string],
      theoreticalBest: formatLapTime(theoreticalSeconds),
      hasAbsoluteBest,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// buildDriverLapGroups
// ─────────────────────────────────────────────────────────────────────────────

/** Группирует все круги по пилотам и определяет personal / overall best. */
export function buildDriverLapGroups(laps: unknown[]): DriverLapsGroupView[] {
  const map = new Map<
    string,
    {
      carNumber: string | number;
      rawLaps: AnyLap[];
    }
  >();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';
    if (!map.has(driver)) map.set(driver, { carNumber, rawLaps: [] });
    map.get(driver)!.rawLaps.push(lap);
  }

  // Абсолютный лучший круг сессии
  let overallBestSeconds = Infinity;
  for (const { rawLaps } of map.values()) {
    for (const lap of rawLaps) {
      const t = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
      if (Number.isFinite(t) && t < overallBestSeconds) overallBestSeconds = t;
    }
  }

  const groups: DriverLapsGroupView[] = [];

  for (const [driverName, { carNumber, rawLaps }] of map.entries()) {
    let personalBestSeconds = Infinity;
    for (const lap of rawLaps) {
      const t = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
      if (Number.isFinite(t) && t < personalBestSeconds) personalBestSeconds = t;
    }

    const lapRows: DriverLapRowView[] = rawLaps
      .sort((a, b) => Number(a.lapNumber ?? a.lap ?? 0) - Number(b.lapNumber ?? b.lap ?? 0))
      .map((lap) => {
        const timeSeconds = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
        const s1 = Number(lap.sector1 ?? lap.s1 ?? NaN);
        const s2 = Number(lap.sector2 ?? lap.s2 ?? NaN);
        const s3 = Number(lap.sector3 ?? lap.s3 ?? NaN);

        return {
          lapNumber: Number(lap.lapNumber ?? lap.lap ?? 0),
          lapTime: Number.isFinite(timeSeconds) ? formatLapTime(timeSeconds) : '—',
          isPersonalBest:
            Number.isFinite(timeSeconds) && timeSeconds === personalBestSeconds,
          isOverallBest:
            Number.isFinite(timeSeconds) && timeSeconds === overallBestSeconds,
          sectors: [
            Number.isFinite(s1) ? formatLapTime(s1) : '—',
            Number.isFinite(s2) ? formatLapTime(s2) : '—',
            Number.isFinite(s3) ? formatLapTime(s3) : '—',
          ] as [string, string, string],
          isPitLap: Boolean(lap.isPitLap ?? lap.pitLap ?? false),
        };
      });

    groups.push({
      driverName,
      carNumber,
      bestLapTime: Number.isFinite(personalBestSeconds)
        ? formatLapTime(personalBestSeconds)
        : '—',
      laps: lapRows,
    });
  }

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTabs
// ─────────────────────────────────────────────────────────────────────────────

/** Формирует список вкладок страницы с учётом наличия данных о кругах. */
export function buildTabs(hasLapData: boolean): SessionTabItem[] {
  const allTabs: SessionTabItem[] = [
    { key: 'results', label: 'Результаты' },
    { key: 'laps', label: 'Круги', requiresLapData: true },
    { key: 'sectors', label: 'Секторы', requiresLapData: true },
    { key: 'lapProgress', label: 'Прогресс', requiresLapData: true },
  ];
  return allTabs.filter((t) => !t.requiresLapData || hasLapData);
}
