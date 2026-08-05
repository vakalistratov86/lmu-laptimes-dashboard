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
    expect(content).toEqual({
      tracks: ["Silverstone"],
      cars: [{ carClass: "LMP3", name: "Ligier JS P325" }],
      includedDlc: [],
    });
  });

  it("базовая игра не включает Silverstone/Paul Ricard/Barcelona — это платный ELMS-контент", () => {
    const content = findSteamContent(STEAM_BASE_APPID, "Le Mans Ultimate");
    expect(content!.tracks).not.toContain("Silverstone");
    expect(content!.tracks).not.toContain("Paul Ricard");
    expect(content!.tracks).not.toContain("Barcelona");
  });

  // ── includedDlc: список уже вышедших паков, входящих в Season/Track Pass ──
  describe("includedDlc — состав подписок", () => {
    it("2024 Season Pass включает все 5 вышедших паков сезона", () => {
      const content = findSteamContent(2997280, "Le Mans Ultimate - 2024 Season Pass");
      expect(content!.includedDlc).toEqual(["2024 Pack 1", "2024 Pack 2", "2024 Pack 3", "2024 Pack 4", "2024 Pack 5"]);
    });

    it("ELMS Season Pass включает все 3 вышедших ELMS-пака", () => {
      const content = findSteamContent(3948300, "Le Mans Ultimate - ELMS Season Pass");
      expect(content!.includedDlc).toEqual(["ELMS Pack 1", "ELMS Pack 2", "ELMS Pack 3"]);
    });

    it("US Track Pass на сегодня включает только вышедший Pack 1 (Pack 2/3 ещё не вышли)", () => {
      const content = findSteamContent(4906890, "Le Mans Ultimate - US Track Pass");
      expect(content!.includedDlc).toEqual(["US Track Pack 1"]);
      // tracks подписки ограничены уже вышедшим контентом — не выдумываем
      // трассы паков 2/3, которые официально анонсированы, но ещё не вышли.
      expect(content!.tracks).toEqual(["Daytona International Speedway", "WeatherTech Raceway Laguna Seca"]);
    });

    it("обычные (не-Pass) DLC не имеют includedDlc", () => {
      const content = findSteamContent(2973290, "Le Mans Ultimate - 2024 Pack 1");
      expect(content!.includedDlc).toEqual([]);
    });
  });

  // ── tracks/cars подписки формируются из уже вышедших паков (не хардкодятся отдельно) ──
  describe("tracks/cars Season Pass — вычисляются из включённых паков", () => {
    it("2024 Season Pass: cars — объединение машин всех 5 паков сезона", () => {
      const content = findSteamContent(2997280, "Le Mans Ultimate - 2024 Season Pass");
      const names = content!.cars.map((c) => c.name).sort();
      expect(names).toEqual(
        [
          "Lamborghini SC63 LMDh",
          "Alpine A424 LMDh",
          "Isotta Fraschini Tipo 6 Competizione",
          "BMW M4 LMGT3",
          "Chevrolet Corvette Z06 LMGT3.R",
          "Ferrari 296 LMGT3",
          "Porsche 911 GT3 R (992) LMGT3",
          "Aston Martin Vantage AMR LMGT3",
          "Lexus RC F LMGT3",
          "Lamborghini Huracán GT3 EVO2",
        ].sort(),
      );
    });

    it("ELMS Season Pass: cars — объединение машин всех 3 ELMS-паков", () => {
      const content = findSteamContent(3948300, "Le Mans Ultimate - ELMS Season Pass");
      expect(content!.cars.map((c) => c.name).sort()).toEqual(
        ["Ligier JS P325", "Ginetta G61-LT-P3 Evo", "Duqueine D09"].sort(),
      );
    });

    it("US Track Pass: cars пусты, т.к. у вышедшего Pack 1 нет новых машин (только трассы)", () => {
      const content = findSteamContent(4906890, "Le Mans Ultimate - US Track Pass");
      expect(content!.cars).toEqual([]);
    });
  });
});
