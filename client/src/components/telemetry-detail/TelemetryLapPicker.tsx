import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TelemetryLap } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

interface TelemetryLapPickerProps {
  laps: TelemetryLap[];
  activeLap: number | null;
  onSelect: (lapNumber: number) => void;
  referenceLap?: number | null;
  onSelectReference?: (lapNumber: number) => void;
}

export function TelemetryLapPicker({
  laps,
  activeLap,
  onSelect,
  referenceLap,
  onSelectReference,
}: TelemetryLapPickerProps) {
  const { t } = useLanguage();
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={t("telemetryPage.lapPickerAria")}
    >
      {laps.map((lap) => {
        const isActive = activeLap === lap.lapNumber;
        const isReference = referenceLap === lap.lapNumber;
        return (
          <div
            key={lap.lapNumber}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
            onClick={() => onSelect(lap.lapNumber)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(lap.lapNumber);
              }
            }}
            className={cn(
              "relative flex shrink-0 cursor-pointer flex-col items-center gap-0.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              isActive ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
              isReference && !isActive && "border border-dashed border-foreground/40",
            )}
          >
            {/* Канал телеметрии Lap нумерует круги с 0 (аутлап) — для показа сдвигаем на 1;
                сам lap.lapNumber (ключ выбора круга/запроса серии) не трогаем. */}
            <span>{t("telemetryPage.lapLabel", { n: lap.lapNumber + 1 })}</span>
            <span className="font-data text-[10px] tabular-nums opacity-80">{formatLap(lap.durationSec * 1000)}</span>
            {onSelectReference && (
              <button
                type="button"
                aria-label={
                  isReference
                    ? t("telemetryPage.referenceCurrentAria", { n: lap.lapNumber + 1 })
                    : t("telemetryPage.referenceSetAria", { n: lap.lapNumber + 1 })
                }
                aria-pressed={isReference}
                title={isReference ? t("telemetryPage.referenceCurrentTitle") : t("telemetryPage.referenceSetTitle")}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectReference(lap.lapNumber);
                }}
                className={cn(
                  "absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  isReference ? "opacity-100" : "opacity-30 hover:bg-foreground/10 hover:opacity-70",
                )}
              >
                <Flag size={9} fill={isReference ? "currentColor" : "none"} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
