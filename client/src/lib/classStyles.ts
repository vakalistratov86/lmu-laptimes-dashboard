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

// ─── Session-type badge styles ─────────────────────────────────────────────────

/** Neutral fallback used for any unknown session type. */
export const SESSION_TYPE_BADGE_FALLBACK =
  "bg-muted/40 text-muted-foreground border-border";

/**
 * Maps normalised session categories to Tailwind badge classes.
 * Works in both light and dark mode via Tailwind's opacity modifiers
 * (bg-*/15 stays subtle; text-* colours are already theme-aware with
 * shadcn/ui CSS-variable colour tokens if you use them, or the raw
 * Tailwind colours below for a simple dark-compatible palette).
 */
export const SESSION_TYPE_BADGE: Record<string, string> = {
  practice:  "bg-blue-500/15   text-blue-500   dark:text-blue-400   border-blue-500/30",
  qualify:   "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  warmup:    "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  race:      "bg-red-500/15    text-red-600    dark:text-red-400    border-red-500/30",
  superpole: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

/** Display order for session categories inside a group. */
export const SESSION_TYPE_ORDER: Record<string, number> = {
  practice:  0,
  qualify:   1,
  superpole: 2,
  warmup:    3,
  race:      4,
};

/**
 * Returns the badge Tailwind classes for a normalised session category.
 * Falls back to a neutral muted style for any unknown category.
 */
export function getSessionTypeBadgeClass(category?: string): string {
  return category
    ? SESSION_TYPE_BADGE[category] ?? SESSION_TYPE_BADGE_FALLBACK
    : SESSION_TYPE_BADGE_FALLBACK;
}
