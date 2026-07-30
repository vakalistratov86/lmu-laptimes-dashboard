import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ChevronLeft, Map, Satellite } from "lucide-react";
import { useTelemetrySession, useTelemetryLaps, useTelemetryLapSeries } from "@/lib/api";
import { TelemetryLapPicker } from "@/components/telemetry-detail/TelemetryLapPicker";
import { TelemetryTrackMap } from "@/components/telemetry-detail/TelemetryTrackMap";
import { TelemetryChart } from "@/components/telemetry-detail/TelemetryChart";
import { hasSatelliteMap } from "@/lib/trackMapCalibration";
import { buildDeltaSeries, formatSignedDeltaMs } from "@/lib/telemetryReference";
import { StatTile } from "@/components/StatTile";
import { useLanguage } from "@/lib/i18n";

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

  // Выбираем первый круг по умолчанию, как только список кругов загрузился.
  useEffect(() => {
    if (activeLap == null && laps && laps.length > 0) {
      setActiveLap(laps[0].lapNumber);
    }
  }, [laps, activeLap]);

  useEffect(() => {
    setHoverIndex(null);
  }, [activeLap]);

  // Переключатель подложки — состояние конкретной записи; на новой записи
  // телеметрии снова стартуем со спутника (если он доступен для её трассы).
  useEffect(() => {
    setForceSchematic(false);
  }, [id]);

  const { data: series } = useTelemetryLapSeries(id, activeLap ?? undefined);
  const points = series?.points ?? [];

  // Сравнивать круг сам с собой бессмысленно (нулевая дельта, призрак совпадает
  // с курсором) — в этом случае сравнение просто не показываем.
  const effectiveReferenceLap = referenceLap != null && referenceLap !== activeLap ? referenceLap : null;
  const { data: referenceSeries } = useTelemetryLapSeries(id, effectiveReferenceLap ?? undefined);
  const referencePoints = effectiveReferenceLap != null ? (referenceSeries?.points ?? []) : undefined;

  const totalDeltaMs =
    referencePoints && referencePoints.length > 0 && points.length > 0
      ? (() => {
          const delta = buildDeltaSeries(points, referencePoints);
          return delta.length > 0 ? delta[delta.length - 1].deltaMs : null;
        })()
      : null;

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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

        {totalDeltaMs != null && (
          <StatTile
            label={t("telemetryPage.vsReferenceLabel", { n: effectiveReferenceLap! + 1 })}
            value={formatSignedDeltaMs(totalDeltaMs)}
            variant={totalDeltaMs > 0 ? "red" : totalDeltaMs < 0 ? "green" : undefined}
          />
        )}
      </div>

      {!hasLaps && (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("telemetryPage.noLapData")}
        </p>
      )}

      {hasLaps && laps && (
        <>
          <TelemetryLapPicker
            laps={laps}
            activeLap={activeLap}
            onSelect={setActiveLap}
            referenceLap={referenceLap}
            onSelectReference={(lapNumber) => setReferenceLap((current) => (current === lapNumber ? null : lapNumber))}
          />

          {!hasGpsData ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t("telemetryPage.noGpsData")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg border border-border bg-card p-3">
                {satelliteAvailable && (
                  <button
                    type="button"
                    onClick={() => setForceSchematic((v) => !v)}
                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate"
                    aria-pressed={!forceSchematic}
                    title={forceSchematic ? t("telemetryPage.switchToSatellite") : t("telemetryPage.switchToSchematic")}
                    aria-label={
                      forceSchematic ? t("telemetryPage.switchToSatellite") : t("telemetryPage.switchToSchematic")
                    }
                  >
                    {forceSchematic ? <Satellite size={14} /> : <Map size={14} />}
                  </button>
                )}
                <TelemetryTrackMap
                  points={points}
                  hoverIndex={hoverIndex}
                  trackName={session.trackName}
                  referencePoints={referencePoints}
                  forceSchematic={forceSchematic}
                />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <TelemetryChart points={points} onHoverIndexChange={setHoverIndex} referencePoints={referencePoints} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
