import { useLaps, useTracks, useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Flag, MapPin, RotateCw, Ruler, ArrowRight, CalendarClock, Timer, Layers, Trophy } from "lucide-react";
import { TrackMap, hasTrackMap } from "@/components/TrackMap";
import { useMemo } from "react";
import { getClassBadgeClass } from "@/lib/classStyles";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Tracks() {
  const { data: tracks, isLoading } = useTracks();
  const { data: laps } = useLaps();
  const { data: sessions } = useSessions();

  /** Статистика по trackId */
  const statsByTrack = useMemo(() => {
    type TrackStat = {
      bestMs: number;
      bestDriver: string;
      lapCount: number;
      sessionCount: number;
      lastSession: string | null;   // ISO дата
      sessionTypes: Set<string>;
      carClasses: Set<string>;
    };

    const m = new Map<number, TrackStat>();

    const ensure = (id: number): TrackStat => {
      if (!m.has(id)) {
        m.set(id, {
          bestMs: Infinity,
          bestDriver: "",
          lapCount: 0,
          sessionCount: 0,
          lastSession: null,
          sessionTypes: new Set(),
          carClasses: new Set(),
        });
      }
      return m.get(id)!;
    };

    for (const l of laps ?? []) {
      const s = ensure(l.trackId);
      s.lapCount++;
      if (l.lapMs < s.bestMs) {
        s.bestMs = l.lapMs;
        s.bestDriver = l.driverName;
      }
      if (l.carClass) s.carClasses.add(l.carClass);
    }

    for (const sess of sessions ?? []) {
      const s = ensure(sess.trackId);
      s.sessionCount++;
      s.sessionTypes.add(sess.sessionType);
      if (!s.lastSession || sess.dateTime > s.lastSession) {
        s.lastSession = sess.dateTime;
      }
    }

    return m;
  }, [laps, sessions]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Трассы</h1>
        <p className="mt-1 text-sm text-muted-foreground">Каталог трасс LMU — статистика, рекорды и сессии</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(tracks ?? []).map((t) => {
            const st = statsByTrack.get(t.id);
            const hasBest = st && st.bestMs !== Infinity;

            return (
              <Link key={t.id} href={`/tracks/${t.id}`} data-testid={`card-track-${t.id}`}>
                <Card className="group flex h-full flex-col p-5 hover-elevate">

                  {/* Шапка: иконка + схема трассы */}
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

                  {/* Название + страна */}
                  <h2 className="font-display text-base font-bold tracking-tight leading-tight">{t.name}</h2>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} /> {t.country} · {t.layout}
                  </div>

                  {/* Физические характеристики */}
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Ruler size={12} /> {t.lengthKm} км</span>
                    <span className="flex items-center gap-1"><RotateCw size={12} /> {t.turns} пов.</span>
                  </div>

                  {/* Классы автомобилей */}
                  {st && st.carClasses.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from(st.carClasses).map((cls) => (
                        <Badge
                          key={cls}
                          variant="outline"
                          className={`px-1.5 py-0 text-[10px] ${getClassBadgeClass(cls)}`}
                        >
                          {cls}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Статистика */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">

                    {/* Рекорд круга */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Trophy size={10} /> Рекорд круга
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className="font-data text-base font-bold tabular-nums text-primary">
                          {hasBest ? formatLap(st.bestMs) : "—"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{hasBest ? st.bestDriver : ""}</span>
                      </div>
                    </div>

                    {/* Сессий */}
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Layers size={10} /> Сессий
                      </div>
                      <div className="mt-0.5 text-sm font-semibold">
                        {st?.sessionCount ?? 0}
                      </div>
                    </div>

                    {/* Кругов */}
                    <div>
                      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Timer size={10} /> Кругов
                      </div>
                      <div className="mt-0.5 text-sm font-semibold">
                        {st?.lapCount ?? 0}
                      </div>
                    </div>

                  </div>

                  {/* Последняя сессия */}
                  {st?.lastSession && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarClock size={10} /> Последняя: {formatDate(st.lastSession)}
                    </div>
                  )}

                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
