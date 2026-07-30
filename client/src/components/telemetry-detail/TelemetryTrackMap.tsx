import { forwardRef, useImperativeHandle, useMemo } from "react";
import {
  computeProjectionBounds,
  projectWithBounds,
  pointsToPath,
  headingAt,
  arrowPolygonPoints,
  perpendicularSegment,
  offsetPerpendicular,
  type SvgPoint,
} from "@/lib/telemetryGeo";
import { buildColoredSegments, detectCornerSpeedMarkers, type SpeedSample } from "@/lib/telemetrySpeed";
import { interpolateAtDistance } from "@/lib/telemetryReference";
import { hasSatelliteMap, getSatelliteMapCalibration } from "@/lib/trackMapCalibration";
import { SatelliteTrackMap } from "@/components/telemetry-detail/SatelliteTrackMap";
import { useMapZoomPan } from "@/hooks/use-map-zoom-pan";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface TelemetryTrackMapProps {
  points: TelemetryLapPoint[];
  hoverIndex: number | null;
  trackName: string | null;
  /** Круг, выбранный эталоном для сравнения (см. `TelemetryLapPicker`) — если задан
   * (и в нём есть GPS), поверх карты рисуется второй, штриховой маркер-«призрак» на
   * той же дистанции круга, что и текущий курсор. */
  referencePoints?: TelemetryLapPoint[];
  /** Принудительно показать схематичную SVG-карту, даже если для трассы есть
   * спутниковая калибровка (см. переключатель подложки в `TelemetryDetail`). */
  forceSchematic?: boolean;
}

export interface TrackMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

// Более широкое (не квадратное 420x320) полотно — карта теперь занимает всю
// ширину страницы, а не карточку max-w-2xl, поэтому пропорции подобраны под
// широкий, а не узкий контейнер. Используется и как viewBox схемы, и как
// "естественный" размер холста для зума/пана (см. useMapZoomPan).
const WIDTH = 780;
const HEIGHT = 360;

