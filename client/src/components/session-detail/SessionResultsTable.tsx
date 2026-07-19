/**
 * SD-7: Таблица итоговых результатов сессии.
 * SessionResultsTable — обёртка (Card + thead).
 * SessionResultsRow  — строка таблицы.
 *
 * SD-15: Поддержка выделения строки пилота.
 * Клик по строке устанавливает selectedDriver; повторный клик — сбрасывает.
 * Выделенный пилот передаётся в onSelectDriver для фильтрации вкладок Круги / Секторы.
 */
import { Medal, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
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
  /** @deprecated Не используется. Игрок определяется через row.isPlayer. */
  playerName?: string | null;
  /** Имя выбранного пилота (null = никто не выбран). */
  selectedDriver?: string | null;
  /** Колбэк при клике на строку пилота. */
  onSelectDriver?: (driverName: string | null) => void;
}

export function SessionResultsTable({
  rows,
  fastestLapTime,
  selectedDriver,
  onSelectDriver,
}: SessionResultsTableProps) {
  function handleSelect(name: string) {
    if (!onSelectDriver) return;
    // Повторный клик — снять выделение
    onSelectDriver(selectedDriver === name ? null : name);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
        <h2 className="font-semibold text-sm">Итоговые результаты</h2>
        {selectedDriver && (
          <button
            type="button"
            onClick={() => onSelectDriver?.(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Сбросить фильтр ✕
          </button>
        )}
      </div>
      {selectedDriver && (
        <div className="bg-primary/5 px-4 py-1.5 text-xs text-primary border-b border-primary/20">
          Фильтр: <span className="font-semibold">{selectedDriver}</span> — вкладки «Круги» и «Секторы» показывают только этого пилота
        </div>
      )}
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
                onSelect={handleSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
