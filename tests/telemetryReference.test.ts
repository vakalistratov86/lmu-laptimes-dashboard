import { describe, it, expect } from "vitest";
import { interpolateAtDistance, buildDeltaSeries, formatSignedDeltaMs } from "../client/src/lib/telemetryReference";
import type { TelemetryLapPoint } from "../client/src/lib/api";

function point(overrides: Partial<TelemetryLapPoint>): TelemetryLapPoint {
  return {
    seq: 0,
    t: 0,
    lapDist: null,
    lat: null,
    lon: null,
    throttle: null,
    brake: null,
    speedKph: null,
    ...overrides,
  };
}

describe("interpolateAtDistance", () => {
  const points = [
    point({ seq: 0, t: 10, lapDist: 0, speedKph: 100, lat: 50, lon: 5 }),
    point({ seq: 1, t: 11, lapDist: 100, speedKph: 200, lat: 51, lon: 6 }),
    point({ seq: 2, t: 12, lapDist: 200, speedKph: 150, lat: 52, lon: 7 }),
  ];

  it("линейно интерполирует между двумя ближайшими сэмплами по lapDist", () => {
    const result = interpolateAtDistance(points, 50);
    expect(result).not.toBeNull();
    expect(result!.speedKph).toBe(150); // ровно посередине между 100 и 200
    expect(result!.t).toBe(10.5);
    expect(result!.lat).toBe(50.5);
  });

  it("не экстраполирует за пределы круга — берёт крайнее значение", () => {
    expect(interpolateAtDistance(points, -50)!.speedKph).toBe(100);
    expect(interpolateAtDistance(points, 500)!.speedKph).toBe(150);
  });

  it("попадание точно в существующий сэмпл возвращает его как есть", () => {
    expect(interpolateAtDistance(points, 100)!.speedKph).toBe(200);
  });

  it("пустой круг или круг без lapDist -> null", () => {
    expect(interpolateAtDistance([], 10)).toBeNull();
    expect(interpolateAtDistance([point({ lapDist: null })], 10)).toBeNull();
  });

  it("игнорирует сэмплы без lapDist среди валидных", () => {
    const withGap = [
      point({ seq: 0, t: 0, lapDist: 0, speedKph: 100 }),
      point({ seq: 1, t: 100, lapDist: null, speedKph: 999 }), // должен быть пропущен
      point({ seq: 2, t: 1, lapDist: 100, speedKph: 200 }),
    ];
    expect(interpolateAtDistance(withGap, 50)!.speedKph).toBe(150);
  });
});

describe("buildDeltaSeries", () => {
  it("нулевая дельта, когда оба круга проходят дистанцию с одинаковым темпом", () => {
    const current = [point({ t: 0, lapDist: 0 }), point({ t: 1, lapDist: 100 }), point({ t: 2, lapDist: 200 })];
    const reference = [
      point({ t: 10, lapDist: 0 }), // другой t0 — сравниваются elapsed, не абсолютный t
      point({ t: 11, lapDist: 100 }),
      point({ t: 12, lapDist: 200 }),
    ];
    const series = buildDeltaSeries(current, reference);
    expect(series).toHaveLength(3);
    series.forEach((s) => expect(s.deltaMs).toBeCloseTo(0));
  });

  it("положительная дельта — текущий круг медленнее (отстаёт) на данной дистанции", () => {
    const current = [
      point({ t: 0, lapDist: 0 }),
      point({ t: 2, lapDist: 100 }), // 2с на первые 100м
    ];
    const reference = [
      point({ t: 0, lapDist: 0 }),
      point({ t: 1, lapDist: 100 }), // эталон те же 100м проехал за 1с — быстрее
    ];
    const series = buildDeltaSeries(current, reference);
    expect(series[1].deltaMs).toBeCloseTo(1000); // текущий потерял 1с к 100-му метру
  });

  it("отрицательная дельта — текущий круг быстрее (выигрывает) на данной дистанции", () => {
    const current = [point({ t: 0, lapDist: 0 }), point({ t: 1, lapDist: 100 })];
    const reference = [point({ t: 0, lapDist: 0 }), point({ t: 2, lapDist: 100 })];
    const series = buildDeltaSeries(current, reference);
    expect(series[1].deltaMs).toBeCloseTo(-1000);
  });

  it("пустой текущий или эталонный круг -> пустая серия", () => {
    expect(buildDeltaSeries([], [point({ lapDist: 0 })])).toEqual([]);
    expect(buildDeltaSeries([point({ lapDist: 0 })], [])).toEqual([]);
  });
});

describe("formatSignedDeltaMs", () => {
  it("положительная дельта — со знаком плюс", () => {
    expect(formatSignedDeltaMs(672)).toBe("+0.672");
  });

  it("отрицательная дельта — со знаком минус, без второго минуса", () => {
    expect(formatSignedDeltaMs(-107)).toBe("-0.107");
  });

  it("нулевая дельта — без знака", () => {
    expect(formatSignedDeltaMs(0)).toBe("0.000");
  });
});
