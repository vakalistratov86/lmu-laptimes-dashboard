/**
 * SD-18: Таблица кругов одного пилота.
 * Добавлены столбцы: Максимальная скорость, Остаток топлива,
 * Износ шин (FL/FR/RL/RR), Тип шин, Пит.
 *
 * SD-20: Выбранный пилот теперь всегда один и виден на всех вкладках
 * страницы SessionDetail, поэтому аккордеон по всем пилотам больше не нужен —
 * компонент сведён к таблице кругов одного пилота.
 */
import type { DriverLapRowView } from "./types";
import { useLanguage } from "@/lib/i18n";

// ─── Бейдж компаунда шин ────────────────────────────────────────────────────

const COMPOUND_BADGE_CLASS: Record<string, string> = {
  S: "bg-red-500/15 text-red-500 border-red-500/30",
  M: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  H: "bg-muted-foreground/15 text-muted-foreground border-border",
};

/** Извлекает букву компаунда шин (S/M/H/…) из названия («Medium» → «M»). */
function getCompoundLetter(name: string): string | null {
  if (!name || name === "—") return null;
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : null;
}

function getCompoundBadgeClass(letter: string | null): string {
  return (letter && COMPOUND_BADGE_CLASS[letter]) || COMPOUND_BADGE_CLASS.H;
}

// ─── DriverLapTable ───────────────────────────────────────────────────────────

interface DriverLapTableProps {
  laps: DriverLapRowView[];
}

export function DriverLapTable({ laps }: DriverLapTableProps) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2">{t("sessionDetail.colLap")}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.colTime")}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.sector", { n: 1 })}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.sector", { n: 2 })}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.sector", { n: 3 })}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.maxSpeed")}</th>
            <th className="px-4 py-2 text-right">{t("sessionDetail.colFuel")}</th>
            <th className="px-4 py-2 text-center">{t("sessionDetail.colTyreWear")}</th>
            <th className="px-4 py-2 text-center">{t("sessionDetail.colTyreType")}</th>
            <th className="px-4 py-2 text-center">{t("sessionDetail.colPit")}</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap) => (
            <tr
              key={lap.lapNumber}
              className={`border-b border-border/50 last:border-0 hover:bg-muted/40 ${
                lap.isPersonalBest ? "bg-green-500/5" : ""
              }`}
            >
              {/* Круг */}
              <td className="px-4 py-2 font-data tabular-nums text-muted-foreground">{lap.lapNumber}</td>

              {/* Время */}
              <td
                className={`px-4 py-2 text-right font-data tabular-nums ${
                  lap.isOverallBest
                    ? "font-bold text-green-500"
                    : lap.isPersonalBest
                      ? "font-semibold text-green-500/80"
                      : ""
                }`}
              >
                {lap.lapTime}
              </td>

              {/* Сектора — чуть мельче времени круга, чтобы оно оставалось
                  главным значением строки. Фиолетовый: лучший сектор сессии
                  среди всех пилотов, зелёный: личный лучший сектор пилота */}
              {[0, 1, 2].map((i) => (
                <td
                  key={i}
                  className={`px-4 py-2 text-right font-data text-xs tabular-nums ${
                    lap.sectorsAbsoluteBest[i]
                      ? "font-bold text-purple-500"
                      : lap.sectorsPersonalBest[i]
                        ? "font-semibold text-green-500"
                        : ""
                  }`}
                >
                  {lap.sectors[i]}
                </td>
              ))}

              {/* SD-18: Максимальная скорость */}
              <td className="px-4 py-2 text-right font-data tabular-nums text-muted-foreground">
                {lap.maxSpeed !== "—" ? `${lap.maxSpeed} ${t("sessionDetail.kmh")}` : "—"}
              </td>

              {/* Остаток топлива, % от полного бака */}
              <td className="px-4 py-2 text-right font-data tabular-nums text-muted-foreground">
                {lap.fuelRemaining !== "—" ? `${lap.fuelRemaining}%` : "—"}
              </td>

              {/* Износ шин FL/FR/RL/RR — компактная сетка 2×2, мелкий шрифт */}
              <td className="px-3 py-2 text-center">
                {lap.tyreWear ? (
                  <div className="inline-grid grid-cols-2 gap-x-2 text-right font-data text-[10px] leading-[1.5] text-muted-foreground">
                    <span>
                      <span className="mr-1 text-muted-foreground/60">FL</span>
                      {lap.tyreWear.fl}
                    </span>
                    <span>
                      <span className="mr-1 text-muted-foreground/60">FR</span>
                      {lap.tyreWear.fr}
                    </span>
                    <span>
                      <span className="mr-1 text-muted-foreground/60">RL</span>
                      {lap.tyreWear.rl}
                    </span>
                    <span>
                      <span className="mr-1 text-muted-foreground/60">RR</span>
                      {lap.tyreWear.rr}
                    </span>
                  </div>
                ) : (
                  "—"
                )}
              </td>

              {/* Компаунд шин — круглый бейдж с буквой (S/M/H) */}
              <td className="px-4 py-2 text-center">
                {(() => {
                  const letter = getCompoundLetter(lap.tyreType);
                  return letter ? (
                    <span
                      className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[11px] font-bold ${getCompoundBadgeClass(letter)}`}
                      title={lap.tyreType}
                    >
                      {letter}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  );
                })()}
              </td>

              {/* Пит (перемещён в конец, SD-18) */}
              <td className="px-4 py-2 text-center">
                {lap.isPitLap ? (
                  <span className="text-xs font-medium text-amber-500">{t("sessionDetail.pitMarker")}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
