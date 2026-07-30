/**
 * Проекция GPS-точек (lat/lon) в локальные SVG-координаты для отрисовки трассы
 * по реальной телеметрии круга. Трасса физически мала (км), поэтому простой
 * эквидистантной проекции вокруг среднего меридиана достаточно — без искажений,
 * заметных на масштабе одного круга.
 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

export interface ProjectionBounds {
  cosLat: number;
  minX: number;
  minY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Считает масштаб/смещение проекции по переданным точкам — вынесено из
 * `projectTrackPoints`, чтобы одни и те же bounds можно было переиспользовать
 * для ДВУХ кругов сразу (текущий + эталонный призрак, см. `TelemetryTrackMap`).
 * Если проецировать каждый круг отдельным вызовом `projectTrackPoints`, у
 * каждого будет свой авто-фит масштаб/смещение под собственный bounding box —
 * два круга физически по одной трассе перестанут совпадать на холсте.
 */
export function computeProjectionBounds(
  points: GeoPoint[],
  width: number,
  height: number,
  padding = 16,
): ProjectionBounds | null {
  if (points.length === 0) return null;

  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180);

  // x растёт с долготой (восток), y инвертирован — SVG растёт вниз, широта вверх.
  const projected = points.map((p) => ({ x: p.lon * cosLat, y: -p.lat }));

  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const availW = Math.max(width - padding * 2, 1);
  const availH = Math.max(height - padding * 2, 1);
  const scale = Math.min(availW / spanX, availH / spanY);

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;

  return {
    cosLat,
    minX,
    minY,
    scale,
    offsetX: padding + (availW - drawnW) / 2,
    offsetY: padding + (availH - drawnH) / 2,
  };
}

/** Проецирует точки по уже посчитанным `bounds` (см. `computeProjectionBounds`). */
export function projectWithBounds(points: GeoPoint[], bounds: ProjectionBounds): SvgPoint[] {
  return points.map((p) => ({
    x: bounds.offsetX + (p.lon * bounds.cosLat - bounds.minX) * bounds.scale,
    y: bounds.offsetY + (-p.lat - bounds.minY) * bounds.scale,
  }));
}

export function projectTrackPoints(points: GeoPoint[], width: number, height: number, padding = 16): SvgPoint[] {
  const bounds = computeProjectionBounds(points, width, height, padding);
  if (!bounds) return [];
  return projectWithBounds(points, bounds);
}

export function pointsToPath(points: SvgPoint[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/**
 * Направление движения (радианы, ось Y вниз) в точке `index` по траектории.
 * `spread` — на сколько точек в обе стороны от `index` брать соседей: соседние
 * GPS-сэмплы шумные (дают дёрганое/неточное направление), поэтому по умолчанию
 * берём точки на некотором удалении — локальное направление получается устойчивее.
 */
export function headingAt(points: SvgPoint[], index: number, spread = 5): number {
  const n = points.length;
  if (n < 2) return 0;
  const a = points[Math.max(0, index - spread)];
  const b = points[Math.min(n - 1, index + spread)];
  if (a.x === b.x && a.y === b.y) return 0;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Вершины треугольника-стрелки (для <polygon points>), направленного по `headingRad`. */
export function arrowPolygonPoints(cx: number, cy: number, headingRad: number, length: number, width: number): string {
  const tip = { x: cx + Math.cos(headingRad) * length * 0.6, y: cy + Math.sin(headingRad) * length * 0.6 };
  const backCenter = { x: cx - Math.cos(headingRad) * length * 0.4, y: cy - Math.sin(headingRad) * length * 0.4 };
  const perp = headingRad + Math.PI / 2;
  const half = width / 2;
  const left = { x: backCenter.x + Math.cos(perp) * half, y: backCenter.y + Math.sin(perp) * half };
  const right = { x: backCenter.x - Math.cos(perp) * half, y: backCenter.y - Math.sin(perp) * half };
  return [tip, left, right].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/** Точка, смещённая от (cx, cy) на `distance` перпендикулярно `headingRad` — для подписей рядом с траекторией, не поверх неё. */
export function offsetPerpendicular(cx: number, cy: number, headingRad: number, distance: number): SvgPoint {
  const perp = headingRad + Math.PI / 2;
  return { x: cx + Math.cos(perp) * distance, y: cy + Math.sin(perp) * distance };
}

/** Концы отрезка, перпендикулярного `headingRad`, центрированного в (cx, cy) — линия старт/финиша поперёк полотна трассы. */
export function perpendicularSegment(
  cx: number,
  cy: number,
  headingRad: number,
  length: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const perp = headingRad + Math.PI / 2;
  const half = length / 2;
  return {
    x1: cx + Math.cos(perp) * half,
    y1: cy + Math.sin(perp) * half,
    x2: cx - Math.cos(perp) * half,
    y2: cy - Math.sin(perp) * half,
  };
}
