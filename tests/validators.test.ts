/**
 * validators.test.ts — unit-тесты для shared/validators.ts (#9)
 */
import { describe, it, expect } from "vitest";
import {
  LapTimeSchema,
  SessionEventSchema,
  validateLapTimeSemantic,
  validateLapTime,
} from "../shared/validators";

describe("LapTimeSchema — структурная валидация", () => {
  const validLap = {
    driverName: "Max Verstappen",
    trackName: "Le Mans",
    lapTimeMs: 180_000, // 3 минуты
    sessionDate: "2025-06-10T14:00:00Z",
    carClass: "LMH",
  };

  it("принимает валидный lap", () => {
    const result = LapTimeSchema.safeParse(validLap);
    expect(result.success).toBe(true);
  });

  it("отклоняет пустое driverName", () => {
    const result = LapTimeSchema.safeParse({ ...validLap, driverName: "" });
    expect(result.success).toBe(false);
  });

  it("отклоняет отрицательное lapTimeMs", () => {
    const result = LapTimeSchema.safeParse({ ...validLap, lapTimeMs: -1000 });
    expect(result.success).toBe(false);
  });

  it("отклоняет lapTimeMs > 24 часов", () => {
    const result = LapTimeSchema.safeParse({ ...validLap, lapTimeMs: 25 * 60 * 60 * 1000 });
    expect(result.success).toBe(false);
  });

  it("принимает lap без carClass (optional)", () => {
    const { carClass: _, ...withoutClass } = validLap;
    const result = LapTimeSchema.safeParse(withoutClass);
    expect(result.success).toBe(true);
  });

  it("принимает секторы", () => {
    const result = LapTimeSchema.safeParse({
      ...validLap,
      sector1Ms: 60_000,
      sector2Ms: 60_000,
      sector3Ms: 60_000,
    });
    expect(result.success).toBe(true);
  });
});

describe("validateLapTimeSemantic", () => {
  const base = {
    driverName: "Lewis Hamilton",
    trackName: "Spa",
    lapTimeMs: 120_000, // 2 минуты — OK
    sessionDate: new Date("2024-01-01T00:00:00Z"),
  };

  it("возвращает null для валидного круга", () => {
    expect(validateLapTimeSemantic(base)).toBeNull();
  });

  it("отклоняет lapTimeMs < 10s", () => {
    const result = validateLapTimeSemantic({ ...base, lapTimeMs: 5_000 });
    expect(result).toContain("физически невозможно");
  });

  it("отклоняет сумму секторов с расхождением > 5%", () => {
    const result = validateLapTimeSemantic({
      ...base,
      lapTimeMs: 120_000,
      sector1Ms: 50_000,
      sector2Ms: 50_000,
      sector3Ms: 50_000, // сумма 150_000 — расхождение 25%
    });
    expect(result).toContain("Сумма секторов");
  });

  it("принимает секторы с расхождением в пределах 5%", () => {
    // 120_000 * 5% = 6000 — допуск
    const result = validateLapTimeSemantic({
      ...base,
      lapTimeMs: 120_000,
      sector1Ms: 40_000,
      sector2Ms: 40_000,
      sector3Ms: 40_000, // сумма 120_000 — точно
    });
    expect(result).toBeNull();
  });

  it("отклоняет дату в будущем", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = validateLapTimeSemantic({ ...base, sessionDate: futureDate });
    expect(result).toContain("будущем");
  });
});

describe("validateLapTime — полный pipeline", () => {
  it("возвращает ok:true для корректных данных", () => {
    const result = validateLapTime({
      driverName: "Charles Leclerc",
      trackName: "Monza",
      lapTimeMs: 80_000,
      sessionDate: "2024-09-01T12:00:00Z",
    });
    expect(result.ok).toBe(true);
  });

  it("возвращает VALIDATION_ERROR для структурно невалидных данных", () => {
    const result = validateLapTime({ driverName: "", trackName: "Monza", lapTimeMs: 80_000, sessionDate: "2024-09-01" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("VALIDATION_ERROR");
  });

  it("возвращает SEMANTIC_ERROR для физически невозможного круга", () => {
    const result = validateLapTime({
      driverName: "Test Driver",
      trackName: "Test Track",
      lapTimeMs: 1_000, // 1 секунда
      sessionDate: "2024-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("SEMANTIC_ERROR");
  });
});

describe("SessionEventSchema", () => {
  it("принимает валидный event", () => {
    const result = SessionEventSchema.safeParse({
      venue: "Le Mans",
      sessionType: "Race",
      dateTimeIso: "2025-06-15T13:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет пустой venue", () => {
    const result = SessionEventSchema.safeParse({
      venue: "",
      sessionType: "Race",
      dateTimeIso: "2025-06-15T13:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});
