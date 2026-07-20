/**
 * SD-7: Таблица итоговых результатов сессии.
 *
 * SD-20: Больше не рендерит собственную Card/заголовок — таблица теперь
 * встроена в общую карточку с вкладками (см. SessionDetail.tsx). Выбор
 * пилота больше не снимается повторным кликом: всегда выбран ровно один
 * пилот (по умолчанию — позиция 1), карточка с его деталями видна
 * постоянно на всех вкладках.
 */
import { Medal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DriverName } from '@/components/DriverName';
import { getMedalColorClass } from '@/lib/classStyles';
import { useLanguage } from '@/lib/i18n';
import type { SessionResultRowView } from './types';

// ─── Row ───────────────────────────────────────────────────────────────────────

interface SessionResultsRowProps {
  row: SessionResultRowView;
  isFastest: boolean;
  isSelected: boolean;
  onSelect: (driverName: string) => void;
}

export function SessionResultsRow({
  row,
  isFastest,
  isSelected,
  onSelect,
}: SessionResultsRowProps) {
  return (
    <tr
      data-testid={`row-result-${row.position}`}
      onClick={() => onSelect(row.driverName)}
      className={[
        'border-b border-border/60 last:border-0 cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
          : 'hover:bg-muted/40',
      ].join(' ')}
    >
      {/* Позиция */}
      <td className="px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
          {row.position <= 3 ? (
            <Medal size={14} className={getMedalColorClass(row.position)} />
          ) : (
            row.position
          )}
        </div>
      </td>

      {/* Пилот */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <DriverName name={row.driverName} isPlayer={row.isPlayer} className="font-medium" />
        </div>
      </td>

      {/* Команда / машина */}
      <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
        <div className="truncate">{row.teamName ?? '—'}</div>
        <div className="truncate text-xs">
          {row.carModel}
          {row.carNumber ? ` · #${row.carNumber}` : ''}
        </div>
      </td>

      {/* Класс */}
      <td className="px-4 py-2.5">
        {row.finishStatus ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {row.finishStatus}
          </Badge>
        ) : null}
      </td>

      {/* Кругов */}
      <td className="px-4 py-2.5 text-right font-data tabular-nums">
        {row.totalLaps ?? '—'}
      </td>

      {/* Пит */}
      <td className="hidden px-4 py-2.5 text-right font-data tabular-nums md:table-cell">
        {row.pitStops ?? '—'}
      </td>

      {/* Лучший круг */}
      <td className="px-4 py-2.5 text-right">
        <span
          className={`font-data tabular-nums ${
            isFastest ? 'font-bold text-green-500' : ''
          }`}
        >
          {row.bestLapTime}
        </span>
      </td>

      {/* Отставание */}
      <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground lg:table-cell">
        {row.gap ?? '—'}
      </td>
    </tr>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface SessionResultsTableProps {
  rows: SessionResultRowView[];
  /** Лучшее время сессии (отформатированное). */
  fastestLapTime?: string | null;
  /** Имя выбранного пилота — всегда задано (по умолчанию позиция 1). */
  selectedDriver?: string | null;
  /** Колбэк при клике на строку пилота. */
  onSelectDriver: (driverName: string) => void;
}

export function SessionResultsTable({
  rows,
  fastestLapTime,
  selectedDriver,
  onSelectDriver,
}: SessionResultsTableProps) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 w-12">{t('sessionDetail.colPos')}</th>
            <th className="px-4 py-2.5">{t('sessionDetail.colDriver')}</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">{t('sessionDetail.colTeamCar')}</th>
            <th className="px-4 py-2.5">{t('sessionDetail.colStatus')}</th>
            <th className="px-4 py-2.5 text-right">{t('sessionDetail.colLaps')}</th>
            <th className="hidden px-4 py-2.5 text-right md:table-cell">{t('sessionDetail.colPit')}</th>
            <th className="px-4 py-2.5 text-right">{t('sessionDetail.bestLap')}</th>
            <th className="hidden px-4 py-2.5 text-right lg:table-cell">{t('sessionDetail.gap')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SessionResultsRow
              key={row.position}
              row={row}
              isFastest={!!fastestLapTime && row.bestLapTime === fastestLapTime}
              isSelected={selectedDriver === row.driverName}
              onSelect={onSelectDriver}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
