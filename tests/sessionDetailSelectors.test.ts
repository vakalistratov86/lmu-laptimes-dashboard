import { describe, it, expect } from "vitest";
import {
  buildSectorSummary,
  buildDriverLapGroups,
  buildLapProgressSeries,
} from "../client/src/lib/sessionDetailSelectors";

describe("sessionDetailSelectors — bug-audit regressions", () => {
  describe("buildSectorSummary", () => {
    it("theoreticalBest — «—», если хотя бы один сектор ни разу не зафиксирован (не 0)", () => {
      // У пилота никогда не приходит sector3 — раньше сумма молча считала его за 0.
      const laps = [
        { driverName: "Alpha", driverId: 1, lapNumber: 1, sector1: 25.0, sector2: 50.0 },
        { driverName: "Alpha", driverId: 1, lapNumber: 2, sector1: 24.5, sector2: 49.5 },
      ];
      const summary = buildSectorSummary(laps);
      expect(summary).toHaveLength(1);
      expect(summary[0].theoreticalBest).toBe("—");
    });

    it("theoreticalBest — корректная сумма, если все три сектора есть", () => {
      const laps = [{ driverName: "Alpha", driverId: 1, lapNumber: 1, sector1: 25.0, sector2: 50.0, sector3: 26.0 }];
      const summary = buildSectorSummary(laps);
      expect(summary[0].theoreticalBest).not.toBe("—");
    });

    it("пит-лап не должен побеждать как лучший сектор", () => {
      const laps = [
        // Пит-лап с подозрительно быстрым (усечённым) сектором.
        { driverName: "Alpha", driverId: 1, lapNumber: 1, sector1: 5.0, sector2: 50.0, sector3: 26.0, isPitLap: true },
        { driverName: "Alpha", driverId: 1, lapNumber: 2, sector1: 25.0, sector2: 50.0, sector3: 26.0 },
      ];
      const summary = buildSectorSummary(laps);
      // Лучший s1 должен быть 25.0 (обычный круг), а не 5.0 (пит-лап).
      expect(summary[0].bestSectors[0]).not.toBe("0:05.000");
    });

    it("не сливает двух разных пилотов с одинаковым именем в одну группу (ключ по driverId)", () => {
      const laps = [
        { driverName: "Alpha", driverId: 1, lapNumber: 1, sector1: 25.0, sector2: 50.0, sector3: 26.0 },
        { driverName: "Alpha", driverId: 2, lapNumber: 1, sector1: 30.0, sector2: 55.0, sector3: 28.0 },
      ];
      const summary = buildSectorSummary(laps);
      expect(summary).toHaveLength(2);
    });
  });

  describe("buildDriverLapGroups", () => {
    it("пит-лап не должен побеждать как личный/абсолютный лучший круг", () => {
      const laps = [
        { driverName: "Alpha", driverId: 1, lapNumber: 1, lapTimeSeconds: 10, isPitLap: true },
        { driverName: "Alpha", driverId: 1, lapNumber: 2, lapTimeSeconds: 100 },
      ];
      const groups = buildDriverLapGroups(laps);
      expect(groups).toHaveLength(1);
      // Личный лучший должен быть настоящий круг (100с), не пит-лап (10с).
      expect(groups[0].bestLapTime).not.toBe("0:10.000");
      const pitRow = groups[0].laps.find((l) => l.lapNumber === 1)!;
      const realRow = groups[0].laps.find((l) => l.lapNumber === 2)!;
      expect(pitRow.isPersonalBest).toBe(false);
      expect(realRow.isPersonalBest).toBe(true);
    });

    it("не сливает двух разных пилотов с одинаковым именем в одну группу (ключ по driverId)", () => {
      const laps = [
        { driverName: "Alpha", driverId: 1, lapNumber: 1, lapTimeSeconds: 100 },
        { driverName: "Alpha", driverId: 2, lapNumber: 1, lapTimeSeconds: 105 },
      ];
      const groups = buildDriverLapGroups(laps);
      expect(groups).toHaveLength(2);
      expect(groups.reduce((sum, g) => sum + g.laps.length, 0)).toBe(2);
    });

    it("без driverId по-прежнему группирует по имени (обратная совместимость)", () => {
      const laps = [
        { driverName: "Alpha", lapNumber: 1, lapTimeSeconds: 100 },
        { driverName: "Alpha", lapNumber: 2, lapTimeSeconds: 95 },
      ];
      const groups = buildDriverLapGroups(laps);
      expect(groups).toHaveLength(1);
      expect(groups[0].laps).toHaveLength(2);
    });
  });

  describe("buildLapProgressSeries", () => {
    it("не сливает двух разных пилотов с одинаковым именем в одну серию (ключ по driverId)", () => {
      const laps = [
        { driverName: "Alpha", driverId: 1, lapNumber: 1, lapTimeSeconds: 100 },
        { driverName: "Alpha", driverId: 2, lapNumber: 1, lapTimeSeconds: 105 },
      ];
      const series = buildLapProgressSeries(laps);
      expect(series).toHaveLength(2);
    });
  });
});