export const TelemetryTrackMap = forwardRef<TrackMapHandle, TelemetryTrackMapProps>(function TelemetryTrackMap(
  { points, hoverIndex, trackName, referencePoints, forceSchematic },
  ref,
) {
  const { t } = useLanguage();

  const showSatellite = hasSatelliteMap(trackName) && !forceSchematic;
  const calibration = showSatellite ? getSatelliteMapCalibration(trackName as string) : null;
  const naturalWidth = calibration?.naturalWidth ?? WIDTH;
  const naturalHeight = calibration?.naturalHeight ?? HEIGHT;

  // Один хук зума/пана на оба режима карты (см. комментарий в SatelliteTrackMap) —
  // левый тулбар в TelemetryDetail всегда управляет ИМЕННО этим инстансом, вне
  // зависимости от того, схема сейчас показана или спутник. resetKey пересчитывает
  // fit-view при смене трассы или переключении схема/спутник (разный "натуральный"
  // размер холста).
  const zoomPan = useMapZoomPan({
    naturalWidth,
    naturalHeight,
    resetKey: `${trackName ?? ""}-${showSatellite}`,
  });

  useImperativeHandle(ref, () => ({ zoomIn: zoomPan.zoomIn, zoomOut: zoomPan.zoomOut, reset: zoomPan.reset }), [
    zoomPan.zoomIn,
    zoomPan.zoomOut,
    zoomPan.reset,
  ]);

  // Хуки должны вызываться безусловно на каждом рендере — поэтому проекция
  // для SVG-фолбэка считается всегда, а выбор ветки рендера (фото или SVG)
  // делается только в JSX ниже.
  //
  // Bounds считаются по ОБЪЕДИНЕНИЮ точек текущего и эталонного круга — если бы
  // каждый круг проецировался отдельно (свой авто-фит масштаб/смещение), два
  // круга по одной и той же физической трассе перестали бы совпадать на холсте.
  const bounds = useMemo(() => {
    const currentGeo = points.map((p) => ({ lat: p.lat ?? 0, lon: p.lon ?? 0 }));
    const referenceGeo = (referencePoints ?? []).map((p) => ({ lat: p.lat ?? 0, lon: p.lon ?? 0 }));
    return computeProjectionBounds([...currentGeo, ...referenceGeo], WIDTH, HEIGHT);
  }, [points, referencePoints]);

  const svgPoints = useMemo((): SvgPoint[] => {
    if (!bounds) return [];
    const geoPoints = points.map((p) => ({ lat: p.lat ?? 0, lon: p.lon ?? 0 }));
    return projectWithBounds(geoPoints, bounds);
  }, [points, bounds]);

  const referenceSvgPoints = useMemo((): SvgPoint[] => {
    if (!bounds || !referencePoints || referencePoints.length === 0) return [];
    const geoPoints = referencePoints.map((p) => ({ lat: p.lat ?? 0, lon: p.lon ?? 0 }));
    return projectWithBounds(geoPoints, bounds);
  }, [referencePoints, bounds]);

  const path = useMemo(() => pointsToPath(svgPoints), [svgPoints]);
  const startHeading = useMemo(() => headingAt(svgPoints, 0), [svgPoints]);
  const cursorHeading = useMemo(
    () => (hoverIndex != null ? headingAt(svgPoints, hoverIndex) : 0),
    [svgPoints, hoverIndex],
  );

  // Позиция "призрака" эталонного круга — интерполяция эталона на той же
  // дистанции круга, на которой сейчас курсор текущего круга.
  const ghost = useMemo(() => {
    if (!bounds || !referencePoints || referencePoints.length === 0 || hoverIndex == null) return null;
    const currentDist = points[hoverIndex]?.lapDist;
    if (currentDist == null) return null;
    const interp = interpolateAtDistance(referencePoints, currentDist);
    if (!interp || interp.lat == null || interp.lon == null) return null;
    const [projected] = projectWithBounds([{ lat: interp.lat, lon: interp.lon }], bounds);

    let nearestIdx = 0;
    let nearestDiff = Infinity;
    for (let i = 0; i < referencePoints.length; i++) {
      const d = referencePoints[i].lapDist;
      if (d == null) continue;
      const diff = Math.abs(d - currentDist);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIdx = i;
      }
    }
    return { x: projected.x, y: projected.y, heading: headingAt(referenceSvgPoints, nearestIdx) };
  }, [bounds, referencePoints, hoverIndex, points, referenceSvgPoints]);

  const speedSamples = useMemo(() => {
    const result: SpeedSample[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.speedKph != null && p.lapDist != null) {
        result.push({ x: svgPoints[i].x, y: svgPoints[i].y, speedKph: p.speedKph, distM: p.lapDist });
      }
    }
    return result;
  }, [points, svgPoints]);

  const coloredSegments = useMemo(() => buildColoredSegments(speedSamples, 400), [speedSamples]);
  const cornerMarkers = useMemo(() => detectCornerSpeedMarkers(speedSamples), [speedSamples]);

  // Для трасс с калибровкой по спутниковому снимку — фото с зумом/паном и
  // траекторией, привязанной к его пиксельным координатам. Для остальных —
  // прежняя схематичная SVG-проекция (без привязки к местности). forceSchematic
  // (переключатель подложки в TelemetryDetail) может принудительно вернуть к
  // схеме даже там, где спутник в принципе доступен.
  if (showSatellite) {
    return (
      <SatelliteTrackMap
        points={points}
        hoverIndex={hoverIndex}
        trackName={trackName as string}
        referencePoints={referencePoints}
        zoomPan={zoomPan}
      />
    );
  }

  const cursor = hoverIndex != null ? svgPoints[hoverIndex] : null;
  const start = svgPoints[0];
  const startLine = start ? perpendicularSegment(start.x, start.y, startHeading, 18) : null;
  const { view, containerRef, onWheel, onPointerDown, onPointerMove, onPointerUp } = zoomPan;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-muted/20"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {view && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: WIDTH,
            height: HEIGHT,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width={WIDTH}
            height={HEIGHT}
            role="img"
            aria-label={t("telemetryPage.trackMapAria")}
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
                  strokeWidth={0.9}
                  strokeLinecap="round"
                />
              ))
            ) : (
              <path
                d={path}
                fill="none"
                stroke="var(--color-primary, #ef4444)"
                strokeWidth={0.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {cornerMarkers.map((m, i) => {
              const maxPos = offsetPerpendicular(m.maxSpeed.x, m.maxSpeed.y, m.maxSpeedHeading, 14);
              const minPos = offsetPerpendicular(m.minSpeed.x, m.minSpeed.y, m.minSpeedHeading, 14);
              return (
                <g key={i}>
                  <circle cx={m.maxSpeed.x} cy={m.maxSpeed.y} r={2} fill="#16a34a" stroke="white" strokeWidth={0.6} />
                  <text
                    x={maxPos.x}
                    y={maxPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#16a34a"
                    stroke="white"
                    strokeWidth={2}
                    paintOrder="stroke"
                  >
                    {Math.round(m.maxSpeed.speedKph)}
                  </text>
                  <circle cx={m.minSpeed.x} cy={m.minSpeed.y} r={2} fill="#dc2626" stroke="white" strokeWidth={0.6} />
                  <text
                    x={minPos.x}
                    y={minPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#dc2626"
                    stroke="white"
                    strokeWidth={2}
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
                strokeWidth={3}
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
                strokeWidth={1.25}
                strokeDasharray="2.5 2.5"
                strokeLinecap="butt"
              />
            )}
            {cursor && (
              <polygon
                points={arrowPolygonPoints(cursor.x, cursor.y, cursorHeading, 9, 6)}
                fill="var(--color-chart-2, #16a34a)"
                stroke="white"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            )}
            {ghost && (
              <polygon
                points={arrowPolygonPoints(ghost.x, ghost.y, ghost.heading, 9, 6)}
                fill="none"
                stroke="currentColor"
                className="text-foreground"
                strokeWidth={1.25}
                strokeDasharray="1.5 1.2"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
});
