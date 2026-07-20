import { useLaps, useTracks, useDrivers, useSessions } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { formatLap } from "@/lib/format";
import { normalizeSessionCategory } from "@/lib/classStyles";
import { useLanguage } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Timer, Flag, Users, Gauge, Trophy, UserCheck, Bot, RefreshCw, Route } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { useMemo } from "react";

function KpiCard({
  icon: Icon, label, value, sub, testId,
}: { icon: any; label: string; value: string; sub?: string; testId: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-2 font-data text-2xl font-bold tabular-nums" data-testid={`kpi-${testId}`}>
            {value}
          </div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export default function Overview() {
  const { t } = useLanguage();
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

  // Количество гонок (сессий типа Race). sessionType хранится как составная строка
  // вида "Гонка (Race1)" — категорию определяет тот же нормализатор, что и везде
  // в приложении (Sessions, SessionTypeBadge), а не точное сравнение с "race".
  const raceCount = useMemo(() => {
    if (!sessions) return 0;
    return sessions.filter((s) => normalizeSessionCategory(s.sessionType) === "race").length;
  }, [sessions]);

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

  if (isLoading || !laps) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
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

  const bestByTrack = new Map<string, number>();
  for (const l of filteredLaps) {
    const cur = bestByTrack.get(l.trackName);
    if (cur == null || l.lapMs < cur) bestByTrack.set(l.trackName, l.lapMs);
  }
  const chartData = Array.from(bestByTrack.entries())
    .map(([name, ms]) => ({ name, seconds: +(ms / 1000).toFixed(1), label: formatLap(ms) }))
    .sort((a, b) => a.seconds - b.seconds);

  const filteredDriverCount = isFiltered
    ? selectedDriverIds.size
    : (drivers?.length ?? 0);

  return (
    <div className="space-y-6">
      <PageTitle />

      {/* Верхний ряд: базовая статистика */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          testId="distance"
          icon={Route}
          label={t("overview.kpiDistance")}
          value={formatDistance(totalDistanceM)}
          sub={t("overview.kpiDistanceSub")}
        />
        <KpiCard testId="tracks" icon={Flag} label={t("overview.kpiTracks")} value={String(tracks?.length ?? 0)} sub={t("overview.kpiTracksSub")} />
        <KpiCard
          testId="drivers"
          icon={Users}
          label={t("overview.kpiDrivers")}
          value={String(filteredDriverCount)}
          sub={isFiltered ? t("overview.kpiDriversSubSelected") : t("overview.kpiDriversSubAll")}
        />
        <KpiCard
          testId="best-lap"
          icon={Gauge}
          label={t("overview.kpiBestLap")}
          value={formatLap(bestLap.lapMs)}
          sub={`${bestLap.driverName} · ${bestLap.trackName} · ${bestLap.car}`}
        />
      </div>

      {/* Нижний ряд: статистика по гонкам и игрокам */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard testId="races" icon={Trophy} label={t("overview.kpiRaces")} value={String(raceCount)} sub={t("overview.kpiRacesSub")} />
        <KpiCard testId="real-players" icon={UserCheck} label={t("overview.kpiRealPlayers")} value={String(realPlayerCount)} sub={t("overview.kpiRealPlayersSub")} />
        <KpiCard testId="ai-players" icon={Bot} label={t("overview.kpiAiPlayers")} value={String(aiPlayerCount)} sub={t("overview.kpiAiPlayersSub")} />
        <KpiCard testId="laps-completed" icon={RefreshCw} label={t("overview.kpiLapsCompleted")} value={String(totalLapsCompleted)} sub={t("overview.kpiLapsCompletedSub")} />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("overview.chartTitle")}</h2>
          <span className="text-xs text-muted-foreground">{t("overview.chartSubtitle")}</span>
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
                formatter={(_v: any, _n: any, p: any) => [p.payload.label, t("overview.chartTooltipLap")]}
              />
              <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--chart-1))" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
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
