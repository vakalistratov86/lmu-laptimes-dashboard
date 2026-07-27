import { cn } from "@/lib/utils";
import type { TelemetryLap } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

interface TelemetryLapPickerProps {
  laps: TelemetryLap[];
  activeLap: number | null;
  onSelect: (lapNumber: number) => void;
}

export function TelemetryLapPicker({ laps, activeLap, onSelect }: TelemetryLapPickerProps) {
  const { t } = useLanguage();
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={t("telemetryPage.lapPickerAria")}
    >
      {laps.map((lap) => (
        <button
          key={lap.lapNumber}
          type="button"
          role="tab"
          aria-selected={activeLap === lap.lapNumber}
          onClick={() => onSelect(lap.lapNumber)}
          className={cn(
            "flex shrink-0 flex-col items-center gap-0.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
            activeLap === lap.lapNumber
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {/* Канал телеметрии Lap нумерует круги с 0 (аутлап) — для показа сдвигаем на 1;
              сам lap.lapNumber (ключ выбора круга/запроса серии) не трогаем. */}
          <span>{t("telemetryPage.lapLabel", { n: lap.lapNumber + 1 })}</span>
          <span className="font-data text-[10px] tabular-nums opacity-80">{formatLap(lap.durationSec * 1000)}</span>
        </button>
      ))}
    </div>
  );
}
