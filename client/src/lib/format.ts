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
export function formatSector(ms: number): string {
  if (!ms || ms <= 0) return "—";
  const seconds = Math.floor(ms / 1000);
  const millis = ms % 1000;
  return `${seconds}.${String(millis).padStart(3, "0")}`;
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
  LMP2: "hsl(var(--chart-4))",
  GTE: "hsl(var(--chart-3))",
};

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
