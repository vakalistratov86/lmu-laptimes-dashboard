/**
 * SD-7: Таблица итоговых результатов сессии.
 *
 * SD-20: Больше не рендерит собственную Card/заголовок — таблица теперь
 * встроена в общую карточку с вкладками (см. SessionDetail.tsx). Выбор
 * пилота больше не снимается повторным кликом: всегда выбран ровно один
 * пилот (по умолчанию — позиция 1), карточка с его деталями видна
 * постоянно на всех вкладках.
 */
import { Medal, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DriverName } from "@/components/DriverName";
import { getMedalColorClass } from "@/lib/classStyles";
import { CarClassBadge } from "@/components/CarClassBadge";
import { useLanguage } from "@/lib/i18n";
import type { SessionResultRowView } from "./types";

// ─── Row ───────────────────────────────────────────────────────────────────────

interface SessionResultsRowProps {
  row: SessionResultRowView;
  isFastest: boolean;
  isSelected: boolean;
  onSelect: (carKey: string) => void;
}

export function SessionResultsRow({ row, isFastest, isSelected, onSelect }: SessionResultsRowProps) {
  return (
    <tr
      data-testid={`row-result-${row.position}-${row.carKey}`}
      onClick={() => onSelect(row.carKey)}
      className={[
        "border-b border-border/60 last:border-0 cursor-pointer transition-colors",
        isSelected ? "bg-primary/15 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/40",
      ].join(" ")}
    >
      {/* Позиция */}
      <td className="px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
          {row.position <= 3 ? <Medal size={14} className={getMedalColorClass(row.position)} /> : row.position}
        </div>
      </td>

      {/* Пилот — командная гонка со сменой пилота показывает здесь только
          признак "несколько пилотов", а не состав (см. вкладку "Круги").
          max-w ограничивает рост колонки от аномально длинных имён — без
          него table-layout: auto давал колонке расти вплоть до переноса
          имени на вторую строку внутри flex-строки (нет white-space: nowrap
          без max-width, задающего границу для переноса/усечения). */}
      <td className="max-w-[165px] px-4 py-2.5">
        <div className="flex items-center gap-2">
          {row.driverCount > 1 ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <Users size={12} />
              {row.driverCount}
            </Badge>
          ) : (
            <DriverName name={row.driverName} isPlayer={row.isPlayer} className="font-medium" />
          )}
        </div>
      </td>

      {/* Команда — max-w+truncate прямо на td (не на вложенном div без
          ширины — иначе truncate не усекает ничего, т.к. не от чего
          отталкиваться), как в Leaderboards.tsx. */}
      <td className="hidden max-w-[128px] truncate px-4 py-2.5 text-[11px] text-muted-foreground sm:table-cell">
        {row.teamName ?? "—"}
      </td>

      {/* Класс машины */}
      <td className="px-4 py-2.5">
        {row.carClass ? (
          <CarClassBadge carClass={row.carClass} className="text-xs" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Авто */}
      <td className="hidden max-w-[128px] truncate px-4 py-2.5 text-[11px] text-muted-foreground sm:table-cell">
        {row.carModel}
        {row.carNumber ? ` · #${row.carNumber}` : ""}
      </td>

      {/* Статус финиша */}
      <td className="max-w-[110px] px-4 py-2.5">
        {row.finishStatus ? (
          <Badge variant="outline" className="max-w-full truncate text-xs text-muted-foreground">
            {row.finishStatus}
          </Badge>
        ) : null}
      </td>

      {/* Кругов */}
      <td className="px-4 py-2.5 text-right font-data tabular-nums">{row.totalLaps ?? "—"}</td>

      {/* Пит */}
      <td className="hidden px-4 py-2.5 text-right font-data tabular-nums md:table-cell">{row.pitStops ?? "—"}</td>

      {/* Лучший круг */}
      <td className="px-4 py-2.5 text-right">
        <span className={`font-data tabular-nums ${isFastest ? "font-bold text-green-500" : ""}`}>
          {row.bestLapTime}
        </span>
      </td>

      {/* Отставание */}
      <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground lg:table-cell">
        {row.gap ?? "—"}
      </td>

      {/* Время на треке */}
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-data tabular-nums text-muted-foreground">
        {row.timeOnTrack}
      </td>
    </tr>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface SessionResultsTableProps {
  rows: SessionResultRowView[];
  /** Лучшее время сессии (отформатированное). */
  fastestLapTime?: string | null;
  /** Ключ выбранной машины/команды — всегда задан (по умолчанию позиция 1). */
  selectedCarKey?: string | null;
  /** Колбэк при клике на строку машины/команды. */
  onSelectCar: (carKey: string) => void;
}

export function SessionResultsTable({ rows, fastestLapTime, selectedCarKey, onSelectCar }: SessionResultsTableProps) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 w-12">{t("sessionDetail.colPos")}</th>
            <th className="max-w-[165px] px-4 py-2.5">{t("sessionDetail.colDriver")}</th>
            <th className="hidden max-w-[128px] px-4 py-2.5 sm:table-cell">{t("sessionDetail.colTeam")}</th>
            <th className="px-4 py-2.5">{t("sessionDetail.colClass")}</th>
            <th className="hidden max-w-[128px] px-4 py-2.5 sm:table-cell">{t("sessionDetail.colCar")}</th>
            <th className="max-w-[110px] px-4 py-2.5">{t("sessionDetail.colStatus")}</th>
            <th className="px-4 py-2.5 text-right">{t("sessionDetail.colLaps")}</th>
            <th className="hidden px-4 py-2.5 text-right md:table-cell">{t("sessionDetail.colPit")}</th>
            <th className="px-4 py-2.5 text-right">{t("sessionDetail.bestLap")}</th>
            <th className="hidden px-4 py-2.5 text-right lg:table-cell">{t("sessionDetail.gap")}</th>
            <th className="px-4 py-2.5 text-right">{t("sessionDetail.colTimeOnTrack")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SessionResultsRow
              key={row.carKey}
              row={row}
              isFastest={!!fastestLapTime && row.bestLapTime === fastestLapTime}
              isSelected={selectedCarKey === row.carKey}
              onSelect={onSelectCar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
