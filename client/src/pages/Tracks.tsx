import { useLaps, useTracks } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Flag, MapPin, RotateCw, Ruler, ArrowRight } from "lucide-react";
import { TrackMap, hasTrackMap } from "@/components/TrackMap";
import { useMemo } from "react";

export default function Tracks() {
  const { data: tracks, isLoading } = useTracks();
  const { data: laps } = useLaps();

  const bestByTrack = useMemo(() => {
    const m = new Map<number, { ms: number; driver: string }>();
    for (const l of laps ?? []) {
      const cur = m.get(l.trackId);
      if (!cur || l.lapMs < cur.ms) m.set(l.trackId, { ms: l.lapMs, driver: l.driverName });
    }
    return m;
  }, [laps]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Трассы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Каталог трасс LMU и рекорды кругов</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(tracks ?? []).map((t) => {
            const best = bestByTrack.get(t.id);
            return (
              <Link key={t.id} href={`/tracks/${t.id}`} data-testid={`card-track-${t.id}`}>
                <Card className="group flex h-full flex-col p-5 hover-elevate">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Flag size={18} />
                    </div>
                    {hasTrackMap(t.name) ? (
                      <TrackMap name={t.name} className="h-12 w-20 text-primary/70 transition-colors group-hover:text-primary" />
                    ) : (
                      <ArrowRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-1" />
                    )}
                  </div>
                  <h2 className="font-display text-base font-bold tracking-tight">{t.name}</h2>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} /> {t.country} · {t.layout}
                  </div>
                  <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Ruler size={12} /> {t.lengthKm} км</span>
                    <span className="flex items-center gap-1"><RotateCw size={12} /> {t.turns} поворотов</span>
                  </div>
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Рекорд круга</div>
                    <div className="mt-0.5 flex items-baseline justify-between">
                      <span className="font-data text-lg font-bold tabular-nums text-primary">
                        {best ? formatLap(best.ms) : "—"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{best?.driver ?? ""}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
