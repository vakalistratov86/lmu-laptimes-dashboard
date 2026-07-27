import { useMemo } from "react";
import {
  projectTrackPoints,
  pointsToPath,
  headingAt,
  arrowPolygonPoints,
  perpendicularSegment,
  offsetPerpendicular,
} from "@/lib/telemetryGeo";
import { buildColoredSegments, detectCornerSpeedMarkers, type SpeedSample } from "@/lib/telemetrySpeed";
import { hasSatelliteMap } from "@/lib/trackMapCalibration";
import { SatelliteTrackMap } from "@/components/telemetry-detail/SatelliteTrackMap";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface TelemetryTrackMapProps {
  points: TelemetryLapPoint[];
  hoverIndex: number | null;
  trackName: string | null;
}

const WIDTH = 420;
const HEIGHT = 320;

export function TelemetryTrackMap({ points, hoverIndex, trackName }: TelemetryTrackMapProps) {
  const { t } = useLanguage();

  // Хуки должны вызываться безусловно на каждом рендере — поэтому проекция
  // для SVG-фолбэка считается всегда, а выбор ветки рендера (фото или SVG)
  // делается только в JSX ниже.
  const svgPoints = useMemo(() => {
    const geoPoints = points.map((p) => ({ lat: p.lat ?? 0, lon: p.lon ?? 0 }));
    return projectTrackPoints(geoPoints, WIDTH, HEIGHT);
  }, [points]);

  const path = useMemo(() => pointsToPath(svgPoints), [svgPoints]);
  const startHeading = useMemo(() => headingAt(svgPoints, 0), [svgPoints]);
  const cursorHeading = useMemo(
    () => (hoverIndex != null ? headingAt(svgPoints, hoverIndex) : 0),
    [svgPoints, hoverIndex],
  );

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
  // прежняя схематичная SVG-проекция (без привязки к местности).
  if (hasSatelliteMap(trackName)) {
    return <SatelliteTrackMap points={points} hoverIndex={hoverIndex} trackName={trackName as string} />;
  }

  const cursor = hoverIndex != null ? svgPoints[hoverIndex] : null;
  const start = svgPoints[0];
  const startLine = start ? perpendicularSegment(start.x, start.y, startHeading, 18) : null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full"
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
    </svg>
  );
}
