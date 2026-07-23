import { useMemo } from "react";
import { Link } from "wouter";
import { useTelemetrySessions } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, ChevronRight, Activity } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { TelemetrySession } from "@shared/schema";

/** "2026-07-20T17_08_12Z" (формат имени файла LMU) → читаемая дата/время. */
function formatRecordingTime(raw: string | null, intlLocale: string): string {
  if (!raw) return "—";
  const iso = raw.replace(/_/g, ":");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(intlLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TelemetryTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <div className="flex gap-6">
          {["w-28", "w-24", "w-24", "w-16", "w-32"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-border/50 px-4 py-3 last:border-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function Telemetry() {
  const { t, intlLocale } = useLanguage();
  const { data: telemetrySessions, isLoading } = useTelemetrySessions();

  const sorted = useMemo(() => {
    return [...(telemetrySessions ?? [])].sort((a, b) =>
      (b.recordingTime ?? "").localeCompare(a.recordingTime ?? "")
    );
  }, [telemetrySessions]);

  const hasSessions = sorted.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          {t("telemetryPage.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("telemetryPage.subtitle")}</p>
      </div>

      {isLoading && <TelemetryTableSkeleton />}

      {!isLoading && !hasSessions && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity size={22} />
          </div>
          <div>
            <p className="font-semibold">{t("telemetryPage.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
              {t("telemetryPage.emptyBody")}
            </p>
          </div>
          <Link
            href="/import"
            data-testid="link-import-empty"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload size={16} /> {t("telemetryPage.emptyCta")}
          </Link>
        </div>
      )}

      {!isLoading && hasSessions && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card" role="table">
          <div
            className="grid min-w-[760px] border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: "minmax(180px,1fr) 200px 160px 120px 170px 24px" }}
            role="row"
          >
            <div role="columnheader">{t("telemetryPage.colTrack")}</div>
            <div role="columnheader">{t("telemetryPage.colCar")}</div>
            <div role="columnheader">{t("telemetryPage.colDriver")}</div>
            <div role="columnheader">{t("telemetryPage.colType")}</div>
            <div role="columnheader" className="text-right">{t("telemetryPage.colRecorded")}</div>
            <div role="columnheader" />
          </div>

          {sorted.map((s: TelemetrySession) => (
            <Link
              key={s.id}
              href={`/telemetry/${s.id}`}
              data-testid={`row-telemetry-${s.id}`}
              className="grid min-w-[760px] cursor-pointer items-center border-b border-border/50 px-4 py-3 last:border-0 hover:bg-muted/40 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              style={{ gridTemplateColumns: "minmax(180px,1fr) 200px 160px 120px 170px 24px" }}
              role="row"
            >
              <div className="truncate font-medium" role="cell">
                {s.trackName ?? "—"}
                {s.trackLayout && s.trackLayout !== s.trackName ? ` · ${s.trackLayout}` : ""}
              </div>
              <div className="truncate text-sm text-muted-foreground" role="cell">{s.carName ?? "—"}</div>
              <div className="truncate text-sm text-muted-foreground" role="cell">{s.driverName ?? "—"}</div>
              <div className="truncate text-sm text-muted-foreground" role="cell">{s.sessionType ?? "—"}</div>
              <div className="text-right text-sm text-muted-foreground" role="cell">
                {formatRecordingTime(s.recordingTime, intlLocale)}
              </div>
              <div className="flex justify-end text-muted-foreground/50" role="cell" aria-hidden="true">
                <ChevronRight size={15} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
