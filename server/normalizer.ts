/**
 * normalizer.ts — Normalization layer (#10)
 *
 * Нормализует данные перед записью в БД:
 * - Имена пилотов: trim + lowercase
 * - Названия трасс: алиасы + trim
 * - Даты сессий: приведение к UTC ISO-строке
 * - Единицы времени круга: секунды или мс → всегда мс (integer)
 */
import type { LapTimeInput } from "@shared/validators";

// ──────────────────────────────────────────────
// Track aliases (#10)
// ──────────────────────────────────────────────

const TRACK_ALIASES: Record<string, string> = {
  // Le Mans
  "le mans": "Circuit de la Sarthe",
  "lemans": "Circuit de la Sarthe",
  "le_mans": "Circuit de la Sarthe",
  "circuit de la sarthe": "Circuit de la Sarthe",
  // Spa
  "spa": "Spa-Francorchamps",
  "spa francorchamps": "Spa-Francorchamps",
  "spa-francorchamps": "Spa-Francorchamps",
  // Monza
  "monza": "Monza",
  "autodromo nazionale monza": "Monza",
  // Silverstone
  "silverstone": "Silverstone",
  // Nürburgring
  "nurburgring": "Nürburgring",
  "nürburgring": "Nürburgring",
  "nordschleife": "Nürburgring Nordschleife",
  // Sebring
  "sebring": "Sebring",
  "sebring international raceway": "Sebring",
  // Imola
  "imola": "Imola",
  "autodromo enzo e dino ferrari": "Imola",
  // Portimão
  "portimao": "Portimão",
  "portimão": "Portimão",
  "algarve": "Portimão",
  // COTA
  "cota": "COTA",
  "circuit of the americas": "COTA",
  "americas": "COTA",
  // Fuji
  "fuji": "Fuji Speedway",
  "fuji speedway": "Fuji Speedway",
  // Interlagos
  "interlagos": "Interlagos",
  "carlos pace": "Interlagos",
  "autodromo jose carlos pace": "Interlagos",
  // Bahrain
  "bahrain": "Bahrain International Circuit",
  "sakhir": "Bahrain International Circuit",
  "bahrain international circuit": "Bahrain International Circuit",
  // Losail / Qatar
  "losail": "Losail International Circuit",
  "qatar": "Losail International Circuit",
};

/**
 * Нормализует название трассы через таблицу алиасов.
 * Если алиас не найден — возвращает trim строку без изменений.
 */
export function normalizeTrackName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return TRACK_ALIASES[key] ?? raw.trim();
}

// ──────────────────────────────────────────────
// Driver name normalization (#10)
// ──────────────────────────────────────────────

/**
 * Нормализует имя пилота: trim + lowercase.
 * Для lookup-целей; в БД хранится оригинал.
 */
export function normalizeDriverNameForLookup(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Нормализует имя пилота для хранения: trim, collapse multiple spaces.
 */
export function normalizeDriverNameForStorage(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ──────────────────────────────────────────────
// Time unit normalization (#10)
// ──────────────────────────────────────────────

/**
 * Детектирует единицы времени и приводит к миллисекундам (integer).
 *
 * Эвристика:
 * - Если значение < 3600 и содержит дробную часть → секунды
 * - Если значение < 3600 и целое, но < 1000 → секунды
 * - Иначе → уже миллисекунды
 */
export function toMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  // Значения < 3600 с дробной частью — точно секунды (напр. 95.432)
  if (value < 3600 && !Number.isInteger(value)) {
    return Math.round(value * 1000);
  }

  // Целые числа < 1000 — тоже секунды (напр. 95)
  if (value < 1000 && Number.isInteger(value)) {
    return value * 1000;
  }

  // Иначе — уже мс
  return Math.round(value);
}

// ──────────────────────────────────────────────
// Date/timezone normalization (#10)
// ──────────────────────────────────────────────

/**
 * Приводит дату/строку к UTC ISO-строке.
 * fix(#75): бросает ошибку при невалидной дате вместо silent fallback.
 */
export function toUTCIsoString(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error(`Невалидная дата: "${String(input)}"`);
  }
  return d.toISOString();
}

/**
 * Нормализует только дату (YYYY-MM-DD) из ISO-строки или Date.
 */
export function toUTCDateString(input: string | Date): string {
  return toUTCIsoString(input).slice(0, 10);
}

// ──────────────────────────────────────────────
// Full LapTime normalization (#10)
// ──────────────────────────────────────────────

/**
 * Полная нормализация LapTimeInput:
 * - driverName → storage-ready (trim + collapse spaces)
 * - trackName → canonical (через алиасы)
 * - lapTimeMs → всегда мс
 * - sessionDate → UTC
 */
export function normalizeLapTime(raw: LapTimeInput): LapTimeInput {
  return {
    ...raw,
    driverName: normalizeDriverNameForStorage(raw.driverName),
    trackName: normalizeTrackName(raw.trackName),
    lapTimeMs: toMilliseconds(raw.lapTimeMs),
    sessionDate: new Date(toUTCIsoString(raw.sessionDate)),
    sector1Ms: raw.sector1Ms != null ? Math.round(toMilliseconds(raw.sector1Ms)) : undefined,
    sector2Ms: raw.sector2Ms != null ? Math.round(toMilliseconds(raw.sector2Ms)) : undefined,
    sector3Ms: raw.sector3Ms != null ? Math.round(toMilliseconds(raw.sector3Ms)) : undefined,
  };
}
