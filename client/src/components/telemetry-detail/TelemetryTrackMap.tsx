import { useMemo } from "react";
import { projectTrackPoints, pointsToPath, headingAt, arrowPolygonPoints, perpendicularSegment } from "@/lib/telemetryGeo";
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
      <path
        d={path}
        fill="none"
        stroke="var(--color-border, #64748b)"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.25}
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary, #ef4444)"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
