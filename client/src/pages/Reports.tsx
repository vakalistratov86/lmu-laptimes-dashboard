import { useState, useMemo } from "react";
import { useLaps, useTracks, useDrivers } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, BarChart3 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, Legend,
} from "recharts";

type LapRow = {
  id: number;
  driverId: number;
  driverName: string;
  team: string;
  car: string;
  carClass: string;
  lapMs: number;
  trackId: number;
  trackName: string;
  conditions: string;
  sessionCourse?: string | null;
};

type Dimension = "track" | "driver" | "carClass" | "conditions" | "course";
type Metric = "best" | "avg" | "count";
type ChartType = "bar" | "line";

const DIM_LABEL: Record<Dimension, string> = {
  track: "Трасса", driver: "Пилот", carClass: "Класс машины", conditions: "Условия",
  course: "Конфигурация трассы",
};
const METRIC_LABEL: Record<Metric, string> = {
  best: "Лучший круг", avg: "Средний круг", count: "Количество заездов",
};

export default function Reports() {
  const [dimension, setDimension] = useState<Dimension>("track");
  const [metric, setMetric] = useState<Metric>("best");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: tracks } = useTracks();
  const { data: laps, isLoading } = useLaps();
  const { selectedDriverIds, isFiltered: globalFiltered } = useDriverFilter();

  const data = useMemo(() => {
    if (!laps) return [];
    let filtered = laps as LapRow[];
    if (trackFilter !== "all") filtered = filtered.filter((l) => l.trackId === Number(trackFilter));
    if (classFilter !== "all") filtered = filtered.filter((l) => l.carClass === classFilter);
    if (globalFiltered) filtered = filtered.filter((l) => selectedDriverIds.has(l.driverId));

    const groups = new Map<string, number[]>();
    for (const l of filtered) {
      let key = "";
      if (dimension === "track") {
        key = l.trackName;
      } else if (dimension === "driver") {
        key = l.driverName;
      } else if (dimension === "carClass") {
        key = l.carClass;
      } else if (dimension === "conditions") {
        key = l.conditions;
      } else if (dimension === "course") {
        // Группируем по «trackName · course» для импортных кругов,
        // для demo-кругов (sessionCourse == null) — просто trackName
        key = l.sessionCourse ? `${l.trackName} · ${l.sessionCourse}` : l.trackName;
      }
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(l.lapMs);
    }

    const rows = Array.from(groups.entries()).map(([name, times]) => {
      let value = 0;
      if (metric === "best") value = Math.min(...times);
      else if (metric === "avg") value = times.reduce((a, b) => a + b, 0) / times.length;
      else value = times.length;
      return {
        name,
        value: metric === "count" ? value : +(value / 1000).toFixed(2),
        raw: value,
        label: metric === "count" ? String(value) : formatLap(Math.round(value)),
      };
    });
    return rows.sort((a, b) => (metric === "count" ? b.value - a.value : a.value - b.value));
  }, [laps, dimension, metric, trackFilter, classFilter, globalFiltered, selectedDriverIds]);

  const unit = metric === "count" ? "заездов" : "сек";

  const exportCsv = () => {
    const headers = [DIM_LABEL[dimension], METRIC_LABEL[metric]];
    const rows = data.map((d) => [d.name, d.label]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lmu-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Конструктор отчётов</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Выберите измерение, метрику и тип графика — отчёт построится автоматически
        </p>
      </div>

      {/* Configurator */}
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ConfigSelect label="Измерение" value={dimension} onChange={(v) => setDimension(v as Dimension)}
            options={Object.entries(DIM_LABEL).map(([v, l]) => ({ v, l }))} testId="cfg-dimension" />
          <ConfigSelect label="Метрика" value={metric} onChange={(v) => setMetric(v as Metric)}
            options={Object.entries(METRIC_LABEL).map(([v, l]) => ({ v, l }))} testId="cfg-metric" />
          <ConfigSelect label="Тип графика" value={chartType} onChange={(v) => setChartType(v as ChartType)}
            options={[{ v: "bar", l: "Столбцы" }, { v: "line", l: "Линия" }]} testId="cfg-chart" />
          <ConfigSelect label="Трасса" value={trackFilter} onChange={setTrackFilter}
            options={[{ v: "all", l: "Все" }, ...(tracks ?? []).map((t) => ({ v: String(t.id), l: t.name }))]} testId="cfg-track" />
          <ConfigSelect label="Класс" value={classFilter} onChange={setClassFilter}
            options={[{ v: "all", l: "Все" }, { v: "Hypercar", l: "Hypercar" }, { v: "LMP2", l: "LMP2" }, { v: "GTE", l: "GTE" }]} testId="cfg-class" />
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {METRIC_LABEL[metric]} по «{DIM_LABEL[dimension]}»
            </h2>
            <p className="text-xs text-muted-foreground">
              {data.length} значений · единица: {unit}
              {metric !== "count" && " (меньше — лучше)"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export-report">
            <Download size={15} className="mr-2" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-80" />
        ) : data.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
            <BarChart3 size={40} className="mb-3 opacity-40" />
            Нет данных под выбранные фильтры
          </div>
        ) : (
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "bar" ? (
                <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11}
                    angle={-25} textAnchor="end" height={60} interval={0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={tooltipStyle}
                    formatter={(_v: any, _n: any, p: any) => [p.payload.label, METRIC_LABEL[metric]]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((_, i) => <Cell key={i} fill="hsl(var(--chart-1))" />)}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11}
                    angle={-25} textAnchor="end" height={60} interval={0} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(_v: any, _n: any, p: any) => [p.payload.label, METRIC_LABEL[metric]]} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--chart-1))" }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Data table */}
      {!isLoading && data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">{DIM_LABEL[dimension]}</th>
                <th className="px-4 py-2.5 text-right font-medium">{METRIC_LABEL[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.name} className="border-t border-border hover:bg-muted/40" data-testid={`report-row-${i}`}>
                  <td className="px-4 py-2.5 font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-right font-data tabular-nums">{d.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 13,
};

function ConfigSelect({
  label, value, onChange, options, testId,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[]; testId: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9" data-testid={testId}><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
