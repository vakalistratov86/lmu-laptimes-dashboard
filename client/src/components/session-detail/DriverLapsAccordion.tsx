/**
 * SD-13: Аккордеон кругов по пилотам.
 * DriverLapsAccordion — список аккордеон-карточек.
 * DriverLapTable     — таблица кругов одного пилота.
 *
 * SD-15: Поддержка фильтра по пилоту.
 * SD-17: Если driverFilter задан, таблица показывается СРАЗУ (без дропдауна).
 * SD-18: Добавлены столбцы: Максимальная скорость, Остаток топлива,
 *         Износ шин (FL/FR/RL/RR), Тип шин, Пит.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DriverName } from '@/components/DriverName';
import type { DriverLapsGroupView, DriverLapRowView } from './types';

// ─── DriverLapTable ───────────────────────────────────────────────────────────

interface DriverLapTableProps {
  laps: DriverLapRowView[];
}

export function DriverLapTable({ laps }: DriverLapTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2">Круг</th>
            <th className="px-4 py-2 text-right">Время</th>
            <th className="px-4 py-2 text-right">Сектор 1</th>
            <th className="px-4 py-2 text-right">Сектор 2</th>
            <th className="px-4 py-2 text-right">Сектор 3</th>
            <th className="px-4 py-2 text-right">Макс. скорость</th>
            <th className="px-4 py-2 text-right">Топливо</th>
            <th className="px-4 py-2 text-center">Износ шин (FL/FR/RL/RR)</th>
            <th className="px-4 py-2 text-center">Тип шин</th>
            <th className="px-4 py-2 text-center">Пит</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => (
            <tr
              key={lap.lapNumber}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${
                lap.isPersonalBest ? 'bg-green-500/5' : ''
              }`}
            >
              {/* Круг */}
              <td className="px-4 py-2 font-data tabular-nums text-muted-foreground">
                {lap.lapNumber}
              </td>

              {/* Время */}
              <td
                className={`px-4 py-2 text-right font-data tabular-nums ${
                  lap.isOverallBest
                    ? 'font-bold text-green-500'
                    : lap.isPersonalBest
                    ? 'font-semibold text-green-500/80'
                    : ''
                }`}
              >
                {lap.lapTime}
              </td>

              {/* Сектора */}
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[0]}
              </td>
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[1]}
              </td>
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[2]}
              </td>

              {/* SD-18: Максимальная скорость */}
              <td className="px-4 py-2 text-right font-data tabular-nums text-muted-foreground">
                {lap.maxSpeed !== '—' ? `${lap.maxSpeed} км/ч` : '—'}
              </td>

              {/* SD-18: Остаток топлива */}
              <td className="px-4 py-2 text-right font-data tabular-nums text-muted-foreground">
                {lap.fuelRemaining !== '—' ? `${lap.fuelRemaining} л` : '—'}
              </td>

              {/* SD-18: Износ шин FL/FR/RL/RR */}
              <td className="px-4 py-2 text-center font-data tabular-nums text-muted-foreground whitespace-nowrap">
                {lap.tyreWear
                  ? `${lap.tyreWear.fl} / ${lap.tyreWear.fr} / ${lap.tyreWear.rl} / ${lap.tyreWear.rr}`
                  : '—'}
              </td>

              {/* SD-18: Тип шин */}
              <td className="px-4 py-2 text-center text-muted-foreground">
                {lap.tyreType}
              </td>

              {/* Пит (перемещён в конец, SD-18) */}
              <td className="px-4 py-2 text-center">
                {lap.isPitLap ? (
                  <span className="text-xs font-medium text-amber-500">П</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DriverLapsAccordion ──────────────────────────────────────────────────────

interface DriverLapsAccordionProps {
  groups: DriverLapsGroupView[];
  /** Если задан — показывать только этого пилота и сразу раскрыть таблицу. */
  driverFilter?: string | null;
}

export function DriverLapsAccordion({ groups, driverFilter }: DriverLapsAccordionProps) {
  const [openDrivers, setOpenDrivers] = useState<Set<string>>(new Set());

  const visibleGroups = driverFilter
    ? groups.filter((g) => g.driverName === driverFilter)
    : groups;

  function toggle(name: string) {
    setOpenDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (groups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Данные по кругам недоступны для этой сессии.
      </p>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Нет данных о кругах для пилота «{driverFilter}».
      </p>
    );
  }

  // SD-17: Если пилот выбран — показываем таблицу сразу без аккордеона
  if (driverFilter) {
    const group = visibleGroups[0];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <DriverName
            name={group.driverName}
            isPlayer={group.isPlayer}
            className="font-semibold text-sm"
          />
          {group.carNumber ? (
            <span className="text-xs text-muted-foreground">#{group.carNumber}</span>
          ) : null}
          <span className="ml-auto font-data text-xs tabular-nums text-muted-foreground">
            {group.laps.length} кругов · лучший {group.bestLapTime}
          </span>
        </div>
        <Card className="overflow-hidden">
          <DriverLapTable laps={group.laps} />
        </Card>
      </div>
    );
  }

  // Обычный режим: аккордеон по всем пилотам
  return (
    <div className="space-y-3">
      {visibleGroups.map((group) => {
        const isOpen = openDrivers.has(group.driverName);
        return (
          <Card key={group.driverName} className="overflow-hidden">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggle(group.driverName)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5 text-left hover:bg-secondary/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  size={15}
                  className={`transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  } text-muted-foreground`}
                />
                <DriverName
                  name={group.driverName}
                  isPlayer={group.isPlayer}
                  className="font-semibold text-sm"
                />
                {group.carNumber ? (
                  <span className="text-xs text-muted-foreground">#{group.carNumber}</span>
                ) : null}
              </div>
              <span className="font-data text-xs tabular-nums text-muted-foreground">
                {group.laps.length} кругов · лучший {group.bestLapTime}
              </span>
            </button>

            {/* Body */}
            {isOpen && <DriverLapTable laps={group.laps} />}
          </Card>
        );
      })}
    </div>
  );
}
