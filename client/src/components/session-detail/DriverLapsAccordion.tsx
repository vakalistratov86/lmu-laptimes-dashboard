/**
 * SD-13: Аккордеон кругов по пилотам.
 * DriverLapsAccordion — список аккордеон-карточек.
 * DriverLapTable     — таблица кругов одного пилота.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { DriverName } from '@/components/DriverName';
import type { DriverLapsGroupView, DriverLapRowView } from './types';

// ─── DriverLapTable ───────────────────────────────────────────────────────────────────

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
            <th className="px-4 py-2 text-right">Сектор 1</th>
            <th className="px-4 py-2 text-right">Сектор 2</th>
            <th className="px-4 py-2 text-right">Сектор 3</th>
            <th className="px-4 py-2 text-right">Время</th>
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
              <td className="px-4 py-2 font-data tabular-nums text-muted-foreground">
                {lap.lapNumber}
                {lap.isPitLap && (
                  <span className="ml-1.5 text-xs text-muted-foreground">[П]</span>
                )}
              </td>
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[0]}
              </td>
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[1]}
              </td>
              <td className="px-4 py-2 text-right font-data tabular-nums">
                {lap.sectors[2]}
              </td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── DriverLapsAccordion ─────────────────────────────────────────────────────────────

interface DriverLapsAccordionProps {
  groups: DriverLapsGroupView[];
}

export function DriverLapsAccordion({ groups }: DriverLapsAccordionProps) {
  const [openDrivers, setOpenDrivers] = useState<Set<string>>(new Set());

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

  return (
    <div className="space-y-3">
      {groups.map((group) => {
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
