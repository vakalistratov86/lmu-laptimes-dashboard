import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TelemetryLap } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

interface ReferencePickerProps {
  laps: TelemetryLap[];
  referenceLap: number | null;
  onSelectReference: (lapNumber: number | null) => void;
  className?: string;
}

/**
 * Вторая точка входа для выбора эталонного круга (первая — булавка прямо на
 * кнопке круга в `TelemetryLapPicker`). Список из двух групп: круги этой же
 * записи телеметрии (реальные данные) и «Сохранённые лучшие круги» —
 * личные рекорды/рекорд трассы из ДРУГИХ сессий. Вторая группа сейчас не
 * может быть заполнена реальными данными: `telemetry_sessions` не связан по
 * ID с `sessions`/`drivers` (только текстовые `driverName`/`trackName`), так
 * что подтянуть чей-то рекорд трассы или личный рекорд и надёжно определить,
 * есть ли под него своя запись телеметрии, сегодня нельзя — см.
 * docs/REQUIREMENTS.md, §3.7.1. Группа поэтому остаётся видимой (запрошено
 * явно), но с объясняющим пустым состоянием, а не выдуманными записями.
 */
export function ReferencePicker({ laps, referenceLap, onSelectReference, className }: ReferencePickerProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const referenceLapInfo = laps.find((l) => l.lapNumber === referenceLap);
  const triggerLabel = referenceLapInfo
    ? `${t("telemetryPage.lapLabel", { n: referenceLapInfo.lapNumber + 1 })} · ${formatLap(referenceLapInfo.durationSec * 1000)}`
    : t("telemetryPage.referenceNone");

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-dashed border-foreground/40 bg-card/90 px-2.5 py-1 text-[11px] backdrop-blur hover-elevate"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-dashed border-foreground/80" />
        {t("telemetryPage.referencePickerTrigger")} — <b className="font-data">{triggerLabel}</b>
        <ChevronDown size={11} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("telemetryPage.referencePickerAria")}
          className="absolute bottom-full left-0 z-10 mb-2 max-h-72 w-[280px] overflow-y-auto rounded-lg border border-border bg-card/98 p-1.5 shadow-lg backdrop-blur"
        >
          <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("telemetryPage.referenceGroupSession")}
          </div>
          {laps.map((lap) => {
            const selected = referenceLap === lap.lapNumber;
            return (
              <button
                key={lap.lapNumber}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onSelectReference(selected ? null : lap.lapNumber);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover-elevate",
                  selected && "bg-primary/15",
                )}
              >
                <span className="font-medium">{t("telemetryPage.lapLabel", { n: lap.lapNumber + 1 })}</span>
                <span className="font-data tabular-nums text-muted-foreground">
                  {formatLap(lap.durationSec * 1000)}
                </span>
                {selected && <Check size={13} className="shrink-0 text-primary" />}
              </button>
            );
          })}

          <div className="mt-1 border-t border-border/60 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("telemetryPage.referenceGroupSaved")}
          </div>
          <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {t("telemetryPage.referenceGroupSavedEmpty")}
          </p>
        </div>
      )}
    </div>
  );
}
