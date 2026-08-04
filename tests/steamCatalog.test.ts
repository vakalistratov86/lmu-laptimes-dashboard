import { describe, it, expect } from "vitest";
import { STEAM_BASE_APPID, findSteamContent } from "../server/steamCatalog";

describe("steamCatalog", () => {
  it("базовая игра имеет непустой список трасс и машин", () => {
    const content = findSteamContent(STEAM_BASE_APPID, "Le Mans Ultimate");
    expect(content).not.toBeNull();
    expect(content!.tracks.length).toBeGreaterThan(0);
    expect(content!.cars.length).toBeGreaterThan(0);
  });

  it("незнакомое название DLC не находит записи (null)", () => {
    const content = findSteamContent(123456, "Абсолютно неизвестный будущий DLC");
    expect(content).toBeNull();
  });

  it("каждая запись cars имеет непустые carClass и name", () => {
    const content = findSteamContent(STEAM_BASE_APPID, "Le Mans Ultimate");
    for (const car of content!.cars) {
      expect(car.carClass.length).toBeGreaterThan(0);
      expect(car.name.length).toBeGreaterThan(0);
    }
  });

  it("матчинг регистронезависим", () => {
    const content = findSteamContent(999, "le mans ultimate - 2024 season pack 3");
    expect(content).not.toBeNull();
  });
});
