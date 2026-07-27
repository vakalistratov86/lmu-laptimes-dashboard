/**
 * Раскраска траектории по скорости и метки макс./мин. скорости для поворотов —
 * общая логика для SVG-схемы трассы и спутниковой карты на странице телеметрии.
 */
import { headingAt, type SvgPoint } from "@/lib/telemetryGeo";

export interface SpeedSample extends SvgPoint {
  speedKph: number;
  distM: number;
}

export interface ColoredSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

/** Цвет точки по её положению между `minKph` и `maxKph`: зелёный (медленно) -> жёлтый -> красный (быстро). */
export function speedToColor(speedKph: number, minKph: number, maxKph: number): string {
  const span = maxKph - minKph || 1;
  const t = Math.min(1, Math.max(0, (speedKph - minKph) / span));
  const hue = 120 * (1 - t);
  return `hsl(${hue.toFixed(0)}, 75%, 45%)`;
}

/**
 * Раскрашенные по скорости отрезки траектории. Точки прореживаются до
 * `maxSegments`, чтобы не плодить тысячи DOM-узлов на длинном круге — цвет
 * каждого отрезка берётся по средней скорости между его концами.
 */
export function buildColoredSegments(samples: SpeedSample[], maxSegments = 500): ColoredSegment[] {
  if (samples.length < 2) return [];

  const speeds = samples.map((s) => s.speedKph);
  const minKph = Math.min(...speeds);
  const maxKph = Math.max(...speeds);

  const step = Math.max(1, Math.floor((samples.length - 1) / maxSegments));
  const segments: ColoredSegment[] = [];
  for (let i = 0; i + 1 < samples.length; i += step) {
    const a = samples[i];
    const b = samples[Math.min(samples.length - 1, i + step)];
    const avgSpeed = (a.speedKph + b.speedKph) / 2;
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: speedToColor(avgSpeed, minKph, maxKph) });
  }
  return segments;
}

export interface CornerSpeedMarker {
  maxSpeed: SpeedSample;
  maxSpeedHeading: number;
  minSpeed: SpeedSample;
  minSpeedHeading: number;
}

/** Скользящее среднее скорости по РАССТОЯНИЮ (не по числу сэмплов) — плотность сэмплов
 * телеметрии сильно неравномерна (плотнее в медленных поворотах, реже на разгоне),
 * поэтому окно по числу точек «плывёт» по факту в метрах. `samples` должны идти по
 * кругу в порядке движения (distM монотонно растёт) — это выполняется, т.к. это один круг.
 */
function smoothSpeedByDistance(samples: SpeedSample[], radiusM: number): number[] {
  const n = samples.length;
  const smoothed = new Array<number>(n);
  let lo = 0;
  let hi = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    while (hi < n && samples[hi].distM - samples[i].distM <= radiusM) {
      sum += samples[hi].speedKph;
      hi++;
    }
    while (lo < i && samples[i].distM - samples[lo].distM > radiusM) {
      sum -= samples[lo].speedKph;
      lo++;
    }
    smoothed[i] = sum / (hi - lo);
  }
  return smoothed;
}

/**
 * Для каждого поворота круга — точка максимальной скорости перед ним (конец
 * разгона/точка торможения) и минимальная скорость в апексе.
 *
 * Экстремумы профиля скорости ищутся классическим zig-zag алгоритмом (как для
 * поиска пиков/впадин в биржевых котировках): текущий предполагаемый экстремум
 * просто сдвигается вслед за трендом, пока скорость не отойдёт от него хотя бы
 * на `minDropKph` — только тогда экстремум подтверждается и начинается поиск
 * противоположного. Это устойчиво к шуму телеметрии на длинных монотонных
 * участках (разгон/торможение) — в отличие от поиска локальных минимумов «в
 * лоб», здесь шумная кочка на общем тренде не порождает ложную метку, пока не
 * наберёт полный перепад скорости сама по себе.
 */
export function detectCornerSpeedMarkers(
  samples: SpeedSample[],
  opts: { smoothRadiusM?: number; minDropKph?: number } = {},
): CornerSpeedMarker[] {
  const { smoothRadiusM = 20, minDropKph = 15 } = opts;
  const n = samples.length;
  if (n < 5) return [];

  const smoothed = smoothSpeedByDistance(samples, smoothRadiusM);

  const extrema: { index: number; type: "max" | "min" }[] = [];
  let dir: 1 | -1 | 0 = 0;
  let extIdx = 0;
  for (let i = 1; i < n; i++) {
    if (dir >= 0 && smoothed[i] > smoothed[extIdx]) {
      extIdx = i;
      dir = 1;
    } else if (dir <= 0 && smoothed[i] < smoothed[extIdx]) {
      extIdx = i;
      dir = -1;
    }

    if (dir === 1 && smoothed[extIdx] - smoothed[i] >= minDropKph) {
      extrema.push({ index: extIdx, type: "max" });
      extIdx = i;
      dir = -1;
    } else if (dir === -1 && smoothed[i] - smoothed[extIdx] >= minDropKph) {
      extrema.push({ index: extIdx, type: "min" });
      extIdx = i;
      dir = 1;
    }
  }

  const positions: SvgPoint[] = samples;
  const markers: CornerSpeedMarker[] = [];
  for (let i = 0; i < extrema.length; i++) {
    if (extrema[i].type !== "min") continue;
    const minIdx = extrema[i].index;

    let maxIdx: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (extrema[j].type === "max") {
        maxIdx = extrema[j].index;
        break;
      }
    }
    if (maxIdx == null) {
      // Начало круга — подтверждённого максимума ещё не было, берём пик от старта.
      maxIdx = 0;
      for (let k = 0; k <= minIdx; k++) {
        if (samples[k].speedKph > samples[maxIdx].speedKph) maxIdx = k;
      }
    }

    markers.push({
      maxSpeed: samples[maxIdx],
      maxSpeedHeading: headingAt(positions, maxIdx),
      minSpeed: samples[minIdx],
      minSpeedHeading: headingAt(positions, minIdx),
    });
  }

  return markers;
}
