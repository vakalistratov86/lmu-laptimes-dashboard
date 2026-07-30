import { useMemo } from "react";
import { geoToImagePixel, getSatelliteMapCalibration, type ImagePoint } from "@/lib/trackMapCalibration";
import { headingAt, arrowPolygonPoints, perpendicularSegment, offsetPerpendicular } from "@/lib/telemetryGeo";
import { buildColoredSegments, detectCornerSpeedMarkers, type SpeedSample } from "@/lib/telemetrySpeed";
import { interpolateAtDistance } from "@/lib/telemetryReference";
import type { MapZoomPanControls } from "@/hooks/use-map-zoom-pan";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface SatelliteTrackMapProps {
  points: TelemetryLapPoint[];
  hoverIndex: number | null;
  trackName: string;
  /** См. `TelemetryTrackMapProps.referencePoints` — эталонный круг для призрака. */
  referencePoints?: TelemetryLapPoint[];
  /** Зум/пан — управляется снаружи (см. `TelemetryTrackMap`), одним хуком на оба
   * режима карты (схема/спутник), чтобы левый тулбар в `TelemetryDetail` был
   * единственным источником зума, а не дублировался в углу карты. */
  zoomPan: MapZoomPanControls;
}

export function SatelliteTrackMap({ points, hoverIndex, trackName, referencePoints, zoomPan }: SatelliteTrackMapProps) {
  const { t } = useLanguage();
  const calibration = getSatelliteMapCalibration(trackName);
  const { view, containerRef, onWheel, onPointerDown, onPointerMove, onPointerUp } = zoomPan;

  const naturalWidth = calibration?.naturalWidth ?? 0;
  const naturalHeight = calibration?.naturalHeight ?? 0;

  const svgPoints = useMemo(() => {
    return points.map((p) =>
      p.lat != null && p.lon != null ? geoToImagePixel(trackName, { lat: p.lat, lon: p.lon }) : null,
    );
  }, [points, trackName]);

  // Точки без GPS (null) выкидываются в отдельный компактный массив — по нему
  // считаем направление движения (headingAt) и путь, не спотыкаясь о дыры.
  const validPoints = useMemo(() => svgPoints.filter((p): p is ImagePoint => p != null), [svgPoints]);

  const path = useMemo(() => {
    if (validPoints.length === 0) return "";
    return validPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }, [validPoints]);

  const start = validPoints[0] ?? null;
  const startHeading = useMemo(() => headingAt(validPoints, 0), [validPoints]);
  const startLine = start ? perpendicularSegment(start.x, start.y, startHeading, 42) : null;

  const cursor = hoverIndex != null ? (svgPoints[hoverIndex] ?? null) : null;
  const cursorCompactIndex = useMemo(
    () => (hoverIndex != null ? svgPoints.slice(0, hoverIndex + 1).filter((p) => p != null).length - 1 : -1),
    [svgPoints, hoverIndex],
  );
  const cursorHeading = cursorCompactIndex >= 0 ? headingAt(validPoints, cursorCompactIndex) : 0;

  // Проекция эталонного круга — та же калибровка "трасса -> пиксель снимка",
  // абсолютная для трассы (не авто-фит по bounding box одного круга), поэтому,
  // в отличие от схематичной SVG-проекции, два круга здесь совпадают без
  // дополнительных общих bounds. Сэмплы с известными distM и пикселем идут
  // рядом в одном массиве — иначе индекс "ближайшего по дистанции" разъехался
  // бы с индексом в отфильтрованном (без null) массиве пикселей.
  const referenceSamples = useMemo(() => {
    if (!referencePoints || referencePoints.length === 0) return [];
    const samples: { distM: number; point: ImagePoint }[] = [];
    for (const p of referencePoints) {
      if (p.lapDist == null || p.lat == null || p.lon == null) continue;
      const point = geoToImagePixel(trackName, { lat: p.lat, lon: p.lon });
      if (point) samples.push({ distM: p.lapDist, point });
    }
    return samples;
  }, [referencePoints, trackName]);

  const ghost = useMemo(() => {
    if (!referencePoints || referencePoints.length === 0 || hoverIndex == null || referenceSamples.length === 0) {
      return null;
    }
    const currentDist = points[hoverIndex]?.lapDist;
    if (currentDist == null) return null;
    const interp = interpolateAtDistance(referencePoints, currentDist);
    if (!interp || interp.lat == null || interp.lon == null) return null;
    const projected = geoToImagePixel(trackName, { lat: interp.lat, lon: interp.lon });
    if (!projected) return null;

    let nearestIdx = 0;
    let nearestDiff = Infinity;
    for (let i = 0; i < referenceSamples.length; i++) {
      const diff = Math.abs(referenceSamples[i].distM - currentDist);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIdx = i;
      }
    }
    const heading = headingAt(
      referenceSamples.map((s) => s.point),
      nearestIdx,
    );
    return { x: projected.x, y: projected.y, heading };
  }, [referencePoints, hoverIndex, points, trackName, referenceSamples]);

  const speedSamples = useMemo(() => {
    const result: SpeedSample[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const sp = svgPoints[i];
      if (sp && p.speedKph != null && p.lapDist != null) {
        result.push({ x: sp.x, y: sp.y, speedKph: p.speedKph, distM: p.lapDist });
      }
    }
    return result;
  }, [points, svgPoints]);

  const coloredSegments = useMemo(() => buildColoredSegments(speedSamples, 500), [speedSamples]);
  const cornerMarkers = useMemo(() => detectCornerSpeedMarkers(speedSamples), [speedSamples]);

  if (!calibration) return null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-muted/40"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label={t("telemetryPage.satelliteMapAria")}
    >
      {view && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        >
          <img
            src={calibration.image}
            width={naturalWidth}
            height={naturalHeight}
            alt=""
            draggable={false}
            className="pointer-events-none block max-w-none select-none"
          />
          <svg
            width={naturalWidth}
            height={naturalHeight}
            viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
            className="pointer-events-none absolute inset-0"
          >
            {coloredSegments.length > 0 ? (
              coloredSegments.map((seg, i) => (
                <line
                  key={i}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke={seg.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))
            ) : (
              <path
                d={path}
                fill="none"
                stroke="var(--color-primary, #ef4444)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {cornerMarkers.map((m, i) => {
              const maxPos = offsetPerpendicular(m.maxSpeed.x, m.maxSpeed.y, m.maxSpeedHeading, 55);
              const minPos = offsetPerpendicular(m.minSpeed.x, m.minSpeed.y, m.minSpeedHeading, 55);
              return (
                <g key={i}>
                  <circle cx={m.maxSpeed.x} cy={m.maxSpeed.y} r={9} fill="#16a34a" stroke="white" strokeWidth={2.5} />
                  <text
                    x={maxPos.x}
                    y={maxPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={54}
                    fontWeight={700}
                    fill="#16a34a"
                    stroke="white"
                    strokeWidth={10}
                    paintOrder="stroke"
                  >
                    {Math.round(m.maxSpeed.speedKph)}
                  </text>
                  <circle cx={m.minSpeed.x} cy={m.minSpeed.y} r={9} fill="#dc2626" stroke="white" strokeWidth={2.5} />
                  <text
                    x={minPos.x}
                    y={minPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={54}
                    fontWeight={700}
                    fill="#dc2626"
                    stroke="white"
                    strokeWidth={10}
                    paintOrder="stroke"
                  >
                    {Math.round(m.minSpeed.speedKph)}
                  </text>
                </g>
              );
            })}
            {startLine && (
              <line
                x1={startLine.x1}
                y1={startLine.y1}
                x2={startLine.x2}
                y2={startLine.y2}
                stroke="white"
                strokeWidth={9}
                strokeLinecap="round"
              />
            )}
            {startLine && (
              <line
                x1={startLine.x1}
                y1={startLine.y1}
                x2={startLine.x2}
                y2={startLine.y2}
                stroke="#0f172a"
                strokeWidth={4}
                strokeDasharray="7 7"
                strokeLinecap="butt"
              />
            )}
            {cursor && (
              <polygon
                points={arrowPolygonPoints(cursor.x, cursor.y, cursorHeading, 34, 22)}
                fill="var(--color-chart-2, #16a34a)"
                stroke="white"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            )}
            {ghost && (
              <polygon
                points={arrowPolygonPoints(ghost.x, ghost.y, ghost.heading, 34, 22)}
                fill="none"
                stroke="white"
                strokeWidth={4}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
}
