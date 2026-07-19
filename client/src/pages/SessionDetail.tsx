/**
 * SD-11: Рефакторинг страницы SessionDetail.
 * Страница теперь — оркестратор данных; вся разметка вынесена в компоненты.
 *
 * SD-20: Переработка дизайна страницы.
 * - Вкладка «Секторы» убрана (сектора остались только внутри карточки пилота).
 * - Вкладки Результаты / Круги / Прогресс встроены в шапку общей карточки
 *   (там, где раньше был заголовок «Итоговые результаты»).
 * - Карточка деталей пилота больше не закрывается: по умолчанию выбрана
 *   позиция 1, карточка видна на всех вкладках постоянно.
 * - SessionHeader + SessionHeroStats заменены единой статичной плиткой
 *   SessionInfoCard с информацией только о трассе и сессии (без данных
 *   пилотов) — она тоже видна на всех вкладках.
 */
import { useMemo, useState } from 'react';
import { useRoute, useSearch } from 'wouter';
import { useSession, useSessionLaps } from '@/lib/api';
import { formatLap } from '@/lib/format';
import {
  buildResultRows,
  buildDriverLapGroups,
  buildLapProgressSeries,
  buildSectorSummary,
  buildTabs,
  normalizeSessionType,
} from '@/lib/sessionDetailSelectors';
import {
  SessionInfoCard,
  SessionResultsTable,
  SessionDriverDetailCard,
  SessionTabs,
  SessionLoadingSkeleton,
  SessionEmptyState,
  DriverLapTable,
  SessionLapProgressChart,
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

  // SD-15/SD-20: Выбранный пилот для карточки деталей — всегда ровно один.
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // ── Вычисляемые данные ────────────────────────────────────────────────────
  const hasLapData = (laps?.length ?? 0) > 0;

  const tabs = useMemo(() => buildTabs(hasLapData), [hasLapData]);

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

  // SD-20: По умолчанию выбрана позиция 1 (resultRows уже отсортированы по
  // позиции) — без этого при первой отрисовке карточка была бы пустой.
  const effectiveSelectedDriver = selectedDriver ?? resultRows[0]?.driverName ?? null;

  // SD-19: Данные выбранного пилота для детальной карточки над таблицей
  const selectedResultRow = useMemo(
    () => resultRows.find((r) => r.driverName === effectiveSelectedDriver),
    [resultRows, effectiveSelectedDriver],
  );
  const selectedLapGroup = useMemo(
    () => lapGroups.find((g) => g.driverName === effectiveSelectedDriver),
    [lapGroups, effectiveSelectedDriver],
  );
  const selectedSectorSummary = useMemo(
    () => sectorRows.find((s) => s.driverName === effectiveSelectedDriver),
    [sectorRows, effectiveSelectedDriver],
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
  const trackLengthKm =
    typeof s.trackLengthM === 'number' && s.trackLengthM > 0
      ? (s.trackLengthM / 1000).toFixed(3)
      : null;

  return (
    <div className="space-y-5">
      {/* SD-20: Статичная плитка с информацией о трассе и сессии */}
      <SessionInfoCard
        trackName={String(s.trackName ?? '')}
        courseLabel={courseLabel}
        sessionType={String(s.sessionType ?? '')}
        sessionTypeNorm={sessionTypeNorm}
        dateFormatted={formatDate(String(s.dateTime ?? ''))}
        backHref={backHref}
        event={s.event}
        driverCount={s.driverCount}
        lapCount={s.lapCount}
        trackLengthKm={trackLengthKm}
        gameVersion={s.gameVersion}
      />

      {/* SD-20: Карточка деталей пилота — всегда видна, не зависит от вкладки */}
      {selectedResultRow && (
        <SessionDriverDetailCard
          row={selectedResultRow}
          lapGroup={selectedLapGroup}
          sectorSummary={selectedSectorSummary}
        />
      )}

      {/* SD-20: Вкладки встроены в шапку общей карточки результатов/кругов/прогресса */}
      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        <SessionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={activeTab}
        >
          {/* SD-7: Таблица результатов */}
          {activeTab === 'results' && (
            <SessionResultsTable
              rows={resultRows}
              fastestLapTime={fastestLapTime}
              selectedDriver={effectiveSelectedDriver}
              onSelectDriver={setSelectedDriver}
            />
          )}

          {/* SD-17/SD-20: Круги выбранного пилота */}
          {activeTab === 'laps' && (
            selectedLapGroup ? (
              <DriverLapTable laps={selectedLapGroup.laps} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Данные по кругам недоступны для этой сессии.
              </p>
            )
          )}

          {/* SD-14: График прогресса */}
          {activeTab === 'lapProgress' && (
            <SessionLapProgressChart series={progressSeries} />
          )}
        </div>
      </div>
    </div>
  );
}
