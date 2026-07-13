import { useLaps, useTracks, useDrivers } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Timer, Flag, Users, Gauge, ArrowRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

function KpiCard({
  icon: Icon, label, value, sub,
}: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-2 font-data text-2xl font-bold tabular-nums" data-testid={`kpi-${label}`}>
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
  const { data: laps, isLoading } = useLaps();
  const { data: tracks } = useTracks();
  const { data: drivers } = useDrivers();

  if (isLoading || !laps) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const bestLap = laps.reduce((a, b) => (b.lapMs < a.lapMs ? b : a), laps[0]);

  // Лучшее время по каждой трассе
  const bestByTrack = new Map<string, number>();
  for (const l of laps) {
    const cur = bestByTrack.get(l.trackName);
    if (cur == null || l.lapMs < cur) bestByTrack.set(l.trackName, l.lapMs);
  }
  const chartData = Array.from(bestByTrack.entries())
    .map(([name, ms]) => ({ name, seconds: +(ms / 1000).toFixed(1), label: formatLap(ms) }))
    .sort((a, b) => a.seconds - b.seconds);

  return (
    <div className="space-y-6">
      <PageTitle />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Timer} label="Заездов" value={String(laps.length)} sub="в базе данных" />
        <KpiCard icon={Flag} label="Трасс" value={String(tracks?.length ?? 0)} sub="активных" />
        <KpiCard icon={Users} label="Пилотов" value={String(drivers?.length ?? 0)} sub="в чемпионате" />
        <KpiCard
          icon={Gauge}
          label="Лучший круг"
          value={formatLap(bestLap.lapMs)}
          sub={`${bestLap.driverName} · ${bestLap.trackName} · ${bestLap.car}`}
        />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Лучшее время по трассам</h2>
          <span className="text-xs text-muted-foreground">рекорд круга, сек</span>
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
                formatter={(_v: any, _n: any, p: any) => [p.payload.label, "Круг"]}
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

      <div className="grid gap-4 md:grid-cols-3">
        <QuickLink href="/laps" title="Таблица времён" desc="Все заезды с фильтрами" />
        <QuickLink href="/leaderboards" title="Лидерборды" desc="Рекорды по трассам" />
        <QuickLink href="/reports" title="Конструктор отчётов" desc="Свои графики и агрегации" />
      </div>
    </div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="font-display text-xl font-bold tracking-tight">Обзор</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Сводка по мониторингу времён на трассах LMU
      </p>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} data-testid={`quicklink-${href}`}>
      <Card className="group flex items-center justify-between p-4 hover-elevate">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        <ArrowRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Card>
    </Link>
  );
}
