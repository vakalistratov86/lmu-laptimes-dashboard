import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { ChevronLeft, ZoomIn, ZoomOut, Maximize2, Map as MapIcon, Satellite, Play, Pause, Gauge } from "lucide-react";
import { useTelemetrySession, useTelemetryLaps, useTelemetryLapSeries } from "@/lib/api";
import { TelemetryLapPicker } from "@/components/telemetry-detail/TelemetryLapPicker";
import { TelemetryTrackMap, type TrackMapHandle } from "@/components/telemetry-detail/TelemetryTrackMap";
import { TelemetryChart } from "@/components/telemetry-detail/TelemetryChart";
import { ReferencePicker } from "@/components/telemetry-detail/ReferencePicker";
import { hasSatelliteMap } from "@/lib/trackMapCalibration";
import { buildDeltaSeries, formatSignedDeltaMs } from "@/lib/telemetryReference";
import { formatLap } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

type ViewMode = "map" | "combined" | "chart";
type ChannelKey = "speed" | "tyres" | "brakes" | "gg" | "fuel";

const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
const PLAYBACK_TICK_MS = 50;

// Каналы без реализованного запроса к telemetry_samples — кнопка в правой
// панели видна (см. §3.7.1 в docs/REQUIREMENTS.md), но выбор показывает
// объясняющее пустое состояние вместо графика, а не выдуманные данные.
const CHANNELS: { key: ChannelKey; labelKey: string; hasData: boolean }[] = [
  { key: "speed", labelKey: "telemetryPage.channelSpeed", hasData: true },
  { key: "tyres", labelKey: "telemetryPage.channelTyres", hasData: false },
  { key: "brakes", labelKey: "telemetryPage.channelBrakes", hasData: false },
  { key: "gg", labelKey: "telemetryPage.channelGG", hasData: false },
  { key: "fuel", labelKey: "telemetryPage.channelFuel", hasData: false },
];

