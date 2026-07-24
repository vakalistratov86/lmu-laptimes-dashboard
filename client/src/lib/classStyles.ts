// ─── Medal colours (позиции 1–3) ────────────────────────────────────────────────
// Раньше везде использовался один и тот же цвет для 1/2/3 места — исправлено:
// золото / серебро / бронза, единый источник для всех мест, где рисуется медаль.
export const MEDAL_COLOR: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-slate-400",
  3: "text-amber-700",
};

export function getMedalColorClass(position: number): string {
  return MEDAL_COLOR[position] ?? "text-chart-2";
}

// "Hyper" — реальные импортированные данные сокращают "Hypercar" до "Hyper",
// поэтому это отдельный ключ (с теми же цветами), а не опечатка.
export const CLASS_ORDER = ["Hypercar", "Hyper", "LMP2", "LMP3", "GTE", "GT3", "GT4"] as const;

export const CLASS_BADGE: Record<string, string> = {
  Hypercar: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  Hyper: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  LMP2: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  LMP3: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  GTE: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  GT3: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  GT4: "bg-chart-6/15 text-chart-6 border-chart-6/30",
};

export const CLASS_ACCENT: Record<string, string> = {
  Hypercar: "border-chart-1",
  Hyper: "border-chart-1",
  LMP2: "border-chart-4",
  LMP3: "border-chart-5",
  GTE: "border-chart-3",
  GT3: "border-chart-2",
  GT4: "border-chart-6",
};

export function getClassBadgeClass(carClass?: string): string {
  return carClass
    ? (CLASS_BADGE[carClass] ?? "bg-muted/40 text-muted-foreground border-border")
    : "bg-muted/40 text-muted-foreground border-border";
}

export function getClassAccentClass(carClass?: string): string {
  return carClass ? (CLASS_ACCENT[carClass] ?? "border-border") : "border-border";
}

// ─── Session-type badge styles ─────────────────────────────────────────────────
//
// Единая (единственная) точка нормализации типа сессии для всего фронтенда.
// Сырое поле session.sessionType из БД — составная строка вида
// "Гонка (Race1)" / "Практика (Practice1)" / "Прогрев (Warmup)" / "Тесты (TestDay)".
// Здесь мы сводим её к ровно трём отображаемым категориям (так решил пользователь):
// тренировка (в т.ч. прогрев/тесты/неизвестное) / квалификация (в т.ч. superpole) / гонка.

export type SessionCategory = "practice" | "qualify" | "race";

/** Определяет категорию по сырой строке sessionType (регистронезависимо, по подстроке). */
export function normalizeSessionCategory(raw: string | null | undefined): SessionCategory {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("гонка") || s.includes("race")) return "race";
  if (s.includes("квалиф") || s.includes("qualify") || s.includes("superpole")) return "qualify";
  return "practice";
}

/** Neutral fallback used for any unknown session type. */
export const SESSION_TYPE_BADGE_FALLBACK = "bg-muted/40 text-muted-foreground border-border";

/**
 * Цвета плашек по категориям — синий/жёлтый/красный, одинаковые везде,
 * где отображается тип сессии (список сессий, карточка сессии, фильтр).
 * Работает в тёмной и светлой теме за счёт opacity-модификаторов Tailwind.
 */
export const SESSION_TYPE_BADGE: Record<SessionCategory, string> = {
  practice: "bg-blue-500/15   text-blue-500   dark:text-blue-400   border-blue-500/30",
  qualify: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  race: "bg-red-500/15    text-red-600    dark:text-red-400    border-red-500/30",
};

/** Display order for session categories inside a group. */
export const SESSION_TYPE_ORDER: Record<SessionCategory, number> = {
  practice: 0,
  qualify: 1,
  race: 2,
};

/**
 * Returns the badge Tailwind classes for a normalised session category.
 * Falls back to a neutral muted style for any unknown category.
 */
export function getSessionTypeBadgeClass(category?: string): string {
  return category
    ? (SESSION_TYPE_BADGE[category as SessionCategory] ?? SESSION_TYPE_BADGE_FALLBACK)
    : SESSION_TYPE_BADGE_FALLBACK;
}
