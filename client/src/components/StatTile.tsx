import { cn } from "@/lib/utils";

export type StatTileVariant = "green" | "purple" | "red";

const STAT_TILE_VARIANT_CLASS: Record<StatTileVariant, string> = {
  green: "text-green-500",
  purple: "text-purple-500",
  red: "text-red-500",
};

interface StatTileProps {
  label: string;
  value: string;
  /** green — личный лучший/положительный показатель, purple — абсолютный лучший, red — худший. */
  variant?: StatTileVariant;
  className?: string;
}

/** Единая мини-плитка статистики — переиспользуется во всех info-карточках приложения. */
export function StatTile({ label, value, variant, className }: StatTileProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-3.5 py-2.5 space-y-0.5", className)}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "font-data text-sm font-semibold tabular-nums truncate",
          variant && STAT_TILE_VARIANT_CLASS[variant],
        )}
      >
        {value}
      </p>
    </div>
  );
}