export default function TelemetryDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute("/telemetry/:id");
  const id = params ? Number(params.id) : undefined;

  const { data: detail, isLoading } = useTelemetrySession(id);
  const { data: laps } = useTelemetryLaps(id);

  const [activeLap, setActiveLap] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [referenceLap, setReferenceLap] = useState<number | null>(null);
  const [forceSchematic, setForceSchematic] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("combined");
  const [activeChannel, setActiveChannel] = useState<ChannelKey>("speed");
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const mapRef = useRef<TrackMapHandle>(null);

  // Выбираем первый круг по умолчанию, как только список кругов загрузился.
  useEffect(() => {
    if (activeLap == null && laps && laps.length > 0) {
      setActiveLap(laps[0].lapNumber);
    }
  }, [laps, activeLap]);

  useEffect(() => {
    setHoverIndex(null);
    setPlaying(false);
  }, [activeLap]);

  // Переключатель подложки — состояние конкретной записи; на новой записи
  // телеметрии снова стартуем со спутника (если он доступен для её трассы).
  useEffect(() => {
    setForceSchematic(false);
  }, [id]);

  const { data: series } = useTelemetryLapSeries(id, activeLap ?? undefined);
  const points = useMemo(() => series?.points ?? [], [series]);

  // Сравнивать круг сам с собой бессмысленно (нулевая дельта, призрак совпадает
  // с курсором) — в этом случае сравнение просто не показываем.
  const effectiveReferenceLap = referenceLap != null && referenceLap !== activeLap ? referenceLap : null;
  const { data: referenceSeries } = useTelemetryLapSeries(id, effectiveReferenceLap ?? undefined);
  const referencePoints = useMemo(
    () => (effectiveReferenceLap != null ? (referenceSeries?.points ?? []) : undefined),
    [effectiveReferenceLap, referenceSeries],
  );

  const deltaSeries = useMemo(
    () => (referencePoints && referencePoints.length > 0 ? buildDeltaSeries(points, referencePoints) : []),
    [points, referencePoints],
  );

  // "Проигрывание" круга — курсор идёт по нему сам, скорость шага подобрана
  // так, чтобы 1x была близка к реальному времени круга независимо от частоты
  // сэмплов записи (иначе на 100Гц записи шаг "по одному сэмплу за тик" был бы
  // в разы медленнее настоящего круга). Любое ручное наведение мышью на график
  // останавливает автопроигрывание — см. `handleHoverIndexChange`.
  useEffect(() => {
    if (!playing || points.length < 2) return;
    const totalDurationSec = points[points.length - 1].t - points[0].t;
    const avgSampleIntervalMs = (totalDurationSec * 1000) / (points.length - 1) || 1;
    const indicesPerTick = Math.max(1, Math.round((PLAYBACK_TICK_MS / avgSampleIntervalMs) * playbackSpeed));
    const id = window.setInterval(() => {
      setHoverIndex((idx) => {
        const next = (idx ?? -1) + indicesPerTick;
        if (next >= points.length) {
          setPlaying(false);
          return points.length - 1;
        }
        return next;
      });
    }, PLAYBACK_TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, playbackSpeed, points]);

  function handleHoverIndexChange(index: number | null) {
    if (playing) setPlaying(false);
    setHoverIndex(index);
  }

  if (isLoading) {
    return <p className="py-14 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-14 text-center">
        <p className="font-semibold text-muted-foreground">{t("telemetryPage.notFound")}</p>
        <Link href="/telemetry" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("telemetryPage.backToList")}
        </Link>
      </div>
    );
  }

  const { session } = detail;
  const hasLaps = (laps?.length ?? 0) > 0;
  const hasGpsData = points.length > 0;
  const satelliteAvailable = hasSatelliteMap(session.trackName);
  const showMap = hasGpsData && viewMode !== "chart";
  const showDock = hasGpsData && viewMode !== "map";

  const hoverPoint = hoverIndex != null ? points[hoverIndex] : null;
  const lapT0 = points[0]?.t ?? 0;
  const activeLapInfo = laps?.find((l) => l.lapNumber === activeLap);
  const readoutLapMs = hoverPoint ? (hoverPoint.t - lapT0) * 1000 : (activeLapInfo?.durationSec ?? 0) * 1000;

  const nearestDelta =
    deltaSeries.length > 0
      ? hoverPoint?.lapDist != null
        ? deltaSeries.reduce((best, d) =>
            Math.abs(d.distM - hoverPoint.lapDist!) < Math.abs(best.distM - hoverPoint.lapDist!) ? d : best,
          )
        : deltaSeries[deltaSeries.length - 1]
      : null;

  return (
    <div className="space-y-4">
      {!hasLaps && (
        <>
          <PageHeaderStatic session={session} />
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("telemetryPage.noLapData")}
          </p>
        </>
      )}

      {hasLaps && laps && !hasGpsData && (
        <>
          <PageHeaderStatic session={session} />
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t("telemetryPage.noGpsData")}
          </p>
        </>
      )}

      {hasLaps && laps && hasGpsData && (
        <div className="relative h-[600px] overflow-hidden rounded-lg border border-border bg-background md:h-[820px]">
          {/* ---------- header overlay ---------- */}
          <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 bg-gradient-to-b from-background/95 via-background/80 to-transparent p-3">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                href="/telemetry"
                className="mt-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft size={13} /> {t("telemetryPage.backToList")}
              </Link>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold tracking-tight" data-testid="text-page-title">
                  {session.trackName ?? "—"}
                  {session.trackLayout && session.trackLayout !== session.trackName ? ` · ${session.trackLayout}` : ""}
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  {[session.carName, session.driverName, session.sessionType].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 rounded-lg border border-border bg-muted/70 p-0.5 backdrop-blur">
              {(["map", "combined", "chart"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold",
                    viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`telemetryPage.viewMode${mode === "map" ? "Map" : mode === "combined" ? "Combined" : "Chart"}`)}
                </button>
              ))}
            </div>
          </div>

          {/* ---------- map stage ---------- */}
          {showMap && (
            <div className="absolute inset-0">
              <TelemetryTrackMap
                ref={mapRef}
                points={points}
                hoverIndex={hoverIndex}
                trackName={session.trackName}
                referencePoints={referencePoints}
                forceSchematic={forceSchematic}
              />
            </div>
          )}

          {/* ---------- left toolbar ---------- */}
          {showMap && (
            <div className="absolute left-3 top-16 z-20 flex flex-col gap-0.5 rounded-lg border border-border bg-card/90 p-1 backdrop-blur">
              <ToolbarButton label={t("telemetryPage.zoomIn")} onClick={() => mapRef.current?.zoomIn()}>
                <ZoomIn size={15} />
              </ToolbarButton>
              <ToolbarButton label={t("telemetryPage.zoomOut")} onClick={() => mapRef.current?.zoomOut()}>
                <ZoomOut size={15} />
              </ToolbarButton>
              <ToolbarButton label={t("telemetryPage.resetView")} onClick={() => mapRef.current?.reset()}>
                <Maximize2 size={15} />
              </ToolbarButton>
              <div className="my-0.5 h-px bg-border" />
              <ToolbarButton
                label={
                  !satelliteAvailable
                    ? t("telemetryPage.switchToSchematicTooltip")
                    : forceSchematic
                      ? t("telemetryPage.switchToSatellite")
                      : t("telemetryPage.switchToSchematic")
                }
                active={satelliteAvailable && !forceSchematic}
                disabled={!satelliteAvailable}
                onClick={() => setForceSchematic((v) => !v)}
              >
                {forceSchematic ? <Satellite size={15} /> : <MapIcon size={15} />}
              </ToolbarButton>
              <div className="my-0.5 h-px bg-border" />
              <ToolbarButton
                label={playing ? t("telemetryPage.pauseLap") : t("telemetryPage.playLap")}
                active={playing}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </ToolbarButton>
              <ToolbarButton
                label={`${playbackSpeed}×`}
                onClick={() =>
                  setPlaybackSpeed((s) => PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(s) + 1) % PLAYBACK_SPEEDS.length])
                }
              >
                <span className="font-data text-[10px] font-bold">{playbackSpeed}×</span>
              </ToolbarButton>
            </div>
          )}

          {/* ---------- right channel rail ---------- */}
          {showMap && (
            <div
              role="tablist"
              aria-label={t("telemetryPage.referencePickerAria")}
              className="absolute right-3 top-16 z-20 flex flex-col gap-0.5 rounded-lg border border-border bg-card/90 p-1 backdrop-blur"
            >
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  role="tab"
                  aria-selected={activeChannel === ch.key}
                  onClick={() => setActiveChannel(ch.key)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide",
                    activeChannel === ch.key
                      ? "bg-primary text-primary-foreground"
                      : ch.hasData
                        ? "text-muted-foreground hover-elevate"
                        : "text-muted-foreground/50 hover-elevate",
                  )}
                >
                  <Gauge size={11} className={ch.hasData ? "" : "opacity-40"} />
                  {t(ch.labelKey)}
                </button>
              ))}
            </div>
          )}

          {/* ---------- reference picker ---------- */}
          {showMap && (
            <ReferencePicker
              laps={laps}
              referenceLap={referenceLap}
              onSelectReference={setReferenceLap}
              className="absolute bottom-3 left-3 z-20"
            />
          )}

          {/* ---------- bottom dock ---------- */}
          {showDock && (
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 p-3",
                viewMode === "combined"
                  ? "bg-gradient-to-t from-background via-background/95 to-transparent pt-10"
                  : "top-14 bg-background",
              )}
            >
              {/* строка живого отсчёта */}
              <div className="flex flex-wrap gap-2">
                <ReadoutTile label={t("telemetryPage.readoutLap")} value={formatLap(readoutLapMs)} />
                <ReadoutTile
                  label={t("telemetryPage.readoutSpeed")}
                  value={hoverPoint?.speedKph != null ? `${Math.round(hoverPoint.speedKph)} км/ч` : "—"}
                />
                <ReadoutTile label={t("telemetryPage.readoutPedals")}>
                  <PedalMiniBars throttle={hoverPoint?.throttle ?? null} brake={hoverPoint?.brake ?? null} />
                </ReadoutTile>
                {effectiveReferenceLap != null && (
                  <ReadoutTile
                    label={t("telemetryPage.vsReferenceLabel", { n: effectiveReferenceLap + 1 })}
                    value={nearestDelta ? formatSignedDeltaMs(nearestDelta.deltaMs) : "—"}
                    valueClassName={
                      nearestDelta && nearestDelta.deltaMs > 0
                        ? "text-red-500"
                        : nearestDelta && nearestDelta.deltaMs < 0
                          ? "text-green-500"
                          : undefined
                    }
                  />
                )}
                <ReadoutTile
                  label={t("telemetryPage.sectorsLabel")}
                  className="flex-1"
                  title={t("telemetryPage.sectorsNoDataNote")}
                >
                  <div className="flex gap-3">
                    {["S1", "S2", "S3"].map((s) => (
                      <div key={s} className="text-center">
                        <div className="text-[8px] uppercase text-muted-foreground">{s}</div>
                        <div className="font-data text-xs font-semibold tabular-nums">—</div>
                      </div>
                    ))}
                  </div>
                </ReadoutTile>
              </div>

              {/* панель канала: реальный график или объясняющая заглушка */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card/95 backdrop-blur">
                {activeChannel === "speed" ? (
                  <TelemetryChart
                    points={points}
                    onHoverIndexChange={handleHoverIndexChange}
                    activeLapNumber={activeLap != null ? activeLap + 1 : null}
                    referencePoints={referencePoints}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {t("telemetryPage.channelNoDataTitle")}
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground/80">{t("telemetryPage.channelNoDataBody")}</p>
                  </div>
                )}
              </div>

              <TelemetryLapPicker
                laps={laps}
                activeLap={activeLap}
                onSelect={setActiveLap}
                referenceLap={referenceLap}
                onSelectReference={(lapNumber) =>
                  setReferenceLap((current) => (current === lapNumber ? null : lapNumber))
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageHeaderStatic({
  session,
}: {
  session: {
    trackName: string | null;
    trackLayout: string | null;
    carName: string | null;
    driverName: string | null;
    sessionType: string | null;
  };
}) {
  const { t } = useLanguage();
  return (
    <div>
      <Link
        href="/telemetry"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={14} /> {t("telemetryPage.backToList")}
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
        {session.trackName ?? "—"}
        {session.trackLayout && session.trackLayout !== session.trackName ? ` · ${session.trackLayout}` : ""}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {[session.carName, session.driverName, session.sessionType].filter(Boolean).join(" · ") || "—"}
      </p>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover-elevate disabled:opacity-30 disabled:hover-elevate-none",
          active && "bg-primary text-primary-foreground",
        )}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute left-[calc(100%+6px)] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}

function ReadoutTile({
  label,
  value,
  valueClassName,
  className,
  title,
  children,
}: {
  label: string;
  value?: string;
  valueClassName?: string;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn("rounded-lg border border-border bg-card/95 px-3 py-1.5 backdrop-blur", className)}
    >
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {value != null ? (
        <div className={cn("font-data text-sm font-bold tabular-nums", valueClassName)}>{value}</div>
      ) : (
        children
      )}
    </div>
  );
}

function PedalMiniBars({ throttle, brake }: { throttle: number | null; brake: number | null }) {
  return (
    <div className="flex w-24 flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        THR
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-green-500"
            style={{ width: `${Math.max(0, Math.min(100, throttle ?? 0))}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        BRK
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-red-500"
            style={{ width: `${Math.max(0, Math.min(100, brake ?? 0))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
