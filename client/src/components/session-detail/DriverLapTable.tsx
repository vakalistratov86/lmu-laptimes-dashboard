/**
 * SD-18: Таблица кругов одного пилота.
 * Добавлены столбцы: Максимальная скорость, Остаток топлива,
 * Износ шин (FL/FR/RL/RR), Тип шин, Пит.
 *
 * SD-20: Выбранный пилот теперь всегда один и виден на всех вкладках
 * страницы SessionDetail, поэтому аккордеон по всем пилотам больше не нужен —
 * компонент сведён к таблице кругов одного пилота.
 */
import type { DriverLapRowView } from './types';

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
