import { useState, useMemo } from "react";
import { useLaps, useTracks } from "@/lib/api";
import { formatLap, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal } from "lucide-react";

const CLASS_BADGE: Record<string, string> = {
  Hypercar: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  LMP2: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  GTE: "bg-chart-3/15 text-chart-3 border-chart-3/30",
};

export default function Leaderboards() {
  const [trackId, setTrackId] = useState<string>("all");
  const { data: tracks } = useTracks();
  const { data: laps, isLoading } = useLaps();

  // Лучшее время каждого пилота (глобально или по трассе)
  const boards = useMemo(() => {
    if (!laps) return [];
    const filtered = trackId === "all" ? laps : laps.filter((l) => l.trackId === Number(trackId));

    if (trackId !== "all") {
      // Один лидерборд по конкретной трассе: лучший круг каждого пилота
      const best = new Map<number, typeof filtered[0]>();
      for (const l of filtered) {
        const cur = best.get(l.driverId);
        if (!cur || l.lapMs < cur.lapMs) best.set(l.driverId, l);
      }
      const rows = Array.from(best.values()).sort((a, b) => a.lapMs - b.lapMs);
      const trackName = tracks?.find((t) => t.id === Number(trackId))?.name ?? "";
      return [{ trackName, rows }];
    }

    // Все трассы: по одному лидерборду на трассу (топ-5)
    const byTrack = new Map<string, typeof filtered>();
    for (const l of filtered) {
      if (!byTrack.has(l.trackName)) byTrack.set(l.trackName, []);
      byTrack.get(l.trackName)!.push(l);
    }
    return Array.from(byTrack.entries()).map(([trackName, ls]) => {
      const best = new Map<number, typeof ls[0]>();
      for (const l of ls) {
        const cur = best.get(l.driverId);
        if (!cur || l.lapMs < cur.lapMs) best.set(l.driverId, l);
      }
      const rows = Array.from(best.values()).sort((a, b) => a.lapMs - b.lapMs).slice(0, 5);
      return { trackName, rows };
    }).sort((a, b) => a.trackName.localeCompare(b.trackName));
  }, [laps, trackId, tracks]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Лидерборды</h1>
          <p className="mt-1 text-sm text-muted-foreground">Лучшее время каждого пилота по трассам</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Трасса</span>
          <Select value={trackId} onValueChange={setTrackId}>
            <SelectTrigger className="h-9 w-[200px]" data-testid="filter-track-lb">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все трассы (топ-5)</SelectItem>
              {(tracks ?? []).map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      )}

      <div className={trackId === "all" ? "grid gap-4 md:grid-cols-2" : ""}>
        {boards.map((board) => (
          <Card key={board.trackName} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
              <Trophy size={16} className="text-primary" />
              <h2 className="font-semibold">{board.trackName}</h2>
              <span className="ml-auto text-xs text-muted-foreground">{board.rows.length} пилотов</span>
            </div>
            <ol>
              {board.rows.map((l, i) => {
                const best = board.rows[0].lapMs;
                return (
                  <li
                    key={l.id}
                    data-testid={`lb-row-${board.trackName}-${i}`}
                    className="flex items-center gap-3 border-t border-border/60 px-4 py-2.5 first:border-t-0 hover:bg-muted/40"
                  >
                    <RankBadge rank={i + 1} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.driverName}</div>
                      <div className="truncate text-xs text-muted-foreground">{l.team}</div>
                      <div className="truncate text-xs text-muted-foreground/80" data-testid={`text-car-${l.id}`}>{l.car}</div>
                    </div>
                    <Badge variant="outline" className={`${CLASS_BADGE[l.carClass]} hidden sm:inline-flex`}>
                      {l.carClass}
                    </Badge>
                    <div className="text-right">
                      <div className={`font-data text-sm tabular-nums ${i === 0 ? "font-bold text-primary" : ""}`}>
                        {formatLap(l.lapMs)}
                      </div>
                      {i > 0 && (
                        <div className="font-data text-[11px] tabular-nums text-muted-foreground">
                          {formatDelta(l.lapMs, best)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </div>
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
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-data text-sm font-bold tabular-nums ${colors[rank] ?? "bg-muted/50 text-muted-foreground"}`}>
      {rank <= 3 ? <Medal size={15} /> : rank}
    </div>
  );
}
