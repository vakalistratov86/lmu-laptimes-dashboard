/**
 * Калибровка «фото трассы ⇄ GPS» для спутниковой карты на странице телеметрии.
 *
 * ВАЖНО: каналы телеметрии `GPS Latitude`/`GPS Longitude` (LMU/rFactor2) —
 * это НЕ настоящие мировые координаты. Проверено на реальных данных: для
 * Spa-Francorchamps они лежат в районе (60°, 0°) — Северное море, а не
 * Бельгия. При этом `lapDist` — настоящие метры по кругу, и разброс
 * fake-координат по кругу (в градусах) совпадает по масштабу с настоящим
 * (симулятор просто использует другое, обобщённое начало координат).
 *
 * Поэтому калибровка двухэтапная:
 *
 * 1) `fakeToReal` — аффинное преобразование fake GPS -> настоящие GPS,
 *    подобранное per-трасса. Найдено так: полный круг телеметрии (~15000
 *    точек одного заезда по Spa) сопоставлен с настоящей осевой линией
 *    трассы, собранной из OSM way'ев `highway=raceway` (Overpass API),
 *    склеенных в одну упорядоченную петлю по общим концам (35 way,
 *    итоговая длина 6994.6 м — совпадает с паспортной длиной круга Spa,
 *    ~7004 м). Обе кривые параметризованы пройденной дистанцией; сдвиг
 *    фазы и направление объезда найдены перебором (минимум СКО), после
 *    чего 700 точек обеих кривых сведены в МНК-аффину fake -> real.
 *    Остаточная ошибка (после аффины): ~7–8 м СКО, максимум ~16 м на
 *    исходном круге; проверено на НЕЗАВИСИМОМ круге той же сессии без
 *    переподбора — ошибка того же порядка (~9.5 м средняя, макс ~16 м),
 *    т.е. коэффициенты — свойство трассы/симулятора, а не конкретного
 *    круга. Точность порядка ширины полотна дороги (~10–12 м) — этого
 *    достаточно для визуального наложения траектории на фото.
 *
 * 2) Настоящие GPS -> пиксель снимка — стандартная проекция Web Mercator
 *    (см. `projectWebMercator`), т.к. `spa-francorchamps.webp` — обрезанный
 *    кроп мозаики тайлов Esri World Imagery (server.arcgisonline.com/
 *    .../World_Imagery/MapServer/tile/{z}/{y}/{x}), zoom=19, склеенных по
 *    bbox трассы и уменьшенных при экспорте (см. `exportScale`). Здесь
 *    калибровка точная по построению — проверена наложением того же
 *    OSM-контура на снимок: лёг точно на асфальт по всему кругу.
 *
 * Для НОВОЙ трассы: калибровку п.2 (Web Mercator) переиспользовать сразу;
 * `fakeToReal` для неё нужно подбирать заново тем же способом (нужна хотя
 * бы одна реальная запись телеметрии этой трассы и OSM-геометрия
 * `highway=raceway`).
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface ImagePoint {
  x: number;
  y: number;
}

/** Коэффициенты вида real = a*fakeLat + b*fakeLon + c. */
interface AffineCoef {
  a: number;
  b: number;
  c: number;
}

interface SatelliteMapCalibration {
  /** Путь к изображению в client/public. */
  image: string;
  naturalWidth: number;
  naturalHeight: number;
  /** fake GPS телеметрии -> настоящие GPS (см. комментарий выше). */
  fakeToReal: { lat: AffineCoef; lon: AffineCoef };
  /** Zoom уровень тайлов Web Mercator, с которым построен снимок. */
  zoom: number;
  /** Левый верхний угол кропа в полном пиксельном пространстве Web Mercator на этом zoom. */
  originPx: ImagePoint;
  /** Итоговое изображение / полноразмерный кроп (во сколько раз уменьшили при экспорте). */
  exportScale: number;
}

const TILE_SIZE = 256;

function applyAffine(point: GeoPoint, coef: { lat: AffineCoef; lon: AffineCoef }): GeoPoint {
  return {
    lat: coef.lat.a * point.lat + coef.lat.b * point.lon + coef.lat.c,
    lon: coef.lon.a * point.lat + coef.lon.b * point.lon + coef.lon.c,
  };
}

/** Стандартная проекция Web Mercator: GPS -> пиксель в глобальной тайловой сетке заданного zoom. */
function projectWebMercator(point: GeoPoint, zoom: number): ImagePoint {
  const n = 2 ** zoom;
  const x = ((point.lon + 180) / 360) * n * TILE_SIZE;
  const latRad = (point.lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
  return { x, y };
}

const SATELLITE_MAPS: Record<string, SatelliteMapCalibration> = {
  "Spa-Francorchamps": {
    image: "/track-maps/spa-francorchamps.webp",
    naturalWidth: 3600,
    naturalHeight: 5134,
    fakeToReal: {
      lat: { a: 1.00065577, b: -0.01563752, c: -9.60200706 },
      lon: { a: 0.05754785, b: 0.78015833, c: 2.51510663 },
    },
    zoom: 19,
    originPx: { x: 69329095, y: 45257831 },
    exportScale: 3600 / 9535,
  },
};

/**
 * `trackName` в записях телеметрии (импорт .duckdb) не проходит через
 * серверный `normalizeTrackName` (используется только путём импорта
 * лаптаймов) — в реальных данных встречается, например, полное имя
 * "Circuit de Spa-Francorchamps" вместо каталожного "Spa-Francorchamps".
 * Поэтому здесь — терпимое сопоставление по вхождению подстроки, а не
 * точный ключ словаря.
 */
function resolveSatelliteMapKey(trackName: string): string | null {
  const t = trackName.trim().toLowerCase();
  if (t.includes("spa-francorchamps") || t.includes("spa francorchamps")) return "Spa-Francorchamps";
  return null;
}

export function hasSatelliteMap(trackName: string | null | undefined): boolean {
  return !!trackName && resolveSatelliteMapKey(trackName) != null;
}

export function getSatelliteMapCalibration(trackName: string): SatelliteMapCalibration | null {
  const key = resolveSatelliteMapKey(trackName);
  return key ? SATELLITE_MAPS[key] : null;
}

/** GPS-точка телеметрии (fake) -> координата в пикселях изображения (натуральный размер, как в <img>/viewBox). */
export function geoToImagePixel(trackName: string, point: GeoPoint): ImagePoint | null {
  const calib = getSatelliteMapCalibration(trackName);
  if (!calib) return null;
  const real = applyAffine(point, calib.fakeToReal);
  const full = projectWebMercator(real, calib.zoom);
  return {
    x: (full.x - calib.originPx.x) * calib.exportScale,
    y: (full.y - calib.originPx.y) * calib.exportScale,
  };
}
