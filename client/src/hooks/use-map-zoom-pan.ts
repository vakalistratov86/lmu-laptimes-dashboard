import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Общая логика зума/пана для карты телеметрии (колесо мыши, кнопки, драг) —
 * раньше жила только внутри `SatelliteTrackMap`; вынесена сюда, чтобы тот же
 * жест (и тот же левый тулбар в `TelemetryDetail`) работал одинаково и для
 * спутниковой, и для схематичной SVG-карты, вместо двух независимых
 * реализаций и двух наборов кнопок зума в разных углах экрана.
 */
export interface MapZoomPanView {
  scale: number;
  tx: number;
  ty: number;
}

export interface UseMapZoomPanOptions {
  naturalWidth: number;
  naturalHeight: number;
  /** Множитель максимального зума относительно масштаба "по размеру контейнера". */
  maxZoomMult?: number;
  /** Смена значения пересчитывает fit-view заново (например, смена трассы). */
  resetKey?: unknown;
}

export interface MapZoomPanControls {
  view: MapZoomPanView | null;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  onWheel: (e: React.WheelEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

const ZOOM_STEP = 1.4;

export function useMapZoomPan({
  naturalWidth,
  naturalHeight,
  maxZoomMult = 24,
  resetKey,
}: UseMapZoomPanOptions): MapZoomPanControls {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<MapZoomPanView | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const fitView = useCallback((): MapZoomPanView | null => {
    const el = containerRef.current;
    if (!el || naturalWidth === 0 || naturalHeight === 0) return null;
    const { clientWidth: cw, clientHeight: ch } = el;
    const fitScale = Math.min(cw / naturalWidth, ch / naturalHeight);
    return {
      scale: fitScale,
      tx: (cw - naturalWidth * fitScale) / 2,
      ty: (ch - naturalHeight * fitScale) / 2,
    };
  }, [naturalWidth, naturalHeight]);

  function clampView(v: MapZoomPanView, el: HTMLDivElement | null): MapZoomPanView {
    if (!el) return v;
    const { clientWidth: cw, clientHeight: ch } = el;
    const contentW = naturalWidth * v.scale;
    const contentH = naturalHeight * v.scale;
    const tx = contentW <= cw ? (cw - contentW) / 2 : Math.min(0, Math.max(cw - contentW, v.tx));
    const ty = contentH <= ch ? (ch - contentH) / 2 : Math.min(0, Math.max(ch - contentH, v.ty));
    return { scale: v.scale, tx, ty };
  }

  // Инициализация масштаба «по размеру контейнера» при первом измерении, смене
  // resetKey (например, трассы) и ресайзе окна.
  useLayoutEffect(() => {
    setView(fitView());
    const onResize = () => setView((v) => (v ? clampView(v, containerRef.current) : fitView()));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const el = containerRef.current;
      const fit = fitView();
      if (!el || !fit) return;
      setView((prev) => {
        const cur = prev ?? fit;
        const minScale = fit.scale;
        const maxScale = fit.scale * maxZoomMult;
        const newScale = Math.min(maxScale, Math.max(minScale, cur.scale * factor));
        const contentX = (cx - cur.tx) / cur.scale;
        const contentY = (cy - cur.ty) / cur.scale;
        const next: MapZoomPanView = {
          scale: newScale,
          tx: cx - contentX * newScale,
          ty: cy - contentY * newScale,
        };
        return clampView(next, el);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fitView, maxZoomMult],
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
      const next: MapZoomPanView = {
        scale: prev.scale,
        tx: drag.tx + (e.clientX - drag.x),
        ty: drag.ty + (e.clientY - drag.y),
      };
      return clampView(next, el);
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const zoomIn = () => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(ZOOM_STEP, el.clientWidth / 2, el.clientHeight / 2);
  };

  const zoomOut = () => {
    const el = containerRef.current;
    if (!el) return;
    zoomAt(1 / ZOOM_STEP, el.clientWidth / 2, el.clientHeight / 2);
  };

  const reset = () => setView(fitView());

  return { view, containerRef, zoomIn, zoomOut, reset, onWheel, onPointerDown, onPointerMove, onPointerUp };
}
