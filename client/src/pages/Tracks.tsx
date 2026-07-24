import { useBestLaps, useTracks, useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { MapPin, RotateCw, Ruler, ArrowRight, CalendarClock, Timer, Layers, Trophy } from "lucide-react";
import { TrackMap, hasTrackMap, resolveTrackMapName } from "@/components/TrackMap";
import { useMemo } from "react";
import { getClassBadgeClass } from "@/lib/classStyles";
import { useLanguage, translateCountry } from "@/lib/i18n";

function formatDate(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Tracks() {
  const { t, locale, intlLocale } = useLanguage();
  const { data: tracks, isLoading } = useTracks();
  // #121: агрегат "личный лучший круг на трассу+класс" вместо всех кругов
  // системы — для рекорда трассы и списка классов достаточно этого. Общее
  // число кругов считается ниже из sessions[].lapCount (уже загружено для
  // sessionCount), а не подсчётом сырых круговых записей.
  const { data: laps } = useBestLaps();
  const { data: sessions } = useSessions();

  /** Статистика по trackId */
  const statsByTrack = useMemo(() => {
    type TrackStat = {
      bestMs: number;
      bestDriver: string;
      lapCount: number;
      sessionCount: number;
      lastSession: string | null; // ISO дата
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
      if (l.lapMs < s.bestMs) {
        s.bestMs = l.lapMs;
        s.bestDriver = l.driverName;
      }
      if (l.carClass) s.carClasses.add(l.carClass);
    }

    for (const sess of sessions ?? []) {
      const s = ensure(sess.trackId);
      s.sessionCount++;
      // Реальное число кругов сессии (а не подсчёт строк из useBestLaps,
      // который уже свёрнут до личных лучших и не отражает общий объём).
      s.lapCount += sess.lapCount ?? 0;
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
        <h1 className="font-display text-xl font-bold tracking-tight">{t("tracks.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("tracks.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {(tracks ?? []).map((track) => {
            const st = statsByTrack.get(track.id);
            const hasBest = st && st.bestMs !== Infinity;

            return (
              <Link key={track.id} href={`/tracks/${track.id}`} data-testid={`card-track-${track.id}`}>
                <Card className="group flex h-full flex-row items-stretch p-4 hover-elevate gap-4">
                  {/* Левая часть: схема трассы — увеличенная, единый фирменный акцентный цвет.
                      Уже на телефонах ширина карточки — это почти вся ширина экрана, поэтому
                      фиксированные 144px схемы почти не оставляли места для правой колонки —
                      значения статистики наезжали друг на друга. На узких экранах схема меньше. */}
                  <div className="flex flex-col items-center justify-center shrink-0 w-24 sm:w-36">
                    {hasTrackMap(resolveTrackMapName(track)) ? (
                      <TrackMap
                        name={resolveTrackMapName(track)}
                        className="h-20 w-24 text-primary/80 transition-colors group-hover:text-primary sm:h-28 sm:w-36"
                      />
                    ) : (
                      <ArrowRight
                        size={16}
                        className="text-muted-foreground transition-transform group-hover:translate-x-1"
                      />
                    )}
                  </div>

                  {/* Правая часть: вся информация */}
                  <div className="flex flex-col flex-1 min-w-0">
                    {/* Название + страна */}
                    <h2 className="font-display text-base font-bold tracking-tight leading-tight">{track.name}</h2>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} /> {translateCountry(track.country, locale)} · {track.layout}
                    </div>

                    {/* Физические характеристики */}
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Ruler size={12} /> {track.lengthKm} {t("tracks.km")}
                      </span>
                      <span className="flex items-center gap-1">
                        <RotateCw size={12} /> {track.turns} {t("tracks.turns")}
                      </span>
                    </div>

                    {/* Классы автомобилей */}
                    {st && st.carClasses.size > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
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

                    {/* Статистика. min-w-0 на каждой ячейке + truncate на значении обязательны:
                        без них длинное время круга (напр. "3:25.180") не оборачивалось и не
                        обрезалось, а вылезало поверх соседней ячейки "Сессий" на узких экранах. */}
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2">
                      {/* Рекорд круга */}
                      <div className="col-span-1 min-w-0">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Trophy size={10} /> {t("tracks.record")}
                        </div>
                        <div className="mt-0.5 min-w-0">
                          <span className="block truncate font-data text-xs font-bold tabular-nums text-green-500 sm:text-sm">
                            {hasBest ? formatLap(st.bestMs) : "—"}
                          </span>
                          {hasBest && <div className="truncate text-[10px] text-muted-foreground">{st.bestDriver}</div>}
                        </div>
                      </div>

                      {/* Сессий */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Layers size={10} /> {t("tracks.sessionsCount")}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold">{st?.sessionCount ?? 0}</div>
                      </div>

                      {/* Кругов */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <Timer size={10} /> {t("tracks.lapsCount")}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-semibold">{st?.lapCount ?? 0}</div>
                      </div>
                    </div>

                    {/* Последняя сессия */}
                    {st?.lastSession && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CalendarClock size={10} /> {t("tracks.lastSession")}: {formatDate(st.lastSession, intlLocale)}
                      </div>
                    )}
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
