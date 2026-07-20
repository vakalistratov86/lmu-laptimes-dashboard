import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useTelemetrySession, useTelemetryLaps, useTelemetryLapSeries } from "@/lib/api";
import { TelemetryLapPicker } from "@/components/telemetry-detail/TelemetryLapPicker";
import { TelemetryTrackMap } from "@/components/telemetry-detail/TelemetryTrackMap";
import { TelemetryChart } from "@/components/telemetry-detail/TelemetryChart";
import { useLanguage } from "@/lib/i18n";

export default function TelemetryDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute("/telemetry/:id");
  const id = params ? Number(params.id) : undefined;

  const { data: detail, isLoading } = useTelemetrySession(id);
  const { data: laps } = useTelemetryLaps(id);

  const [activeLap, setActiveLap] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Выбираем первый круг по умолчанию, как только список кругов загрузился.
  useEffect(() => {
    if (activeLap == null && laps && laps.length > 0) {
      setActiveLap(laps[0].lapNumber);
    }
  }, [laps, activeLap]);

  useEffect(() => {
    setHoverIndex(null);
  }, [activeLap]);

  const { data: series } = useTelemetryLapSeries(id, activeLap ?? undefined);
  const points = series?.points ?? [];

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

  return (
    <div className="space-y-4">
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

      {!hasLaps && (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("telemetryPage.noLapData")}
        </p>
      )}

      {hasLaps && laps && (
        <>
          <TelemetryLapPicker laps={laps} activeLap={activeLap} onSelect={setActiveLap} />

          {!hasGpsData ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t("telemetryPage.noGpsData")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-3">
                <TelemetryTrackMap points={points} hoverIndex={hoverIndex} />
              </div>
              <div className="rounded-lg border border-border bg-card">
                <TelemetryChart points={points} onHoverIndexChange={setHoverIndex} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
