/**
 * Сравнение текущего круга с эталонным (любым другим кругом ТОЙ ЖЕ записи
 * телеметрии) — выравнивание по пройденной дистанции круга (`lapDist`), не по
 * времени/индексу сэмпла: частота сэмплов вдоль круга неравномерна (плотнее в
 * медленных поворотах), а дистанция — единственная общая шкала для двух
 * кругов разной длительности.
 */
import type { TelemetryLapPoint } from "@/lib/api";

export interface InterpolatedPoint {
  t: number;
  lat: number | null;
  lon: number | null;
  speedKph: number | null;
  throttle: number | null;
  brake: number | null;
}

function toInterpolated(p: TelemetryLapPoint): InterpolatedPoint {
  return { t: p.t, lat: p.lat, lon: p.lon, speedKph: p.speedKph, throttle: p.throttle, brake: p.brake };
}

function lerp(a: number, b: number, frac: number): number {
  return a + (b - a) * frac;
}

function lerpNullable(a: number | null, b: number | null, frac: number): number | null {
  if (a == null || b == null) return a ?? b;
  return lerp(a, b, frac);
}

/**
 * Значение круга `points` на дистанции `distM`, линейной интерполяцией между
 * двумя ближайшими (по `lapDist`) сэмплами. За пределами диапазона круга —
 * крайнее известное значение, без экстраполяции (тот же принцип, что для
 * выравнивания каналов телеметрии на сервере, см. `getLapSeries`, §5.3).
 * `points` считаются идущими по кругу в порядке движения (`lapDist`
 * монотонно растёт) — это гарантируется тем, что это сэмплы одного круга.
 */
export function interpolateAtDistance(points: TelemetryLapPoint[], distM: number): InterpolatedPoint | null {
  const withDist = points.filter((p): p is TelemetryLapPoint & { lapDist: number } => p.lapDist != null);
  if (withDist.length === 0) return null;

  const first = withDist[0];
  const last = withDist[withDist.length - 1];
  if (distM <= first.lapDist) return toInterpolated(first);
  if (distM >= last.lapDist) return toInterpolated(last);

  for (let i = 0; i + 1 < withDist.length; i++) {
    const a = withDist[i];
    const b = withDist[i + 1];
    if (distM >= a.lapDist && distM <= b.lapDist) {
      const span = b.lapDist - a.lapDist || 1;
      const frac = (distM - a.lapDist) / span;
      return {
        t: lerp(a.t, b.t, frac),
        lat: lerpNullable(a.lat, b.lat, frac),
        lon: lerpNullable(a.lon, b.lon, frac),
        speedKph: lerpNullable(a.speedKph, b.speedKph, frac),
        throttle: lerpNullable(a.throttle, b.throttle, frac),
        brake: lerpNullable(a.brake, b.brake, frac),
      };
    }
  }
  return toInterpolated(last);
}

export interface DeltaSample {
  distM: number;
  deltaMs: number;
}

/**
 * Отставание/выигрыш `currentPoints` от `referencePoints` по дистанции круга:
 * для каждой точки текущего круга — разница накопленного времени (elapsed =
 * t - t0) между текущим кругом и эталоном НА ТОЙ ЖЕ дистанции. Положительное
 * значение — текущий круг к этой точке медленнее эталона (потерял время),
 * отрицательное — быстрее (выиграл).
 */
export function buildDeltaSeries(
  currentPoints: TelemetryLapPoint[],
  referencePoints: TelemetryLapPoint[],
): DeltaSample[] {
  const currentWithDist = currentPoints.filter((p): p is TelemetryLapPoint & { lapDist: number } => p.lapDist != null);
  const referenceWithDist = referencePoints.filter((p) => p.lapDist != null);
  if (currentWithDist.length === 0 || referenceWithDist.length === 0) return [];

  const t0Current = currentWithDist[0].t;
  const t0Reference = referenceWithDist[0].t;

  const result: DeltaSample[] = [];
  for (const p of currentWithDist) {
    const refAtDist = interpolateAtDistance(referencePoints, p.lapDist);
    if (!refAtDist) continue;
    const currentElapsedSec = p.t - t0Current;
    const referenceElapsedSec = refAtDist.t - t0Reference;
    result.push({ distM: p.lapDist, deltaMs: (currentElapsedSec - referenceElapsedSec) * 1000 });
  }
  return result;
}

/** Знаковая дельта в секундах с миллисекундами, например «+0.672» / «-0.107» / «0.000». */
export function formatSignedDeltaMs(deltaMs: number): string {
  if (deltaMs === 0) return "0.000";
  const sign = deltaMs > 0 ? "+" : "-";
  return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(3)}`;
}
