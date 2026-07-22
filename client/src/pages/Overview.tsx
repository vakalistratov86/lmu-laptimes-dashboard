import { useLaps, useTracks, useDrivers, useSessions } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { formatLap, getClassChartColor } from "@/lib/format";
import { normalizeSessionCategory, CLASS_ORDER, getClassBadgeClass, type SessionCategory } from "@/lib/classStyles";
import { useLanguage } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverName } from "@/components/DriverName";
import { SessionTypeBadge } from "@/components/SessionTypeBadge";
import { ActivityTile } from "@/components/ActivityTile";
import { Link } from "wouter";
import {
  Gauge, Route, Flag, Users, RefreshCw, Car, User, Bot, History, ChevronRight, Upload,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { useMemo } from "react";
import type { SessionEnriched } from "@/lib/api";

function HeroStat({
  icon: Icon, label, value, sub, testId,
}: { icon: any; label: string; value: string; sub?: string; testId: string }) {
  return (
    <div className="flex flex-col justify-center gap-1 border-border p-5 [&:nth-child(-n+2)]:border-t-0 [&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon size={12} />
        {label}
      </div>
      <div className="font-data text-xl font-bold tabular-nums" data-testid={`kpi-${testId}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Формат «трасса · трек-конфигурация», если конфигурация отличается от названия трассы. */
function trackDisplayLabel(trackName: string, course: string | null | undefined): string {
  if (!course || course.trim().toLowerCase() === trackName.trim().toLowerCase()) return trackName;
  return `${trackName} · ${course}`;
}

function formatSessionDate(iso: string, intlLocale: string): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getSessionBestLapMs(session: SessionEnriched): number | null {
  return session.results.reduce<number | null>((min, r) => {
    if (r.bestLapMs == null) return min;
    return min == null || r.bestLapMs < min ? r.bestLapMs : min;
  }, null);
}

export default function Overview() {
  const { t, locale, intlLocale } = useLanguage();
  const { data: laps, isLoading } = useLaps();
  const { data: tracks } = useTracks();
  const { data: drivers } = useDrivers();
  const { data: sessions } = useSessions();
  const { selectedDriverIds, isFiltered } = useDriverFilter();

  /** Форматирует дистанцию в метрах: < 1000 → «X м», иначе → «X.XX км» */
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} ${t("overview.meters")}`;
    return `${(meters / 1000).toFixed(2)} ${t("overview.km")}`;
  };

  const filteredLaps = useMemo(() => {
    if (!laps) return [];
    if (!isFiltered) return laps;
    return laps.filter((l) => selectedDriverIds.has(l.driverId));
  }, [laps, selectedDriverIds, isFiltered]);

  // Реальные и ИИ игроки из результатов сессий
  const { realPlayerCount, aiPlayerCount } = useMemo(() => {
    if (!sessions) return { realPlayerCount: 0, aiPlayerCount: 0 };
    const realSet = new Set<number>();
    const aiSet = new Set<number>();
    for (const session of sessions) {
      for (const result of session.results ?? []) {
        if (result.isPlayer === 1) realSet.add(result.driverId);
        else aiSet.add(result.driverId);
      }
    }
    // Убираем из aiSet тех, кто хоть раз был реальным игроком
    for (const id of realSet) aiSet.delete(id);
    return { realPlayerCount: realSet.size, aiPlayerCount: aiSet.size };
  }, [sessions]);

  // Общее количество пройденных кругов по всем сессиям
  const totalLapsCompleted = useMemo(() => {
    if (!sessions) return 0;
    return sessions.reduce((sum, s) => sum + (s.lapCount ?? 0), 0);
  }, [sessions]);

  // Суммарная дистанция по всем сессиям: lapCount * trackLengthM
  const totalDistanceM = useMemo(() => {
    if (!sessions) return 0;
    return sessions.reduce((sum, s) => {
      const laps = s.lapCount ?? 0;
      const lengthM = s.trackLengthM ?? 0;
      return sum + laps * lengthM;
    }, 0);
  }, [sessions]);

  // Сводка активности по категориям сессий: количество и суммарная длительность
  const activitySummary = useMemo(() => {
    const summary: Record<SessionCategory, { count: number; minutes: number }> = {
      practice: { count: 0, minutes: 0 },
      qualify: { count: 0, minutes: 0 },
      race: { count: 0, minutes: 0 },
    };
    for (const s of sessions ?? []) {
      const cat = normalizeSessionCategory(s.sessionType);
      summary[cat].count += 1;
      if (typeof s.sessionDurationMin === "number" && s.sessionDurationMin > 0) {
        summary[cat].minutes += s.sessionDurationMin;
      }
    }
    return summary;
  }, [sessions]);

  // Последние 5 сессий по дате
  const recentSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => b.dateTime.localeCompare(a.dateTime)).slice(0, 5);
  }, [sessions]);

  if (isLoading || !laps) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <Skeleton className="h-56" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (laps.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload size={22} />
          </div>
          <div>
            <p className="font-semibold">{t("overview.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
              {t("overview.emptyBody")}
            </p>
          </div>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload size={16} /> {t("overview.emptyCta")}
          </Link>
        </div>
      </div>
    );
  }

  if (filteredLaps.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t("overview.noDataForDrivers")}
        </p>
      </div>
    );
  }

  const bestLap = filteredLaps.reduce((a, b) => (b.lapMs < a.lapMs ? b : a), filteredLaps[0]);

  const bestByTrack = new Map<string, { ms: number; carClass: string }>();
  for (const l of filteredLaps) {
    const cur = bestByTrack.get(l.trackName);
    if (!cur || l.lapMs < cur.ms) bestByTrack.set(l.trackName, { ms: l.lapMs, carClass: l.carClass });
  }
  const chartData = Array.from(bestByTrack.entries())
    .map(([name, { ms, carClass }]) => ({ name, seconds: +(ms / 1000).toFixed(1), label: formatLap(ms), carClass }))
    .sort((a, b) => a.seconds - b.seconds);

  const chartClasses = Array.from(new Set(chartData.map((d) => d.carClass))).sort((a, b) => {
    const ai = CLASS_ORDER.indexOf(a as typeof CLASS_ORDER[number]);
    const bi = CLASS_ORDER.indexOf(b as typeof CLASS_ORDER[number]);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const filteredDriverCount = isFiltered
    ? selectedDriverIds.size
    : (drivers?.length ?? 0);

  const totalPlayers = realPlayerCount + aiPlayerCount;
  const realPct = totalPlayers > 0 ? (realPlayerCount / totalPlayers) * 100 : 0;
  const aiPct = 100 - realPct;

  return (
    <div className="space-y-6">
      <PageTitle />

      {/* Hero: лучший круг сезона + ключевые показатели */}
      <Card className="grid overflow-hidden lg:grid-cols-[1.3fr_1fr]">
        <div className="relative border-b border-border p-6 lg:border-b-0 lg:border-r">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(120% 140% at 0% 0%, hsl(var(--primary) / 0.12), transparent 60%)" }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <Gauge size={13} />
              {t("overview.heroEyebrow")}
            </div>
            <div className="font-data mt-2 text-4xl font-bold tabular-nums sm:text-5xl" data-testid="kpi-best-lap">
              {formatLap(bestLap.lapMs)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <Link href={`/drivers/${bestLap.driverId}`} className="hover:underline">
                <DriverName name={bestLap.driverName} isPlayer={bestLap.isPlayer} className="font-medium text-foreground" />
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Car size={14} />
                {bestLap.car}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Flag size={14} />
                {bestLap.trackName}
              </span>
              <Badge variant="outline" className={`text-[11px] ${getClassBadgeClass(bestLap.carClass)}`}>
                {bestLap.carClass}
              </Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2">
          <HeroStat testId="distance" icon={Route} label={t("overview.kpiDistance")} value={formatDistance(totalDistanceM)} sub={t("overview.kpiDistanceSub")} />
          <HeroStat testId="tracks" icon={Flag} label={t("overview.kpiTracks")} value={String(tracks?.length ?? 0)} sub={t("overview.kpiTracksSub")} />
          <HeroStat
            testId="drivers"
            icon={Users}
            label={t("overview.kpiDrivers")}
            value={String(filteredDriverCount)}
            sub={isFiltered ? t("overview.kpiDriversSubSelected") : t("overview.kpiDriversSubAll")}
          />
          <HeroStat testId="laps-completed" icon={RefreshCw} label={t("overview.kpiLapsCompleted")} value={String(totalLapsCompleted)} sub={t("overview.kpiLapsCompletedSub")} />
        </div>
      </Card>

      {/* Активность по типам сессий + реальные/ИИ пилоты */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">{t("overview.activityTitle")}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            <ActivityTile category="practice" label={t("sessionType.practice")} count={activitySummary.practice.count} minutes={activitySummary.practice.minutes} locale={locale} />
            <ActivityTile category="qualify" label={t("sessionType.qualify")} count={activitySummary.qualify.count} minutes={activitySummary.qualify.minutes} locale={locale} />
            <ActivityTile category="race" label={t("sessionType.race")} count={activitySummary.race.count} minutes={activitySummary.race.minutes} locale={locale} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-primary" />
            {t("overview.playersTitle")}
          </h2>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-green-500" style={{ width: `${realPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${aiPct}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5">
              <User size={14} className="text-green-500" />
              {t("overview.playersReal")}
              <span className="font-data font-bold tabular-nums text-green-500" data-testid="kpi-real-players">{realPlayerCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bot size={14} className="text-amber-400" />
              {t("overview.playersAi")}
              <span className="font-data font-bold tabular-nums text-amber-400" data-testid="kpi-ai-players">{aiPlayerCount}</span>
            </span>
          </div>
        </Card>
      </div>

      {/* Лучшее время по трассам */}
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("overview.chartTitle")}</h2>
          <span className="text-xs text-muted-foreground">{t("overview.chartSubtitle")}</span>
        </div>
        <div className="mb-3 flex flex-wrap gap-3">
          {chartClasses.map((cls) => (
            <span key={cls} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: getClassChartColor(cls) }} />
              {cls}
            </span>
          ))}
        </div>
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 60 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                type="category" dataKey="name" width={120}
                stroke="hsl(var(--muted-foreground))" fontSize={12}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8, fontSize: 13,
                }}
                formatter={(_v: any, _n: any, p: any) => [`${p.payload.label} · ${p.payload.carClass}`, t("overview.chartTooltipLap")]}
              />
              <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={getClassChartColor(d.carClass)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Последние сессии */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <History size={15} className="text-primary" />
            {t("overview.recentSessionsTitle")}
          </h2>
          <Link href="/sessions" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            {t("overview.recentSessionsMore")}
            <ChevronRight size={13} />
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("overview.recentSessionsEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              {recentSessions.map((session) => {
                const bestMs = getSessionBestLapMs(session);
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    data-testid={`row-recent-session-${session.id}`}
                    className="grid items-center gap-3 border-t border-border/60 px-5 py-3 transition-colors first:border-t-0 hover:bg-muted/40"
                    style={{ gridTemplateColumns: "140px minmax(160px,1fr) 90px 100px 16px" }}
                  >
                    <SessionTypeBadge sessionType={session.sessionType} />
                    <span className="truncate text-sm font-medium">
                      {trackDisplayLabel(session.trackName, session.course)}
                    </span>
                    <span className="font-data text-right text-sm font-semibold tabular-nums">
                      {bestMs != null ? formatLap(bestMs) : "—"}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      {formatSessionDate(session.dateTime, intlLocale)}
                    </span>
                    <ChevronRight size={15} className="text-muted-foreground/50" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function PageTitle() {
  const { t } = useLanguage();
  return (
    <div>
      <h1 className="font-display text-xl font-bold tracking-tight">{t("overview.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("overview.subtitle")}
      </p>
    </div>
  );
}
