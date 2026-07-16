/**
 * SD-12: Сводная таблица по секторам.
 * Показывает лучшие секторы и теоретически лучший круг для каждого пилота.
 */
import { Card } from '@/components/ui/card';
import type { DriverSectorSummary } from './types';

interface SessionSectorsSummaryProps {
  rows: DriverSectorSummary[];
}

export function SessionSectorsSummary({ rows }: SessionSectorsSummaryProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Данные по секторам недоступны.
      </p>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h2 className="font-semibold text-sm">Сводка по секторам</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">Пилот</th>
              <th className="px-4 py-2.5 text-right">Сектор 1</th>
              <th className="px-4 py-2.5 text-right">Сектор 2</th>
              <th className="px-4 py-2.5 text-right">Сектор 3</th>
              <th className="px-4 py-2.5 text-right">Теор. лучший</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.driverName}
                className={`border-b border-border/60 last:border-0 hover:bg-muted/40 ${
                  row.hasAbsoluteBest ? 'bg-primary/5' : ''
                }`}
              >
                <td className="px-4 py-2.5 font-medium">
                  {row.driverName}
                  {row.carNumber ? (
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      #{row.carNumber}
                    </span>
                  ) : null}
                </td>
                {row.bestSectors.map((t, i) => (
                  <td key={i} className="px-4 py-2.5 text-right font-data tabular-nums">
                    {t}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-data tabular-nums font-semibold">
                  {row.theoreticalBest}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
