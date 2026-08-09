import { describe, it, expect } from "vitest";
import { isOwnDriverName, findOwnDriver } from "../client/src/lib/driverMatch";
import type { DriverEnriched } from "@shared/schema";

function driver(id: number, name: string): DriverEnriched {
  return { id, name, team: "Team", country: "FR", isPlayer: 1 };
}

describe("isOwnDriverName", () => {
  it("совпадает при точном равенстве", () => {
    expect(isOwnDriverName("Max Verstappen", "Max Verstappen")).toBe(true);
  });

  it("не зависит от регистра и обрамляющих пробелов", () => {
    expect(isOwnDriverName("  Max Verstappen ", "max verstappen")).toBe(true);
  });

  it("не совпадает при разных именах", () => {
    expect(isOwnDriverName("Max Verstappen", "Lewis Hamilton")).toBe(false);
  });

  it("возвращает false, если одно из имён отсутствует", () => {
    expect(isOwnDriverName(undefined, "Max Verstappen")).toBe(false);
    expect(isOwnDriverName("Max Verstappen", undefined)).toBe(false);
    expect(isOwnDriverName(undefined, undefined)).toBe(false);
  });
});

describe("findOwnDriver", () => {
  const drivers = [driver(1, "Max Verstappen"), driver(2, "Lewis Hamilton")];

  it("находит пилота по точному совпадению имени (без учёта регистра)", () => {
    expect(findOwnDriver("lewis hamilton", drivers)?.id).toBe(2);
  });

  it("возвращает undefined, если совпадений нет", () => {
    expect(findOwnDriver("Fernando Alonso", drivers)).toBeUndefined();
  });

  it("возвращает undefined без displayName или без списка пилотов", () => {
    expect(findOwnDriver(undefined, drivers)).toBeUndefined();
    expect(findOwnDriver("Max Verstappen", undefined)).toBeUndefined();
  });
});
