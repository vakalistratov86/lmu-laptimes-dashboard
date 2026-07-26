import { useMemo } from "react";
import { projectTrackPoints, pointsToPath } from "@/lib/telemetryGeo";
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

  // Для трасс с калибровкой по спутниковому снимку — фото с зумом/паном и
  // траекторией, привязанной к его пиксельным координатам. Для остальных —
  // прежняя схематичная SVG-проекция (без привязки к местности).
  if (hasSatelliteMap(trackName)) {
    return <SatelliteTrackMap points={points} hoverIndex={hoverIndex} trackName={trackName as string} />;
  }

  const cursor = hoverIndex != null ? svgPoints[hoverIndex] : null;
  const start = svgPoints[0];

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
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.25}
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary, #ef4444)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {start && (
        <circle cx={start.x} cy={start.y} r={5} fill="var(--color-chart-2, #16a34a)" stroke="white" strokeWidth={1.5} />
      )}
      {cursor && (
        <circle cx={cursor.x} cy={cursor.y} r={7} fill="var(--color-primary, #ef4444)" stroke="white" strokeWidth={2} />
      )}
    </svg>
  );
}
