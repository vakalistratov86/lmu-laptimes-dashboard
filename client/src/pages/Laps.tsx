import { useState, useMemo } from "react";
import { useLaps, useTracks, useDrivers } from "@/lib/api";
import { formatLap, formatSector, formatDelta, countryFlag } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, ArrowUpDown, X } from "lucide-react";

type SortKey = "lapMs" | "driverName" | "trackName" | "date";

const CLASS_BADGE: Record<string, string> = {
  Hypercar: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  LMP2: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  GTE: "bg-chart-3/15 text-chart-3 border-chart-3/30",
};

export default function Laps() {
  const [trackId, setTrackId] = useState<string>("all");
  const [driverId, setDriverId] = useState<string>("all");
  const [carClass, setCarClass] = useState<string>("all");
  const [conditions, setConditions] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lapMs");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: tracks } = useTracks();
  const { data: drivers } = useDrivers();
  const { data: laps, isLoading } = useLaps({
    trackId: trackId !== "all" ? Number(trackId) : undefined,
    driverId: driverId !== "all" ? Number(driverId) : undefined,
    carClass: carClass !== "all" ? carClass : undefined,
    conditions: conditions !== "all" ? conditions : undefined,
  });

  const sorted = useMemo(() => {
    if (!laps) return [];
    const arr = [...laps];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "lapMs") cmp = a.lapMs - b.lapMs;
      else if (sortKey === "driverName") cmp = a.driverName.localeCompare(b.driverName);
      else if (sortKey === "trackName") cmp = a.trackName.localeCompare(b.trackName);
      else cmp = a.date.localeCompare(b.date);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [laps, sortKey, sortAsc]);

  const bestMs = useMemo(
    () => (laps && laps.length ? Math.min(...laps.map((l) => l.lapMs)) : 0),
    [laps]
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((s) => !s);
    else { setSortKey(key); setSortAsc(true); }
  };

  const resetFilters = () => {
    setTrackId("all"); setDriverId("all"); setCarClass("all"); setConditions("all");
  };
  const hasFilters = trackId !== "all" || driverId !== "all" || carClass !== "all" || conditions !== "all";

  const exportCsv = () => {
    const headers = ["Трасса", "Пилот", "Команда", "Класс", "Машина", "Круг", "S1", "S2", "S3", "Условия", "Шины", "Дата"];
    const rows = sorted.map((l) => [
      l.trackName, l.driverName, l.team, l.carClass, l.car,
      formatLap(l.lapMs), formatSector(l.sector1Ms), formatSector(l.sector2Ms), formatSector(l.sector3Ms),
      l.conditions, l.tyre, l.date,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lmu-laptimes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Таблица времён</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sorted.length} заездов · нажмите на заголовок для сортировки
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export-csv">
          <Download size={15} className="mr-2" /> Экспорт CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect label="Трасса" value={trackId} onChange={setTrackId}
            options={[{ v: "all", l: "Все трассы" }, ...(tracks ?? []).map((t) => ({ v: String(t.id), l: t.name }))]} />
          <FilterSelect label="Пилот" value={driverId} onChange={setDriverId}
            options={[{ v: "all", l: "Все пилоты" }, ...(drivers ?? []).map((d) => ({ v: String(d.id), l: d.name }))]} />
          <FilterSelect label="Класс" value={carClass} onChange={setCarClass}
            options={[{ v: "all", l: "Все классы" }, { v: "Hypercar", l: "Hypercar" }, { v: "LMP2", l: "LMP2" }, { v: "GTE", l: "GTE" }]} />
          <FilterSelect label="Условия" value={conditions} onChange={setConditions}
            options={[{ v: "all", l: "Любые" }, { v: "Сухо", l: "Сухо" }, { v: "Дождь", l: "Дождь" }, { v: "Смешанно", l: "Смешанно" }]} />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="button-reset-filters" className="text-muted-foreground">
              <X size={14} className="mr-1" /> Сбросить
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
              <tr>
                <Th onClick={() => toggleSort("trackName")}>Трасса</Th>
                <Th onClick={() => toggleSort("driverName")}>Пилот</Th>
                <th className="px-4 py-3 text-left font-medium">Класс</th>
                <Th onClick={() => toggleSort("lapMs")} className="text-right">Круг</Th>
                <th className="px-4 py-3 text-right font-medium">Дельта</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">S1 / S2 / S3</th>
                <th className="hidden px-4 py-3 text-left font-medium lg:table-cell">Условия</th>
                <Th onClick={() => toggleSort("date")} className="hidden text-right lg:table-cell">Дата</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={8} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))}
              {!isLoading && sorted.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  Нет заездов под выбранные фильтры
                </td></tr>
              )}
              {!isLoading && sorted.map((l, idx) => (
                <tr
                  key={l.id}
                  data-testid={`row-lap-${l.id}`}
                  className="border-t border-border transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-2.5 font-medium">{l.trackName}</td>
                  <td className="px-4 py-2.5">{l.driverName}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={CLASS_BADGE[l.carClass]}>{l.carClass}</Badge>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-data tabular-nums ${l.lapMs === bestMs ? "font-bold text-primary" : ""}`}>
                    {formatLap(l.lapMs)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground">
                    {formatDelta(l.lapMs, bestMs)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground md:table-cell">
                    {formatSector(l.sector1Ms)} / {formatSector(l.sector2Ms)} / {formatSector(l.sector3Ms)}
                  </td>
                  <td className="hidden px-4 py-2.5 lg:table-cell">
                    <ConditionBadge c={l.conditions} tyre={l.tyre} />
                  </td>
                  <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground lg:table-cell">
                    {l.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Th({ children, onClick, className = "" }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-4 py-3 text-left font-medium hover:text-foreground ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown size={12} className="opacity-50" />
      </span>
    </th>
  );
}

function ConditionBadge({ c, tyre }: { c: string; tyre: string }) {
  const color = c === "Дождь" ? "text-chart-4" : c === "Смешанно" ? "text-chart-2" : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className={color}>{c}</span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-muted-foreground">{tyre}</span>
    </span>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[180px]" data-testid={`filter-${label}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
