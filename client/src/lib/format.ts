// Форматирование времени круга из миллисекунд в M:SS.mmm.
// Невалидный ms (NaN/Infinity/<=0 — например Infinity как «ещё не было ни одного
// замера» в аккумуляторах min/max) рисуется как «—» самой функцией, а не отдаётся
// на откуп каждому месту вызова.
// Валидный ms округляется до целого перед разбором на секунды/мс: вызывающий код
// (например, секунды*1000 после деления *1000 в другом месте) может отдать не
// строго целое значение из-за погрешности float — без округления «дробный хвост»
// мс (типа 439.99999999999994) ломает вывод вместо аккуратных «440».
export function formatLap(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const roundedMs = Math.round(ms);
  const totalSeconds = Math.floor(roundedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = roundedMs % 1000;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

// Форматирование сектора в SS.mmm (см. комментарий у formatLap про невалидный ms и округление).
export function formatSector(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const roundedMs = Math.round(ms);
  const seconds = Math.floor(roundedMs / 1000);
  const millis = roundedMs % 1000;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

// Форматирование суммарного времени на треке (сумма кругов пилота за сессию) в H:MM:SS / M:SS.
// В отличие от formatLap (масштаб одного круга) секунды — предел точности: эндуранс-сессия
// может уйти за много часов, доли секунды на таком масштабе нечитаемы и не нужны.
export function formatTrackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Форматирование суммарной длительности (в минутах) в «Xч Yм» / «Yм» (ru) либо «Xh Ym» / «Ym» (en)
export function formatDurationMin(totalMinutes: number, locale: "ru" | "en" = "ru"): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "—";
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  const [h, m] = locale === "ru" ? ["ч", "м"] : ["h", "m"];
  if (hours === 0) return `${minutes}${m}`;
  if (minutes === 0) return `${hours}${h}`;
  return `${hours}${h} ${minutes}${m}`;
}

// Дельта относительно лучшего времени, со знаком
export function formatDelta(ms: number, bestMs: number): string {
  const diff = ms - bestMs;
  if (diff === 0) return "—";
  const sign = diff > 0 ? "+" : "-";
  return `${sign}${formatLap(Math.abs(diff))}`;
}

export const CONDITION_LABELS: Record<string, string> = {
  Сухо: "Сухо",
  Дождь: "Дождь",
  Смешанно: "Смешанно",
};

/**
 * A session's course only identifies a distinct track layout when it actually
 * differs from the venue name. Some LMU logs write the course tag as a plain
 * copy of the venue (or leave it blank) while others record it for the same
 * physical track — without this, those sessions would be treated as a second,
 * near-identical track layout for the same track.
 *
 * Shared between Leaderboards.tsx (splits leaderboard boards by course) and
 * DriverProfile.tsx (must key personal-best/track-record lookups the same
 * way getBestLaps() on the server groups its rows — see #123 follow-up).
 */
export function normalizeCourse(course: string | null | undefined, trackName: string): string | null {
  const trimmed = course?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === trackName.trim().toLowerCase() ? null : trimmed;
}

export function countryFlag(code: string): string {
  const map: Record<string, string> = {
    RU: "🇷🇺",
    IT: "🇮🇹",
    GB: "🇬🇧",
    JP: "🇯🇵",
    FR: "🇫🇷",
    DE: "🇩🇪",
    US: "🇺🇸",
  };
  return map[code] ?? "🏁";
}
