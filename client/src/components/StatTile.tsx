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
    <div
      className={cn(
        "min-w-[110px] rounded-lg border border-border bg-card px-3.5 py-2.5 space-y-0.5 text-left",
        className,
      )}
    >
      <p className="text-left text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "font-data text-xs font-semibold tabular-nums truncate text-left",
          variant && STAT_TILE_VARIANT_CLASS[variant],
        )}
      >
        {value}
      </p>
    </div>
  );
}
