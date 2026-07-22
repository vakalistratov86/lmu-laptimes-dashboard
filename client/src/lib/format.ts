// Форматирование времени круга из миллисекунд в M:SS.mmm
export function formatLap(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  return `${seconds}.${String(millis).padStart(3, "0")}`;
}

// Форматирование сектора в SS.mmm
export function formatSector(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
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

export const CLASS_COLORS: Record<string, string> = {
  Hypercar: "hsl(var(--chart-1))",
  Hyper: "hsl(var(--chart-1))",
  LMP2: "hsl(var(--chart-4))",
  LMP3: "hsl(var(--chart-5))",
  GTE: "hsl(var(--chart-3))",
  GT3: "hsl(var(--chart-2))",
};

/** Цвет для графиков по классу машины; неизвестный/отсутствующий класс — нейтральный. */
export function getClassChartColor(carClass?: string | null): string {
  return (carClass && CLASS_COLORS[carClass]) || "hsl(var(--muted-foreground))";
}

export const CONDITION_LABELS: Record<string, string> = {
  "Сухо": "Сухо",
  "Дождь": "Дождь",
  "Смешанно": "Смешанно",
};

export function countryFlag(code: string): string {
  const map: Record<string, string> = {
    RU: "🇷🇺", IT: "🇮🇹", GB: "🇬🇧", JP: "🇯🇵", FR: "🇫🇷",
    DE: "🇩🇪", US: "🇺🇸",
  };
  return map[code] ?? "🏁";
}
