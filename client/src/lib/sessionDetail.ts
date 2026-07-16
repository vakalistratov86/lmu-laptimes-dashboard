/**
 * SD-4: Агрегатор view-model для страницы SessionDetail.
 * Единственная точка входа: buildSessionDetailViewModel.
 */
import type { SessionDetailViewModel } from './sessionDetail.types';
import {
  normalizeSessionType,
  buildHeroStats,
  buildResultRows,
  buildLapProgressSeries,
  buildSectorSummary,
  buildDriverLapGroups,
  buildTabs,
} from './sessionDetailSelectors';

// ─────────────────────────────────────────────────────────────────────────────
// Параметры
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildSessionDetailViewModelParams {
  /** Сырой объект сессии (из API / store). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: Record<string, any>;
  /** Массив сырых объектов кругов для данной сессии. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  laps: Record<string, any>[];
  /** URL для кнопки «Назад». */
  backHref: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Основная функция
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Собирает полный `SessionDetailViewModel` из сырых данных.
 *
 * @example
 * const vm = buildSessionDetailViewModel({ session, laps, backHref: '/sessions' });
 */
export function buildSessionDetailViewModel(
  params: BuildSessionDetailViewModelParams,
): SessionDetailViewModel {
  const { session, laps, backHref } = params;

  const hasLapData = Array.isArray(laps) && laps.length > 0;

  const normalizedSessionType = normalizeSessionType(
    String(session.sessionType ?? session.type ?? ''),
  );

  // Форматирование даты и времени
  const dateTimeLabel = session.dateTime
    ? new Date(session.dateTime).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : String(session.date ?? session.dateLabel ?? '—');

  return {
    header: {
      backHref,
      sessionType: String(session.sessionType ?? session.type ?? ''),
      normalizedSessionType,
      trackName: String(session.trackName ?? session.track ?? '—'),
      courseLabel: session.courseLabel ?? session.course ?? null,
      dateTimeLabel,
      eventName: session.eventName ?? session.championship ?? null,
    },

    heroStats: buildHeroStats(session),
    results: buildResultRows(session),
    tabs: buildTabs(hasLapData),
    lapProgress: hasLapData ? buildLapProgressSeries(laps) : [],
    sectors: hasLapData ? buildSectorSummary(laps) : [],
    driverLaps: hasLapData ? buildDriverLapGroups(laps) : [],
    hasLapData,
  };
}
