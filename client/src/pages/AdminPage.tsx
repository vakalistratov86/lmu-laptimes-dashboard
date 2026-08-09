import { Link } from "wouter";
import { ShieldAlert, Users, Database, ChevronRight, Trash2, Loader2, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatTile } from "@/components/StatTile";
import { useAuth } from "@/lib/auth";
import { useAdminUsers, useAdminStats } from "@/lib/api";
import { useLogImportEngine } from "@/lib/logImportEngine";
import { useTelemetryImportEngine } from "@/lib/telemetryImportEngine";
import { useLanguage } from "@/lib/i18n";
import type { AdminUserSummary } from "@shared/schema";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

function formatDate(iso: string, intlLocale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function UserSessionsList({ user, intlLocale }: { user: AdminUserSummary; intlLocale: string }) {
  const { t } = useLanguage();
  if (user.sessions.length === 0) return null;
  return (
    <details className="mt-1">
      <summary
        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
        data-testid={`toggle-user-sessions-${user.id}`}
      >
        {t("admin.showSessions")}
      </summary>
      <ul className="mt-1.5 space-y-1 border-l border-border pl-3">
        {user.sessions.map((s) => (
          <li key={s.id} className="text-xs">
            <Link href={`/sessions/${s.id}`} className="text-muted-foreground hover:text-foreground hover:underline">
              {s.sessionType} · {s.venue} · {formatDate(s.dateTime, intlLocale)} · {s.lapCount} {t("common.laps")}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function UsersSection() {
  const { t, intlLocale } = useLanguage();
  const { data: users, isLoading, isError } = useAdminUsers();

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Users size={16} className="text-muted-foreground" />
        <h2 className="text-base font-semibold">{t("admin.usersTitle")}</h2>
      </div>

      {isLoading && (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {isError && <p className="p-4 text-sm text-muted-foreground">{t("admin.loadError")}</p>}

      {!isLoading && !isError && (users?.length ?? 0) === 0 && (
        <p className="p-4 text-sm text-muted-foreground">{t("admin.usersEmpty")}</p>
      )}

      {!isLoading && !isError && (users?.length ?? 0) > 0 && (
        <table className="w-full text-sm" data-testid="table-admin-users">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t("admin.colUser")}</th>
              <th className="px-4 py-2 font-medium">{t("admin.colRegistered")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("admin.colSessions")}</th>
              <th className="px-4 py-2 text-right font-medium">{t("admin.colLaps")}</th>
            </tr>
          </thead>
          <tbody>
            {users!.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0" data-testid={`row-admin-user-${u.id}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{u.displayName}</span>
                    {!!u.isAdmin && (
                      <Badge variant="outline" className="gap-1 text-[10px]" data-testid={`badge-admin-${u.id}`}>
                        <ShieldAlert size={10} />
                        {t("admin.badgeAdmin")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                  <UserSessionsList user={u} intlLocale={intlLocale} />
                </td>
                <td className="px-4 py-2.5 font-data text-xs tabular-nums text-muted-foreground">
                  {formatDate(new Date(u.createdAt).toISOString(), intlLocale)}
                </td>
                <td className="px-4 py-2.5 text-right font-data tabular-nums">{u.sessionCount}</td>
                <td className="px-4 py-2.5 text-right font-data tabular-nums text-muted-foreground">{u.totalLaps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DbStatsSection() {
  const { t } = useLanguage();
  const { data: stats, isLoading, isError } = useAdminStats();
  const { clearDatabase, clearingDb, mode: logMode } = useLogImportEngine();
  const { clearTelemetry, clearing: clearingTelemetry, mode: telemetryMode } = useTelemetryImportEngine();

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("admin.dbStatsTitle")}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="button-clear-telemetry"
                onClick={clearTelemetry}
                disabled={clearingTelemetry || telemetryMode !== "idle"}
                aria-label={t("telemetry.cleanupCta")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40"
              >
                {clearingTelemetry ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("telemetry.cleanupCta")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="button-clear-db"
                onClick={clearDatabase}
                disabled={clearingDb || logMode !== "idle"}
                aria-label={t("imp.cleanupCta")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40"
              >
                {clearingDb ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("imp.cleanupCta")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )}

      {isError && <p className="p-4 text-sm text-muted-foreground">{t("admin.loadError")}</p>}

      {!isLoading && !isError && stats && (
        <>
          <div className="border-b border-border p-4">
            <StatTile label={t("admin.totalSize")} value={formatBytes(stats.databaseSizeBytes)} />
          </div>
          <table className="w-full text-sm" data-testid="table-admin-db-stats">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t("admin.colTable")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("admin.colRowsEstimate")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("admin.colSize")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.tables.map((tbl) => (
                <tr key={tbl.table} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{tbl.table}</td>
                  <td className="px-4 py-2 text-right font-data text-xs tabular-nums text-muted-foreground">
                    {tbl.rowCountEstimate.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-data text-xs tabular-nums">{formatBytes(tbl.sizeBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-card-border bg-card p-10 text-center">
        <ShieldAlert size={28} className="text-muted-foreground" />
        <h1 className="font-display text-lg font-bold tracking-tight">{t("admin.accessDeniedTitle")}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t("admin.accessDeniedBody")}</p>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t("admin.backToOverview")}
          <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          {t("admin.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      <UsersSection />
      <DbStatsSection />
    </div>
  );
}
