import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { geoToImagePixel, getSatelliteMapCalibration } from "@/lib/trackMapCalibration";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface SatelliteTrackMapProps {
  points: TelemetryLapPoint[];
  hoverIndex: number | null;
  trackName: string;
}

interface View {
  scale: number;
  tx: number;
  ty: number;
}

const ZOOM_STEP = 1.4;
const MAX_ZOOM_MULT = 8;

export function SatelliteTrackMap({ points, hoverIndex, trackName }: SatelliteTrackMapProps) {
  const { t } = useLanguage();
  const calibration = getSatelliteMapCalibration(trackName);

  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const naturalWidth = calibration?.naturalWidth ?? 0;
  const naturalHeight = calibration?.naturalHeight ?? 0;

  const fitView = useCallback((): View | null => {
    const el = containerRef.current;
    if (!el || naturalWidth === 0) return null;
    const { clientWidth: cw, clientHeight: ch } = el;
    const fitScale = Math.min(cw / naturalWidth, ch / naturalHeight);
    return {
      scale: fitScale,
      tx: (cw - naturalWidth * fitScale) / 2,
      ty: (ch - naturalHeight * fitScale) / 2,
    };
  }, [naturalWidth, naturalHeight]);

  // Инициализация масштаба «по размеру контейнера» при первом измерении и ресайзе окна.
  useLayoutEffect(() => {
    setView(fitView());
    const onResize = () => setView((v) => (v ? clampView(v, containerRef.current, naturalWidth, naturalHeight) : fitView()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackName]);

  function clampView(v: View, el: HTMLDivElement | null, natW: number, natH: number): View {
    if (!el) return v;
    const { clientWidth: cw, clientHeight: ch } = el;
    const contentW = natW * v.scale;
    const contentH = natH * v.scale;
    const tx = contentW <= cw ? (cw - contentW) / 2 : Math.min(0, Math.max(cw - contentW, v.tx));
    const ty = contentH <= ch ? (ch - contentH) / 2 : Math.min(0, Math.max(ch - contentH, v.ty));
    return { scale: v.scale, tx, ty };
  }

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const el = containerRef.current;
      const fit = fitView();
      if (!el || !fit) return;
      setView((prev) => {
        const cur = prev ?? fit;
        const minScale = fit.scale;
        const maxScale = fit.scale * MAX_ZOOM_MULT;
        const newScale = Math.min(maxScale, Math.max(minScale, cur.scale * factor));
        const contentX = (cx - cur.tx) / cur.scale;
        const contentY = (cy - cur.ty) / cur.scale;
        const next: View = {
          scale: newScale,
          tx: cx - contentX * newScale,
          ty: cy - contentY * newScale,
        };
        return clampView(next, el, naturalWidth, naturalHeight);
      });
    },
    [fitView, naturalWidth, naturalHeight],
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!view) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = containerRef.current;
    if (!drag || !el) return;
    setView((prev) => {
      if (!prev) return prev;
      const next: View = {
        scale: prev.scale,
        tx: drag.tx + (e.clientX - drag.x),
        ty: drag.ty + (e.clientY - drag.y),
      };
      return clampView(next, el, naturalWidth, naturalHeight);
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handleZoomButton = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  const handleReset = () => setView(fitView());

  const svgPoints = useMemo(() => {
    return points.map((p) => (p.lat != null && p.lon != null ? geoToImagePixel(trackName, { lat: p.lat, lon: p.lon }) : null));
  }, [points, trackName]);

  const path = useMemo(() => {
    const valid = svgPoints.filter((p): p is { x: number; y: number } => p != null);
    if (valid.length === 0) return "";
    return valid.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }, [svgPoints]);

  const start = svgPoints.find((p) => p != null) ?? null;
  const cursor = hoverIndex != null ? (svgPoints[hoverIndex] ?? null) : null;

  if (!calibration) return null;

  return (
    <div
      ref={containerRef}
      className="relative h-[420px] w-full touch-none overflow-hidden rounded-md bg-muted/40"
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
            <path
              d={path}
              fill="none"
              stroke="var(--color-border, #64748b)"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
            />
            <path d={path} fill="none" stroke="var(--color-primary, #ef4444)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
            {start && (
              <circle cx={start.x} cy={start.y} r={20} fill="var(--color-chart-2, #16a34a)" stroke="white" strokeWidth={4} />
            )}
            {cursor && (
              <circle cx={cursor.x} cy={cursor.y} r={26} fill="var(--color-primary, #ef4444)" stroke="white" strokeWidth={5} />
            )}
          </svg>
        </div>
      )}

      <div className="absolute right-1 top-1 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => handleZoomButton(ZOOM_STEP)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate"
          aria-label={t("telemetryPage.zoomIn")}
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => handleZoomButton(1 / ZOOM_STEP)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate"
          aria-label={t("telemetryPage.zoomOut")}
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate"
          aria-label={t("telemetryPage.resetView")}
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
