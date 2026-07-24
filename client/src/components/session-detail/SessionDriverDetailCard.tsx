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
import { Medal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DriverName } from "@/components/DriverName";
import { StatTile } from "@/components/StatTile";
import { getClassBadgeClass, getMedalColorClass } from "@/lib/classStyles";
import { useLanguage } from "@/lib/i18n";
import type { SessionResultRowView, DriverLapsGroupView, DriverSectorSummary } from "./types";

interface SessionDriverDetailCardProps {
  row: SessionResultRowView;
  lapGroup?: DriverLapsGroupView;
  sectorSummary?: DriverSectorSummary;
}

export function SessionDriverDetailCard({ row, lapGroup, sectorSummary }: SessionDriverDetailCardProps) {
  const { t } = useLanguage();
  return (
    <Card data-testid="card-driver-detail" className="overflow-hidden">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
          {row.position <= 3 ? <Medal size={14} className={getMedalColorClass(row.position)} /> : row.position}
        </div>
        <DriverName name={row.driverName} isPlayer={row.isPlayer} className="font-semibold text-sm" />
        {row.carClass && (
          <Badge variant="outline" className={getClassBadgeClass(row.carClass)}>
            {row.carClass}
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
        <span>{row.teamName ?? t("sessionDetail.noTeam")}</span>
        {row.carModel && <span>{row.carModel}</span>}
        {row.carNumber !== "" && <span>#{row.carNumber}</span>}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={t("sessionDetail.bestLap")} value={row.bestLapTime} variant="green" />
        <StatTile label={t("sessionDetail.gap")} value={row.gap ?? "—"} />
        <StatTile label={t("sessionDetail.interval")} value={row.interval ?? "—"} />
        <StatTile label={t("sessionDetail.lapsCol")} value={String(row.totalLaps ?? lapGroup?.laps.length ?? "—")} />
        <StatTile label={t("sessionDetail.pitstops")} value={String(row.pitStops ?? lapGroup?.pitLapsCount ?? "—")} />

        {lapGroup && (
          <>
            <StatTile label={t("sessionDetail.avgLap")} value={lapGroup.avgLapTime} />
            <StatTile label={t("sessionDetail.worstLap")} value={lapGroup.worstLapTime} variant="red" />
            <StatTile
              label={t("sessionDetail.maxSpeed")}
              value={lapGroup.maxSpeedObserved !== "—" ? `${lapGroup.maxSpeedObserved} ${t("sessionDetail.kmh")}` : "—"}
            />
            <StatTile
              label={t("sessionDetail.fuel")}
              value={
                lapGroup.fuelStart !== "—" || lapGroup.fuelEnd !== "—"
                  ? `${lapGroup.fuelStart}% → ${lapGroup.fuelEnd}%`
                  : "—"
              }
            />
            <StatTile
              label={t("sessionDetail.tyres")}
              value={lapGroup.tyreTypesUsed.length > 0 ? lapGroup.tyreTypesUsed.join(", ") : "—"}
            />
          </>
        )}

        {sectorSummary && (
          <>
            <StatTile
              label={t("sessionDetail.sector", { n: 1 })}
              value={sectorSummary.bestSectors[0]}
              variant={sectorSummary.sectorAbsoluteBest[0] ? "purple" : "green"}
            />
            <StatTile
              label={t("sessionDetail.sector", { n: 2 })}
              value={sectorSummary.bestSectors[1]}
              variant={sectorSummary.sectorAbsoluteBest[1] ? "purple" : "green"}
            />
            <StatTile
              label={t("sessionDetail.sector", { n: 3 })}
              value={sectorSummary.bestSectors[2]}
              variant={sectorSummary.sectorAbsoluteBest[2] ? "purple" : "green"}
            />
            <StatTile
              label={t("sessionDetail.theoreticalBest")}
              value={sectorSummary.theoreticalBest}
              variant={sectorSummary.hasAbsoluteBest ? "purple" : "green"}
            />
          </>
        )}
      </div>
    </Card>
  );
}
