/**
 * validators.ts — Zod-схемы и семантическая валидация (#9)
 *
 * Pipeline: raw input → Zod structural parse → semantic check → normalizer → DB
 */
import { z } from "zod";

const MAX_LAP_MS = 24 * 60 * 60 * 1000; // 24 часа
const MIN_LAP_MS = 10_000;              // 10 секунд — физически минимальное время круга
const MAX_SECTOR_MS = 12 * 60 * 60 * 1000;

// ──────────────────────────────────────────────
// Структурные схемы (Zod)
// ──────────────────────────────────────────────

export const LapTimeSchema = z.object({
  driverName: z.string().min(1).max(200),
  trackName: z.string().min(1).max(200),
  lapTimeMs: z
    .number()
    .int()
    .positive()
    .max(MAX_LAP_MS, "Время круга превышает 24 часа"),
  sessionDate: z.coerce.date(),
  carClass: z.string().max(100).optional(),
  sector1Ms: z.number().int().nonnegative().max(MAX_SECTOR_MS).optional(),
  sector2Ms: z.number().int().nonnegative().max(MAX_SECTOR_MS).optional(),
  sector3Ms: z.number().int().nonnegative().max(MAX_SECTOR_MS).optional(),
});

export type LapTimeInput = z.infer<typeof LapTimeSchema>;

export const SessionEventSchema = z.object({
  venue: z.string().min(1).max(200),
  sessionType: z.string().min(1).max(100),
  event: z.string().max(200).optional(),
  dateTimeIso: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  gameVersion: z.string().max(100).optional(),
});

export type SessionEventInput = z.infer<typeof SessionEventSchema>;

// ──────────────────────────────────────────────
// Семантическая валидация после Zod
// ──────────────────────────────────────────────

/**
 * Возвращает строку с описанием ошибки или null если валидно.
 */
export function validateLapTimeSemantic(lt: LapTimeInput): string | null {
  if (lt.lapTimeMs < MIN_LAP_MS) {
    return `Время круга ${lt.lapTimeMs}ms (${(lt.lapTimeMs / 1000).toFixed(1)}s) физически невозможно — меньше ${MIN_LAP_MS / 1000}s`;
  }

  const { sector1Ms: s1, sector2Ms: s2, sector3Ms: s3, lapTimeMs } = lt;
  if (s1 != null && s2 != null && s3 != null) {
    const sectorSum = s1 + s2 + s3;
    // Допуск 5% от времени круга для погрешности измерения
    const tolerance = lapTimeMs * 0.05;
    if (Math.abs(sectorSum - lapTimeMs) > tolerance) {
      return `Сумма секторов (${sectorSum}ms) не соответствует времени круга (${lapTimeMs}ms), разница > 5%`;
    }
  }

  if (lt.sessionDate > new Date()) {
    return `Дата сессии (${lt.sessionDate.toISOString()}) в будущем`;
  }

  return null;
}

/**
 * Полная валидация: сначала Zod, затем семантика.
 * Возвращает { ok: true, data } или { ok: false, errorCode, errorMessage }.
 */
export function validateLapTime(
  raw: unknown
): { ok: true; data: LapTimeInput } | { ok: false; errorCode: string; errorMessage: string } {
  const result = LapTimeSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errorCode: "VALIDATION_ERROR",
      errorMessage: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    };
  }

  const semantic = validateLapTimeSemantic(result.data);
  if (semantic) {
    return { ok: false, errorCode: "SEMANTIC_ERROR", errorMessage: semantic };
  }

  return { ok: true, data: result.data };
}

/**
 * Валидация одиночного сырого lap-объекта из импорт-воркера.
 * Принимает loose-объект из парсера, возвращает результат валидации.
 */
export function validateRawLap(
  raw: Record<string, unknown>
): { ok: true; data: LapTimeInput } | { ok: false; errorCode: string; errorMessage: string } {
  return validateLapTime(raw);
}
