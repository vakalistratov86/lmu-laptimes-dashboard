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

// ───────────────────────────────────────────────────────────────────────────────
// Вспомогательные утилиты
// ───────────────────────────────────────────────────────────────────────────────

/** Форматирует миллисекунды (integer) в строку «M:SS.mmm». */
export function formatLapMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const ss = Math.floor(s).toString().padStart(2, '0');
  const msStr = Math.round((s % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${m}:${ss}.${msStr}`;
}

/** Форматирует секунды (float) в строку «M:SS.mmm». */
export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return formatLapMs(seconds * 1000);
}

/**
 * Универсальный парсинг времени сектора.
 * Поле «*Ms» хранит значение в миллисекундах, остальные — в секундах.
 * Возвращает значение в СЕКУНДАХ для дальнейшего использования с formatLapTime.
 */
function parseSectorSeconds(
  msProp: unknown,
  secProp: unknown,
  shortProp: unknown,
): number {
  // Приоритет: *Ms-поле (миллисекунды) → делим на 1000
  const ms = Number(msProp);
  if (Number.isFinite(ms) && ms > 0) return ms / 1000;
  // Запасные поля: предполагаем секунды
  const sec = Number(secProp ?? shortProp);
  if (Number.isFinite(sec) && sec > 0) return sec;
  return NaN;
}

/** Форматирует отставание (gap) в секундах в строку «+X.XXX». */
export function formatGap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return `+${seconds.toFixed(3)}`;
}

// ───────────────────────────────────────────────────────────────────────────────
// normalizeSessionType
// ───────────────────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────────────────
// buildHeroStats
// ───────────────────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────────────────
// buildResultRows
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Трансформирует сырой массив результатов сессии в массив строк таблицы.
 * Пробрасывает isPlayer напрямую из данных, без сравнения имён.
 *
 * fix: поля в БД называются r.laps, r.pitstops, r.team — добавлены явные
 * алиасы для корректного маппинга; пустые строки нормализуются в null.
 */
export function buildResultRows(session: unknown): SessionResultRowView[] {
  const s = session as AnySession;
  const rawResults: AnyLap[] = Array.isArray(s?.results) ? s.results : [];

  let minBestLapMs: number | null = null;
  for (const r of rawResults) {
    const ms = typeof r.bestLapMs === 'number' ? r.bestLapMs : null;
    if (ms !== null && ms > 0 && (minBestLapMs === null || ms < minBestLapMs)) {
      minBestLapMs = ms;
    }
  }

  return rawResults.map((r, idx) => {
    const bestLapMs = typeof r.bestLapMs === 'number' && r.bestLapMs > 0
      ? r.bestLapMs
      : null;

    const bestLapTime = bestLapMs !== null
      ? formatLapMs(bestLapMs)
      : r.bestLapTime
        ? String(r.bestLapTime)
        : typeof r.bestLapTimeSeconds === 'number'
          ? formatLapTime(r.bestLapTimeSeconds)
          : '—';

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
      const prevMs = typeof rawResults[idx - 1].bestLapMs === 'number' && rawResults[idx - 1].bestLapMs > 0
        ? rawResults[idx - 1].bestLapMs as number
        : null;
      if (prevMs !== null && bestLapMs > prevMs) {
        intervalFormatted = formatGap((bestLapMs - prevMs) / 1000);
      }
    }

    // fix: в схеме БД поле называется r.pitstops (не r.pitStops)
    const pitStops: number | null =
      typeof r.pitStops === 'number' ? r.pitStops :
      typeof r.pitstops === 'number' ? r.pitstops :
      null;

    // fix: в схеме БД поле называется r.laps (не r.totalLaps)
    const totalLaps: number | null =
      typeof r.totalLaps === 'number' ? r.totalLaps :
      typeof r.laps === 'number' ? r.laps :
      null;

    // fix: teamName передаётся через enrichSession; пустая строка нормализуется в null
    const teamName: string | null =
      (r.teamName && r.teamName !== '—') ? r.teamName :
      (r.team && r.team !== '—') ? r.team :
      null;

    // fix: finishStatus — пустая строка нормализуется в null
    const finishStatus: string | null =
      (r.finishStatus && r.finishStatus.trim()) ? r.finishStatus.trim() :
      (r.status && r.status.trim()) ? r.status.trim() :
      null;

    return {
      position: r.position ?? idx + 1,
      driverName: String(r.driverName ?? r.driver ?? '—'),
      carNumber: r.carNumber ?? r.number ?? '',
      teamName,
      carModel: r.carModel ?? r.car ?? null,
      bestLapTime,
      gap: gapFormatted,
      interval: intervalFormatted,
      pitStops,
      totalLaps,
      finishStatus,
      isPlayer: r.isPlayer ?? null,
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// buildLapProgressSeries
// ───────────────────────────────────────────────────────────────────────────────

/** Строит серии для графика прогресса по кругам, группируя по пилотам. */
export function buildLapProgressSeries(laps: unknown[]): LapProgressSeries[] {
  const map = new Map<string, { carNumber: string | number; points: LapProgressPoint[] }>();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';
    const lapNum = Number(lap.lapNumber ?? lap.lapNum ?? lap.lap ?? 0);
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

// ───────────────────────────────────────────────────────────────────────────────
// buildSectorSummary
// ───────────────────────────────────────────────────────────────────────────────

/** Вычисляет лучшие сектора и теоретически лучший круг для каждого пилота. */
export function buildSectorSummary(laps: unknown[]): DriverSectorSummary[] {
  const map = new Map<
    string,
    {
      carNumber: string | number;
      bestS: [number, number, number];
    }
  >();

  const absoluteBest: [number, number, number] = [Infinity, Infinity, Infinity];

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';

    // parseSectorSeconds корректно обрабатывает и Ms-поля и поля в секундах
    const s1 = parseSectorSeconds(lap.sector1Ms, lap.sector1, lap.s1);
    const s2 = parseSectorSeconds(lap.sector2Ms, lap.sector2, lap.s2);
    const s3 = parseSectorSeconds(lap.sector3Ms, lap.sector3, lap.s3);

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

// ───────────────────────────────────────────────────────────────────────────────
// buildDriverLapGroups
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Группирует все круги по пилотам и определяет personal / overall best.
 * Пробрасывает isPlayer напрямую из данных первого круга пилота.
 * fix: добавлена поддержка поля lapNum (имя поля в session_laps) наряду с lapNumber.
 */
export function buildDriverLapGroups(laps: unknown[]): DriverLapsGroupView[] {
  const map = new Map<
    string,
    {
      carNumber: string | number;
      isPlayer: number | null;
      rawLaps: AnyLap[];
    }
  >();

  for (const raw of laps) {
    const lap = raw as AnyLap;
    const driver = String(lap.driverName ?? lap.driver ?? 'Unknown');
    const carNumber = lap.carNumber ?? lap.number ?? '';
    const isPlayer: number | null = lap.isPlayer ?? null;
    if (!map.has(driver)) map.set(driver, { carNumber, isPlayer, rawLaps: [] });
    map.get(driver)!.rawLaps.push(lap);
  }

  let overallBestSeconds = Infinity;
  for (const { rawLaps } of map.values()) {
    for (const lap of rawLaps) {
      const t = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
      if (Number.isFinite(t) && t < overallBestSeconds) overallBestSeconds = t;
    }
  }

  const groups: DriverLapsGroupView[] = [];

  for (const [driverName, { carNumber, isPlayer, rawLaps }] of map.entries()) {
    let personalBestSeconds = Infinity;
    for (const lap of rawLaps) {
      const t = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
      if (Number.isFinite(t) && t < personalBestSeconds) personalBestSeconds = t;
    }

    const lapRows: DriverLapRowView[] = rawLaps
      // fix: поддержка lapNum (session_laps) и lapNumber (legacy)
      .sort((a, b) => Number(a.lapNumber ?? a.lapNum ?? a.lap ?? 0) - Number(b.lapNumber ?? b.lapNum ?? b.lap ?? 0))
      .map((lap) => {
        const timeSeconds = Number(lap.lapTimeSeconds ?? lap.time ?? NaN);
        // Используем parseSectorSeconds для корректной обработки Ms-полей
        const s1 = parseSectorSeconds(lap.sector1Ms, lap.sector1, lap.s1);
        const s2 = parseSectorSeconds(lap.sector2Ms, lap.sector2, lap.s2);
        const s3 = parseSectorSeconds(lap.sector3Ms, lap.sector3, lap.s3);

        return {
          // fix: поддержка lapNum (session_laps) и lapNumber (legacy)
          lapNumber: Number(lap.lapNumber ?? lap.lapNum ?? lap.lap ?? 0),
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
      isPlayer,
      bestLapTime: Number.isFinite(personalBestSeconds)
        ? formatLapTime(personalBestSeconds)
        : '—',
      laps: lapRows,
    });
  }

  return groups;
}

// ───────────────────────────────────────────────────────────────────────────────
// buildTabs
// ───────────────────────────────────────────────────────────────────────────────

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
