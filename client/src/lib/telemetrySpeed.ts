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

/** Цвет точки по её положению между `minKph` и `maxKph`: красный (медленно) -> жёлтый -> зелёный (быстро). */
export function speedToColor(speedKph: number, minKph: number, maxKph: number): string {
  const span = maxKph - minKph || 1;
  const t = Math.min(1, Math.max(0, (speedKph - minKph) / span));
  const hue = 120 * t;
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
 * Алгоритм — прямое отслеживание разворотов тренда скорости по кругу: пока
 * скорость растёт, просто ждём; как только она начинает падать — предыдущая
 * точка фиксируется как максимум. Дальше ждём, пока скорость падает; как
 * только она начинает расти — предыдущая точка фиксируется как минимум и
 * парится с последним зафиксированным максимумом. Так по всему кругу.
 * Перед поиском разворотов профиль сглаживается по дистанции — иначе
 * межсэмпловый шум телеметрии сам по себе создаёт разворот на каждом шаге.
 *
 * Соседние по кругу апексы ближе `minGapM` друг к другу схлопываются в один
 * (см. `filterCloseMarkers`) — иначе на карте в одном месте накладывается
 * несколько подписей.
 */
export function detectCornerSpeedMarkers(
  samples: SpeedSample[],
  opts: { smoothRadiusM?: number; minGapM?: number } = {},
): CornerSpeedMarker[] {
  const { smoothRadiusM = 20, minGapM = 40 } = opts;
  const n = samples.length;
  if (n < 3) return [];

  const smoothed = smoothSpeedByDistance(samples, smoothRadiusM);
  const positions: SvgPoint[] = samples;

  const markers: CornerSpeedMarker[] = [];
  let dir: 1 | -1 | 0 = 0;
  let pendingMaxIdx: number | null = 0;
  for (let i = 1; i < n; i++) {
    if (smoothed[i] > smoothed[i - 1]) {
      if (dir === -1 && pendingMaxIdx != null) {
        const minIdx = i - 1;
        markers.push({
          maxSpeed: samples[pendingMaxIdx],
          maxSpeedHeading: headingAt(positions, pendingMaxIdx),
          minSpeed: samples[minIdx],
          minSpeedHeading: headingAt(positions, minIdx),
        });
        pendingMaxIdx = null;
      }
      dir = 1;
    } else if (smoothed[i] < smoothed[i - 1]) {
      if (dir === 1) pendingMaxIdx = i - 1;
      dir = -1;
    }
  }

  return filterCloseMarkers(markers, minGapM);
}

/**
 * Если апексы двух меток оказались ближе `minGapM` метров друг к другу по
 * кругу — оставляем более выраженную (с большим перепадом макс./мин.
 * скорости), остальные из этого кластера отбрасываем. Классический
 * non-max-suppression: сортируем по перепаду скорости по убыванию, жадно
 * принимаем каждую, если она не ближе `minGapM` ни к одной уже принятой.
 */
function filterCloseMarkers(markers: CornerSpeedMarker[], minGapM: number): CornerSpeedMarker[] {
  if (markers.length <= 1) return markers;

  const ranked = markers
    .map((marker, index) => ({ marker, index, drop: marker.maxSpeed.speedKph - marker.minSpeed.speedKph }))
    .sort((a, b) => b.drop - a.drop);

  const accepted: typeof ranked = [];
  for (const candidate of ranked) {
    const tooClose = accepted.some(
      (a) => Math.abs(a.marker.minSpeed.distM - candidate.marker.minSpeed.distM) < minGapM,
    );
    if (!tooClose) accepted.push(candidate);
  }

  return accepted.sort((a, b) => a.index - b.index).map((a) => a.marker);
}
