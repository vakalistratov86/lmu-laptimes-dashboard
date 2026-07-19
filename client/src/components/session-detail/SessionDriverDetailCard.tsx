/**
 * SD-19: Детальная карточка выбранного пилота.
 * Показывается над таблицей результатов (той же ширины). Собирает воедино
 * всю доступную информацию о пилоте за сессию: результат, сектора и
 * агрегированную статистику по кругам.
 *
 * SD-20: Карточка больше не закрывается — всегда отображается ровно один
 * выбранный пилот (по умолчанию позиция 1) и остаётся видимой при
 * переключении вкладок Результаты / Круги / Прогресс.
 */
import { Medal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DriverName } from '@/components/DriverName';
import { StatTile } from '@/components/StatTile';
import { getClassBadgeClass, getMedalColorClass } from '@/lib/classStyles';
import type {
  SessionResultRowView,
  DriverLapsGroupView,
  DriverSectorSummary,
} from './types';

interface SessionDriverDetailCardProps {
  row: SessionResultRowView;
  lapGroup?: DriverLapsGroupView;
  sectorSummary?: DriverSectorSummary;
}

export function SessionDriverDetailCard({
  row,
  lapGroup,
  sectorSummary,
}: SessionDriverDetailCardProps) {
  return (
    <Card
      data-testid="card-driver-detail"
      className="overflow-hidden border-primary/30 ring-1 ring-primary/10"
    >
      {/* Заголовок */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
          {row.position <= 3 ? (
            <Medal size={14} className={getMedalColorClass(row.position)} />
          ) : (
            row.position
          )}
        </div>
        <DriverName name={row.driverName} isPlayer={row.isPlayer} className="font-semibold text-sm" />
        {row.carClass && (
          <Badge variant="outline" className={getClassBadgeClass(row.carClass)}>
            {row.carClass}
            {row.classPosition ? ` · #${row.classPosition}` : ''}
          </Badge>
        )}
        {row.finishStatus && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {row.finishStatus}
          </Badge>
        )}
      </div>

      {/* Команда / машина */}
      <div className="flex flex-wrap gap-4 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
        <span>{row.teamName ?? 'Без команды'}</span>
        {row.carModel && <span>{row.carModel}</span>}
        {row.carNumber !== '' && <span>#{row.carNumber}</span>}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Лучший круг" value={row.bestLapTime} variant="green" />
        <StatTile label="Отставание" value={row.gap ?? '—'} />
        <StatTile label="Интервал" value={row.interval ?? '—'} />
        <StatTile
          label="Кругов"
          value={String(row.totalLaps ?? lapGroup?.laps.length ?? '—')}
        />
        <StatTile
          label="Пит-стопов"
          value={String(row.pitStops ?? lapGroup?.pitLapsCount ?? '—')}
        />

        {lapGroup && (
          <>
            <StatTile label="Средний круг" value={lapGroup.avgLapTime} />
            <StatTile label="Худший круг" value={lapGroup.worstLapTime} variant="red" />
            <StatTile
              label="Макс. скорость"
              value={
                lapGroup.maxSpeedObserved !== '—'
                  ? `${lapGroup.maxSpeedObserved} км/ч`
                  : '—'
              }
            />
            <StatTile
              label="Топливо (начало → конец)"
              value={
                lapGroup.fuelStart !== '—' || lapGroup.fuelEnd !== '—'
                  ? `${lapGroup.fuelStart} → ${lapGroup.fuelEnd} л`
                  : '—'
              }
            />
            <StatTile
              label="Шины"
              value={
                lapGroup.tyreTypesUsed.length > 0
                  ? lapGroup.tyreTypesUsed.join(', ')
                  : '—'
              }
            />
          </>
        )}

        {sectorSummary && (
          <>
            <StatTile
              label="Сектор 1"
              value={sectorSummary.bestSectors[0]}
              variant={sectorSummary.sectorAbsoluteBest[0] ? 'purple' : 'green'}
            />
            <StatTile
              label="Сектор 2"
              value={sectorSummary.bestSectors[1]}
              variant={sectorSummary.sectorAbsoluteBest[1] ? 'purple' : 'green'}
            />
            <StatTile
              label="Сектор 3"
              value={sectorSummary.bestSectors[2]}
              variant={sectorSummary.sectorAbsoluteBest[2] ? 'purple' : 'green'}
            />
            <StatTile
              label="Теор. лучший круг"
              value={sectorSummary.theoreticalBest}
              variant={sectorSummary.hasAbsoluteBest ? 'purple' : 'green'}
            />
          </>
        )}
      </div>
    </Card>
  );
}
