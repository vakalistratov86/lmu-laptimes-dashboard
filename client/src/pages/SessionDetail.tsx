/**
 * SD-11: Рефакторинг страницы SessionDetail.
 * Страница теперь — оркестратор данных; вся разметка вынесена в компоненты.
 *
 * SD-15: Фильтр по пилоту.
 * Клик по строке в таблице результатов устанавливает selectedDriver.
 * Вкладки «Круги» и «Секторы» передают этот фильтр в дочерние компоненты.
 *
 * SD-16 revert: Вкладка «Секторы» восстановлена.
 * SD-17: Вкладка «Круги» показывает таблицу напрямую (без аккордеона)
 *         когда выбран конкретный пилот.
 */
import { useMemo, useState } from 'react';
import { useRoute, useSearch } from 'wouter';
import { useSession, useSessionLaps } from '@/lib/api';
import { formatLap } from '@/lib/format';
import {
  buildHeroStats,
  buildResultRows,
  buildDriverLapGroups,
  buildLapProgressSeries,
  buildSectorSummary,
  buildTabs,
  normalizeSessionType,
} from '@/lib/sessionDetailSelectors';
import {
  SessionHeader,
  SessionHeroStats,
  SessionResultsTable,
  SessionTabs,
  SessionLoadingSkeleton,
  SessionEmptyState,
  DriverLapsAccordion,
  SessionLapProgressChart,
  SessionSectorsSummary,
} from '@/components/session-detail';
import type { SessionTabKey } from '@/components/session-detail';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SessionDetail() {
  const [, params] = useRoute('/sessions/:id');
  const searchString = useSearch();
  const backFilter = new URLSearchParams(searchString).get('from_filter');
  const backHref = backFilter
    ? `/sessions?filter=${encodeURIComponent(backFilter)}`
    : '/sessions';

  const id = params ? Number(params.id) : undefined;
  const { data: session, isLoading } = useSession(id);
  const { data: laps } = useSessionLaps(id);

  const [activeTab, setActiveTab] = useState<SessionTabKey>('results');

  // SD-15: выбранный пилот для фильтрации вкладок Круги / Секторы
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // ── Вычисляемые данные ────────────────────────────────────────────────────
  const hasLapData = (laps?.length ?? 0) > 0;

  const tabs = useMemo(() => buildTabs(hasLapData), [hasLapData]);

  const heroStats = useMemo(
    () => (session ? buildHeroStats(session) : []),
    [session],
  );

  const resultRows = useMemo(
    () => (session ? buildResultRows(session) : []),
    [session],
  );

  const lapGroups = useMemo(
    () => buildDriverLapGroups(laps ?? []),
    [laps],
  );

  const sectorRows = useMemo(
    () => buildSectorSummary(laps ?? []),
    [laps],
  );

  const progressSeries = useMemo(
    () => buildLapProgressSeries(laps ?? []),
    [laps],
  );

  // Fastest lap для выделения в таблице
  const fastestLapTime = useMemo(() => {
    if (!session) return null;
    const s = session as Record<string, any>;
    const results: Record<string, any>[] = Array.isArray(s.results) ? s.results : [];
    let min: number | null = null;
    for (const r of results) {
      const t = r.bestLapMs ?? null;
      if (typeof t === 'number' && (min === null || t < min)) min = t;
    }
    return min ? formatLap(min) : null;
  }, [session]);

  const playerName = useMemo(() => {
    if (!session) return null;
    const s = session as Record<string, any>;
    const results: Record<string, any>[] = Array.isArray(s.results) ? s.results : [];
    return results.find((r) => r.isPlayer === 1)?.driverName ?? null;
  }, [session]);

  // ── Состояния загрузки / ошибки ───────────────────────────────────────────
  if (isLoading) {
    return <SessionLoadingSkeleton />;
  }

  if (!session) {
    return <SessionEmptyState backHref={backHref} />;
  }

  const s = session as Record<string, any>;
  const sessionTypeNorm = normalizeSessionType(String(s.sessionType ?? ''));
  const courseLabel =
    s.course &&
    String(s.course).toLowerCase() !== String(s.trackName).toLowerCase()
      ? String(s.course)
      : null;

  return (
    <div className="space-y-5">
      {/* SD-5: Заголовок */}
      <SessionHeader
        trackName={String(s.trackName ?? '')}
        sessionType={String(s.sessionType ?? '')}
        sessionTypeNorm={sessionTypeNorm}
        dateFormatted={formatDate(String(s.dateTime ?? ''))}
        courseLabel={courseLabel}
        backHref={backHref}
      />

      {/* SD-6: KPI-блок */}
      <SessionHeroStats
        stats={heroStats}
        meta={{
          event: s.event,
          driverCount: s.driverCount,
          lapCount: s.lapCount,
          gameVersion: s.gameVersion,
        }}
      />

      {/* SD-8: Вкладки */}
      <SessionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Контент вкладок */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        className="space-y-4"
      >
        {/* SD-7: Таблица результатов */}
        {activeTab === 'results' && (
          <SessionResultsTable
            rows={resultRows}
            fastestLapTime={fastestLapTime}
            playerName={playerName}
            selectedDriver={selectedDriver}
            onSelectDriver={setSelectedDriver}
          />
        )}

        {/* SD-13 / SD-17: Круги — таблица без аккордеона если пилот выбран */}
        {activeTab === 'laps' && (
          <DriverLapsAccordion
            groups={lapGroups}
            driverFilter={selectedDriver}
          />
        )}

        {/* SD-12: Секторы — сводная таблица лучших секторов и теор. круга */}
        {activeTab === 'sectors' && (
          <SessionSectorsSummary
            rows={sectorRows}
            driverFilter={selectedDriver}
          />
        )}

        {/* SD-14: График прогресса */}
        {activeTab === 'lapProgress' && (
          <SessionLapProgressChart series={progressSeries} />
        )}
      </div>
    </div>
  );
}
