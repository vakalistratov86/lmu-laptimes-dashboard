import { describe, it, expect } from "vitest";
import { computeProjectionBounds, projectWithBounds, projectTrackPoints } from "../client/src/lib/telemetryGeo";

describe("computeProjectionBounds / projectWithBounds", () => {
  it("пустой массив точек -> bounds отсутствуют", () => {
    expect(computeProjectionBounds([], 400, 300)).toBeNull();
  });

  it("общие bounds по объединению точек дают согласованную проекцию для двух разных кругов", () => {
    // Круг А занимает диапазон шире круга Б — если бы каждый проецировался
    // отдельным вызовом projectTrackPoints (свой авто-фит), их общие точки
    // (0,0)/(1,-1) легли бы в РАЗНЫЕ пиксели. С общими bounds — в одни и те же.
    const lapA = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 1 },
    ];
    const lapB = [
      { lat: 0, lon: 0 },
      { lat: 0.5, lon: 0.5 },
    ];
    const bounds = computeProjectionBounds([...lapA, ...lapB], 400, 300);
    expect(bounds).not.toBeNull();

    const projA = projectWithBounds(lapA, bounds!);
    const projB = projectWithBounds(lapB, bounds!);

    // Общая точка (0,0) есть в обоих кругах — должна спроецироваться в один и тот же пиксель.
    expect(projA[0].x).toBeCloseTo(projB[0].x);
    expect(projA[0].y).toBeCloseTo(projB[0].y);
  });

  it("projectTrackPoints (одиночный круг) эквивалентен bounds+projectWithBounds по тем же точкам", () => {
    const points = [
      { lat: 50.1, lon: 5.9 },
      { lat: 50.2, lon: 6.0 },
      { lat: 50.05, lon: 5.95 },
    ];
    const direct = projectTrackPoints(points, 420, 320);
    const bounds = computeProjectionBounds(points, 420, 320);
    const viaBounds = projectWithBounds(points, bounds!);
    expect(viaBounds).toEqual(direct);
  });
});
