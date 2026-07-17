/**
 * normalizer.test.ts — unit-тесты для server/normalizer.ts (#10)
 */
import { describe, it, expect } from "vitest";
import {
  normalizeTrackName,
  normalizeDriverNameForLookup,
  normalizeDriverNameForStorage,
  toMilliseconds,
  toUTCIsoString,
  toUTCDateString,
  normalizeLapTime,
} from "../server/normalizer";

describe("normalizeTrackName", () => {
  it("нормализует алиас 'Le Mans'", () => {
    expect(normalizeTrackName("Le Mans")).toBe("Circuit de la Sarthe");
  });

  it("нормализует алиас 'lemans' (lowercase без пробелов)", () => {
    expect(normalizeTrackName("lemans")).toBe("Circuit de la Sarthe");
  });

  it("нормализует 'spa francorchamps'", () => {
    expect(normalizeTrackName("spa francorchamps")).toBe("Spa-Francorchamps");
  });

  it("возвращает trim-строку для неизвестной трассы", () => {
    expect(normalizeTrackName("  Unknown Circuit  ")).toBe("Unknown Circuit");
  });

  it("нормализует COTA", () => {
    expect(normalizeTrackName("circuit of the americas")).toBe("COTA");
  });
});

describe("normalizeDriverNameForLookup", () => {
  it("приводит к lowercase и trim", () => {
    expect(normalizeDriverNameForLookup("  Max Verstappen  ")).toBe("max verstappen");
  });

  it("работает с кириллицей", () => {
    expect(normalizeDriverNameForLookup("Иван Иванов")).toBe("иван иванов");
  });
});

describe("normalizeDriverNameForStorage", () => {
  it("trim и collapse multiple spaces", () => {
    expect(normalizeDriverNameForStorage("  Lewis   Hamilton  ")).toBe("Lewis Hamilton");
  });
});

describe("toMilliseconds", () => {
  it("дробное значение < 3600 → секунды", () => {
    expect(toMilliseconds(95.432)).toBe(95432);
  });

  it("целое < 1000 → секунды", () => {
    expect(toMilliseconds(95)).toBe(95_000);
  });

  it("целое >= 1000 → уже мс", () => {
    expect(toMilliseconds(95_000)).toBe(95_000);
  });

  it("значение 0 → 0", () => {
    expect(toMilliseconds(0)).toBe(0);
  });

  it("дробное значение >= 3600 → мс (не секунды)", () => {
    // 3700.5 — точно мс (время > 1 часа в секундах маловероятно, но эвристика → мс)
    expect(toMilliseconds(3700.5)).toBe(3701);
  });
});

describe("toUTCIsoString", () => {
  it("возвращает ISO UTC строку для Date объекта", () => {
    const d = new Date("2025-06-10T12:00:00Z");
    expect(toUTCIsoString(d)).toBe("2025-06-10T12:00:00.000Z");
  });

  it("парсит строку и возвращает UTC ISO", () => {
    const result = toUTCIsoString("2025-06-10T14:00:00+02:00");
    expect(result).toBe("2025-06-10T12:00:00.000Z");
  });

  it("возвращает строку как есть при невалидной дате", () => {
    const result = toUTCIsoString("not-a-date");
    expect(result).toBe("not-a-date");
  });
});

describe("toUTCDateString", () => {
  it("возвращает только дату", () => {
    expect(toUTCDateString("2025-06-10T23:59:59+08:00")).toBe("2025-06-10");
  });
});

describe("normalizeLapTime", () => {
  const base = {
    driverName: "  Fernando  Alonso  ",
    trackName: "le mans",
    lapTimeMs: 210,       // секунды — 3:30
    sessionDate: new Date("2024-07-01T10:00:00Z"),
    carClass: "LMH",
  };

  it("нормализует имя пилота", () => {
    const result = normalizeLapTime(base);
    expect(result.driverName).toBe("Fernando Alonso");
  });

  it("нормализует название трассы через алиас", () => {
    const result = normalizeLapTime(base);
    expect(result.trackName).toBe("Circuit de la Sarthe");
  });

  it("конвертирует lapTimeMs из секунд в мс", () => {
    const result = normalizeLapTime(base);
    // 210 целое < 1000 → секунды → 210_000 мс
    expect(result.lapTimeMs).toBe(210_000);
  });

  it("не изменяет уже нормализованный lapTimeMs", () => {
    const result = normalizeLapTime({ ...base, lapTimeMs: 210_000 });
    expect(result.lapTimeMs).toBe(210_000);
  });

  it("sessionDate остаётся Date объектом", () => {
    const result = normalizeLapTime(base);
    expect(result.sessionDate).toBeInstanceOf(Date);
  });
});
