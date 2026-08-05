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

  it("матчинг регистронезависим (запасной вариант по названию)", () => {
    const content = findSteamContent(999, "le mans ultimate - 2024 pack 3");
    expect(content).not.toBeNull();
  });

  it("сопоставляет DLC по подтверждённому appid в приоритете", () => {
    // ELMS Pack 1 — appid 3954000, добавляет Silverstone и Ligier JS P325
    const content = findSteamContent(3954000, "Le Mans Ultimate - ELMS Pack 1");
    expect(content).toEqual({ tracks: ["Silverstone"], cars: [{ carClass: "LMP3", name: "Ligier JS P325" }] });
  });

  it("базовая игра не включает Silverstone/Paul Ricard/Barcelona — это платный ELMS-контент", () => {
    const content = findSteamContent(STEAM_BASE_APPID, "Le Mans Ultimate");
    expect(content!.tracks).not.toContain("Silverstone");
    expect(content!.tracks).not.toContain("Paul Ricard");
    expect(content!.tracks).not.toContain("Barcelona");
  });
});
