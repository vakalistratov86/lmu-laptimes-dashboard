/**
 * SD-7: Таблица итоговых результатов сессии.
 *
 * SD-20: Больше не рендерит собственную Card/заголовок — таблица теперь
 * встроена в общую карточку с вкладками (см. SessionDetail.tsx). Выбор
 * пилота больше не снимается повторным кликом: всегда выбран ровно один
 * пилот (по умолчанию — позиция 1), карточка с его деталями видна
 * постоянно на всех вкладках.
 */
import { Medal, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DriverName } from '@/components/DriverName';
import type { SessionResultRowView } from './types';

// ─── Row ───────────────────────────────────────────────────────────────────────

interface SessionResultsRowProps {
  row: SessionResultRowView;
  isFastest: boolean;
  isPlayer: boolean;
  isSelected: boolean;
  onSelect: (driverName: string) => void;
}

export function SessionResultsRow({
  row,
  isFastest,
  isPlayer,
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
          : isPlayer
          ? 'bg-primary/5 hover:bg-primary/10'
          : 'hover:bg-muted/40',
      ].join(' ')}
    >
      {/* Позиция */}
      <td className="px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
          {row.position <= 3 ? (
            <Medal size={14} className="text-chart-2" />
          ) : (
            row.position
          )}
        </div>
      </td>

      {/* Пилот */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {isPlayer && <User size={13} className="text-primary" />}
          <DriverName
            name={row.driverName}
            isPlayer={row.isPlayer}
            className={isPlayer ? 'font-medium text-primary' : 'font-medium'}
          />
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 w-12">Поз.</th>
            <th className="px-4 py-2.5">Пилот</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Команда / машина</th>
            <th className="px-4 py-2.5">Статус</th>
            <th className="px-4 py-2.5 text-right">Кругов</th>
            <th className="hidden px-4 py-2.5 text-right md:table-cell">Пит</th>
            <th className="px-4 py-2.5 text-right">Лучший круг</th>
            <th className="hidden px-4 py-2.5 text-right lg:table-cell">Отставание</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SessionResultsRow
              key={row.position}
              row={row}
              isFastest={!!fastestLapTime && row.bestLapTime === fastestLapTime}
              isPlayer={row.isPlayer === 1}
              isSelected={selectedDriver === row.driverName}
              onSelect={onSelectDriver}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
