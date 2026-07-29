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

// ─── Car class badges (унифицировано под FIA WEC) ──────────────────────────────
// Официальная цветовая маркировка чемпионата: Hypercar — красный, LMP2 — синий,
// LMGT3 — зелёный. LMP3 вне основного чемпионата WEC (кастомные/сторонние серии
// в LMU) — жёлтый, чтобы не путать с тройкой основных классов. Единый источник
// цвета для всего проекта, включая вкладку Events (там раньше была своя копия
// схемы с другими цветами и другим набором меток классов).
export type CanonicalCarClass = "Hypercar" | "LMP2" | "LMP3" | "LMGT3";

export const CANONICAL_CLASS_ORDER: readonly CanonicalCarClass[] = ["Hypercar", "LMP2", "LMP3", "LMGT3"];

// Алиасы сырых значений car_class (из лога игры и с вкладки Events, напр. "WEC LMP2",
// "ELMS LMP2") → канонический класс. GTE — прежнее имя LMGT3 до переименования FIA,
// GT3 — синоним того же GT-класса (в т.ч. фолбэк парсера для нераспознанного
// car_class, см. server/importWorker.ts normalizeClass) — маппится туда же.
// GT4 (кастомные лиги вне чемпионата) сознательно не входит в список: получает
// нейтральный fallback-бейдж, а не отдельный цвет.
const CLASS_ALIASES: Record<string, CanonicalCarClass> = {
  hypercar: "Hypercar",
  hyper: "Hypercar",
  lmh: "Hypercar",
  lmp2: "LMP2",
  lmp3: "LMP3",
  lmgt3: "LMGT3",
  gte: "LMGT3",
  gt3: "LMGT3",
};

/** Сводит сырую строку car_class (в т.ч. "WEC LMP2", "ELMS LMP2", "GTE"…) к одному из 4 канонических классов WEC. */
export function normalizeCarClass(carClass?: string | null): CanonicalCarClass | null {
  const key = (carClass ?? "").trim().toLowerCase();
  if (!key) return null;
  if (CLASS_ALIASES[key]) return CLASS_ALIASES[key];
  for (const [alias, canonical] of Object.entries(CLASS_ALIASES)) {
    if (key.includes(alias)) return canonical;
  }
  return null;
}

/** Ранг для сортировки: канонический класс по CANONICAL_CLASS_ORDER, нераспознанный — в конец. */
export function getClassSortRank(carClass?: string | null): number {
  const canonical = normalizeCarClass(carClass);
  return canonical ? CANONICAL_CLASS_ORDER.indexOf(canonical) : CANONICAL_CLASS_ORDER.length;
}

/** Сравнивает сырые car_class-строки: сначала по канонической категории, затем по алфавиту. */
export function compareCarClass(a: string, b: string): number {
  const diff = getClassSortRank(a) - getClassSortRank(b);
  return diff !== 0 ? diff : a.localeCompare(b);
}

export const CLASS_BADGE: Record<CanonicalCarClass, string> = {
  Hypercar: "bg-red-500/15    text-red-600    dark:text-red-400    border-red-500/30",
  LMP2: "bg-blue-500/15   text-blue-600   dark:text-blue-400   border-blue-500/30",
  LMP3: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  LMGT3: "bg-green-500/15  text-green-600  dark:text-green-400  border-green-500/30",
};

export const CLASS_ACCENT: Record<CanonicalCarClass, string> = {
  Hypercar: "border-red-500",
  LMP2: "border-blue-500",
  LMP3: "border-yellow-500",
  LMGT3: "border-green-500",
};

const CLASS_BADGE_FALLBACK = "bg-muted/40 text-muted-foreground border-border";

export function getClassBadgeClass(carClass?: string | null): string {
  const canonical = normalizeCarClass(carClass);
  return canonical ? CLASS_BADGE[canonical] : CLASS_BADGE_FALLBACK;
}

export function getClassAccentClass(carClass?: string | null): string {
  const canonical = normalizeCarClass(carClass);
  return canonical ? CLASS_ACCENT[canonical] : "border-border";
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
