export const CLASS_ORDER = ["Hypercar", "LMP2", "LMP3", "GTE", "GT3", "GT4"] as const;

export const CLASS_BADGE: Record<string, string> = {
  Hypercar: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  LMP2:     "bg-chart-4/15 text-chart-4 border-chart-4/30",
  LMP3:     "bg-chart-5/15 text-chart-5 border-chart-5/30",
  GTE:      "bg-chart-3/15 text-chart-3 border-chart-3/30",
  GT3:      "bg-chart-2/15 text-chart-2 border-chart-2/30",
  GT4:      "bg-chart-6/15 text-chart-6 border-chart-6/30",
};

export const CLASS_ACCENT: Record<string, string> = {
  Hypercar: "border-chart-1",
  LMP2:     "border-chart-4",
  LMP3:     "border-chart-5",
  GTE:      "border-chart-3",
  GT3:      "border-chart-2",
  GT4:      "border-chart-6",
};

export function getClassBadgeClass(carClass?: string): string {
  return carClass
    ? CLASS_BADGE[carClass] ?? "bg-muted/40 text-muted-foreground border-border"
    : "bg-muted/40 text-muted-foreground border-border";
}

export function getClassAccentClass(carClass?: string): string {
  return carClass
    ? CLASS_ACCENT[carClass] ?? "border-border"
    : "border-border";
}
