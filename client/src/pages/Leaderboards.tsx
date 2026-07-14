import { useState, useMemo } from "react";
import { useLaps, useTracks } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { formatLap, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal } from "lucide-react";

const CLASS_ORDER = ["Hypercar", "LMP2", "LMP3", "GTE", "GT3", "GT4"];

const CLASS_BADGE: Record<string, string> = {
  Hypercar: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  LMP2:     "bg-chart-4/15 text-chart-4 border-chart-4/30",
  LMP3:     "bg-chart-5/15 text-chart-5 border-chart-5/30",
  GTE:      "bg-chart-3/15 text-chart-3 border-chart-3/30",
  GT3:      "bg-chart-2/15 text-chart-2 border-chart-2/30",
  GT4:      "bg-chart-6/15 text-chart-6 border-chart-6/30",
};

const CLASS_ACCENT: Record<string, string> = {
  Hypercar: "border-chart-1",
  LMP2:     "border-chart-4",
  LMP3:     "border-chart-5",
  GTE:      "border-chart-3",
  GT3:      "border-chart-2",
  GT4:      "border-chart-6",
};

type LapRow = { id: number; driverId: number; driverName: string; team: string; car: string; carClass: string; lapMs: number; trackId: number; trackName: string; date?: string };

interface ClassBoard {
  carClass: string;
  rows: LapRow[];
}

interface TrackBoard {
  trackName: string;
  classes: ClassBoard[];
}

function formatRecordDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function buildBoards(laps: LapRow[], maxPerClass: number): TrackBoard[] {
  const byTrack = new Map<string, LapRow[]>();
  for (const l of laps) {
    if (!byTrack.has(l.trackName)) byTrack.set(l.trackName, []);
    byTrack.get(l.trackName)!.push(l);
  }

  return Array.from(byTrack.entries())
    .map(([trackName, ls]) => {
      const byClass = new Map<string, Map<number, LapRow>>();
      for (const l of ls) {
        if (!byClass.has(l.carClass)) byClass.set(l.carClass, new Map());
        const classMap = byClass.get(l.carClass)!;
        const cur = classMap.get(l.driverId);
        if (!cur || l.lapMs < cur.lapMs) classMap.set(l.driverId, l);
      }

      const sortedClasses = Array.from(byClass.keys()).sort((a, b) => {
        const ai = CLASS_ORDER.indexOf(a);
        const bi = CLASS_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      const classes: ClassBoard[] = sortedClasses.map((carClass) => {
        const rows = Array.from(byClass.get(carClass)!.values())
          .sort((a, b) => a.lapMs - b.lapMs)
          .slice(0, maxPerClass);
        return { carClass, rows };
      });

      return { trackName, classes };
    })
    .sort((a, b) => a.trackName.localeCompare(b.trackName));
}

export default function Leaderboards() {
  const [trackId, setTrackId] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const { data: tracks } = useTracks();
  const { data: laps, isLoading } = useLaps();
  const { selectedDriverIds, isFiltered: globalFiltered } = useDriverFilter();

  const availableClasses = useMemo(() => {
    if (!laps) return [];
    const set = new Set<string>(laps.map((l: LapRow) => l.carClass).filter(Boolean));
    return Array.from(set).sort((a, b) => {
      const ai = CLASS_ORDER.indexOf(a);
      const bi = CLASS_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [laps]);

  const boards = useMemo((): TrackBoard[] => {
    if (!laps) return [];

    let filtered: LapRow[] = trackId === "all"
      ? laps
      : laps.filter((l: LapRow) => l.trackId === Number(trackId));

    if (classFilter !== "all") {
      filtered = filtered.filter((l: LapRow) => l.carClass === classFilter);
    }

    // Apply global driver filter
    if (globalFiltered) {
      filtered = filtered.filter((l: LapRow) => selectedDriverIds.has(l.driverId));
    }

    const maxPerClass = trackId === "all" ? 3 : 50;
    return buildBoards(filtered, maxPerClass);
  }, [laps, trackId, classFilter, globalFiltered, selectedDriverIds]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Лидерборды</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Лучшее время каждого пилота по трассам и классам
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Трасса</span>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger className="h-9 w-[200px]" data-testid="filter-track-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все трассы (топ-3 / класс)</SelectItem>
                {(tracks ?? []).map((t: { id: number; name: string }) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Класс</span>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-9 w-[160px]" data-testid="filter-class-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все классы</SelectItem>
                {availableClasses.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      )}

      <div className={trackId === "all" ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
        {boards.map((board) => (
          <Card key={board.trackName} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
              <Trophy size={16} className="text-primary" />
              <h2 className="font-semibold">{board.trackName}</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {board.classes.reduce((s, c) => s + c.rows.length, 0)} пилотов
              </span>
            </div>

            {board.classes.map((cls) => (
              <div key={cls.carClass}>
                <div
                  className={`flex items-center gap-2 border-l-4 bg-muted/30 px-4 py-1.5 ${CLASS_ACCENT[cls.carClass] ?? "border-border"}`}
                >
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${CLASS_BADGE[cls.carClass] ?? "bg-muted/40 text-muted-foreground border-border"}`}
                  >
                    {cls.carClass}
                  </Badge>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {cls.rows.length} пилот{cls.rows.length === 1 ? "" : cls.rows.length < 5 ? "а" : "ов"}
                  </span>
                </div>

                <ol>
                  {cls.rows.map((l, i) => {
                    const best = cls.rows[0].lapMs;
                    const recordDate = formatRecordDate(l.date);
                    return (
                      <li
                        key={l.id}
                        data-testid={`lb-row-${board.trackName}-${cls.carClass}-${i}`}
                        className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 first:border-t-0 hover:bg-muted/40"
                      >
                        <RankBadge rank={i + 1} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{l.driverName}</div>
                          <div className="truncate text-xs text-muted-foreground">{l.team}</div>
                          <div className="truncate text-xs text-muted-foreground/80" data-testid={`text-car-${l.id}`}>
                            {l.car}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-data text-sm tabular-nums ${i === 0 ? "font-bold text-primary" : ""}`}>
                            {formatLap(l.lapMs)}
                          </div>
                          {i > 0 && (
                            <div className="font-data text-[11px] tabular-nums text-muted-foreground">
                              {formatDelta(l.lapMs, best)}
                            </div>
                          )}
                          {recordDate && (
                            <div className="font-data text-[10px] tabular-nums text-muted-foreground/60 mt-0.5">
                              {recordDate}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </Card>
        ))}
      </div>

      {!isLoading && boards.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">Нет данных для выбранных фильтров</p>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-chart-2/20 text-chart-2",
    2: "bg-muted-foreground/15 text-muted-foreground",
    3: "bg-chart-1/20 text-chart-1",
  };
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-data text-sm font-bold tabular-nums ${colors[rank] ?? "bg-muted/50 text-muted-foreground"}`}
    >
      {rank <= 3 ? <Medal size={15} /> : rank}
    </div>
  );
}
