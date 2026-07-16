/**
 * SD-7: Таблица итоговых результатов сессии.
 * SessionResultsTable — обёртка (Card + thead).
 * SessionResultsRow  — строка таблицы.
 */
import { Medal, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DriverName } from '@/components/DriverName';
import { getClassBadgeClass } from '@/lib/classStyles';
import type { SessionResultRowView } from './types';

// ─── Row ──────────────────────────────────────────────────────────────────────

interface SessionResultsRowProps {
  row: SessionResultRowView;
  isFastest: boolean;
  isPlayer: boolean;
}

export function SessionResultsRow({ row, isFastest, isPlayer }: SessionResultsRowProps) {
  return (
    <tr
      data-testid={`row-result-${row.position}`}
      className={`border-b border-border/60 last:border-0 hover:bg-muted/40 ${
        isPlayer ? 'bg-primary/5' : ''
      }`}
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
            isPlayer={isPlayer ? 1 : 0}
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
            isFastest ? 'font-bold text-primary' : ''
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
  /** Имя текущего пользователя для выделения строки. */
  playerName?: string | null;
}

export function SessionResultsTable({
  rows,
  fastestLapTime,
  playerName,
}: SessionResultsTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h2 className="font-semibold text-sm">Итоговые результаты</h2>
      </div>
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
                isPlayer={!!playerName && row.driverName === playerName}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
