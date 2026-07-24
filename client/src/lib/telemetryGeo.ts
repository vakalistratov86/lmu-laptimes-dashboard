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

export function projectTrackPoints(points: GeoPoint[], width: number, height: number, padding = 16): SvgPoint[] {
  if (points.length === 0) return [];

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
  const offsetX = padding + (availW - drawnW) / 2;
  const offsetY = padding + (availH - drawnH) / 2;

  return projected.map((p) => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (p.y - minY) * scale,
  }));
}

export function pointsToPath(points: SvgPoint[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}
