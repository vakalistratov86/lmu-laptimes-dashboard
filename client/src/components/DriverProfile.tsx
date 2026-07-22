import { useMemo } from "react";
import { Link } from "wouter";
import { useDrivers, useLaps, useBestLaps, useSessions, useDriverIncidents } from "@/lib/api";
import { formatLap, formatDelta, countryFlag, normalizeCourse } from "@/lib/format";
import { getClassBadgeClass, getMedalColorClass } from "@/lib/classStyles";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverName } from "@/components/DriverName";
import { SessionTypeBadge } from "@/components/SessionTypeBadge";
import {
  Timer, Trophy, Medal, ListChecks, Repeat, TrendingUp,
  MapPin, AlertTriangle, Flag, ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { LapTimeEnriched, SessionEnriched } from "@shared/schema";

// ─── Local view types ───────────────────────────────────────────────────────

interface TrackRecordRow {
  trackId: number;
  trackName: string;
  /** Конфигурация/лейаут трассы (см. normalizeCourse) — null, если совпадает с trackName. */
  courseLabel: string | null;
  carClass: string;
  bestLapMs: number;
  date: string;
  trackBestMs: number;
  isRecord: boolean;
}

interface DriverSessionRow {
  sessionId: number;
  dateTime: string;
  event: string;
  sessionType: string;
  trackName: string;
  carClass: string;
  car: string;
  team: string;
  position: number;
  classPosition: number;
  laps: number;
  pitstops: number;
  bestLapMs: number | null;
  finishStatus: string | null;
}

// ─── Date formatting (same convention as Leaderboards/Sessions) ───────────────

function formatDateOnly(dateStr: string | undefined, intlLocale: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string | undefined, intlLocale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface DriverProfileProps {
  driverId: number | undefined;
}

/**
 * Полное содержимое профиля пилота: шапка, ключевые статы, личные рекорды
 * по трассам, история сессий, инциденты/трек-лимиты. Переиспользуется
 * страницей /drivers/:id и страницей-пикером «Профиль пилота» — обе просто
 * передают driverId, вся загрузка данных и рендер живут здесь.
 */
export function DriverProfile({ driverId }: DriverProfileProps) {
  const { t, intlLocale } = useLanguage();

  const { data: drivers, isLoading: driversLoading } = useDrivers();
  // #121: собственные круги пилота — уже фильтр по driverId (не весь /api/laps).
  const { data: driverLapsRaw, isLoading: lapsLoading } = useLaps({ driverId });
  // Личный лучший круг каждого пилота на трассу+класс — для сравнения с
  // абсолютным рекордом трассы; размер ответа не растёт с числом кругов.
  const { data: bestLaps, isLoading: bestLapsLoading } = useBestLaps();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: incidentsData, isLoading: incidentsLoading } = useDriverIncidents(driverId);

  const driver = useMemo(
    () => drivers?.find((d) => d.id === driverId),
    [drivers, driverId],
  );

  const driverLaps = useMemo(() => driverLapsRaw ?? [], [driverLapsRaw]);

  const driverSessions = useMemo((): DriverSessionRow[] => {
    if (!sessions || driverId == null) return [];
    const rows: DriverSessionRow[] = [];
    for (const s of sessions as SessionEnriched[]) {
      const own = s.results.find((r) => r.driverId === driverId);
      if (!own) continue;
      rows.push({
        sessionId: s.id,
        dateTime: s.dateTime,
        event: s.event,
        sessionType: s.sessionType,
        trackName: s.trackName,
        carClass: own.carClass,
        car: own.car,
        team: own.team,
        position: own.position,
        classPosition: own.classPosition,
        laps: own.laps,
        pitstops: own.pitstops,
        bestLapMs: own.bestLapMs,
        finishStatus: own.finishStatus,
      });
    }
    return rows.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }, [sessions, driverId]);

  const trackRecords = useMemo((): TrackRecordRow[] => {
    if (driverLaps.length === 0) return [];

    // fix: ключ включает course — иначе трасса с несколькими конфигурациями
    // лейаута под одним trackId (course различается между сессиями) даёт
    // ОДНУ строку "личного лучшего", смешивая разные конфигурации, и не
    // совпадает с тем, как теперь группирует getBestLaps() на сервере
    // (см. #123 follow-up) — рекорд трассы сравнивался бы с чужой конфигурацией.
    const keyOf = (l: LapTimeEnriched) =>
      `${l.trackId}|${l.carClass}|${normalizeCourse(l.sessionCourse, l.trackName) ?? ""}`;

    const own = new Map<string, LapTimeEnriched>();
    for (const l of driverLaps) {
      const key = keyOf(l);
      const cur = own.get(key);
      if (!cur || l.lapMs < cur.lapMs) own.set(key, l);
    }

    // Абсолютный рекорд трассы+класса+конфигурации — минимум среди личных
    // лучших ВСЕХ пилотов (bestLaps уже содержит ровно по одной строке на
    // пилота на трассу+класс+course, так что здесь остаётся взять минимум).
    const absoluteBest = new Map<string, number>();
    for (const l of bestLaps ?? []) {
      const key = keyOf(l);
      const cur = absoluteBest.get(key);
      if (cur == null || l.lapMs < cur) absoluteBest.set(key, l.lapMs);
    }

    return Array.from(own.entries())
      .map(([key, l]) => {
        const trackBestMs = absoluteBest.get(key) ?? l.lapMs;
        return {
          trackId: l.trackId,
          trackName: l.trackName,
          courseLabel: normalizeCourse(l.sessionCourse, l.trackName),
          carClass: l.carClass,
          bestLapMs: l.lapMs,
          date: l.date,
          trackBestMs,
          isRecord: l.lapMs <= trackBestMs,
        };
      })
      .sort((a, b) =>
        a.trackName.localeCompare(b.trackName) ||
        (a.courseLabel ?? "").localeCompare(b.courseLabel ?? "") ||
        a.carClass.localeCompare(b.carClass));
  }, [bestLaps, driverLaps]);

  const stats = useMemo(() => {
    if (driverLaps.length === 0 && driverSessions.length === 0) return null;

    const bestLap = driverLaps.length
      ? driverLaps.reduce((a, b) => (b.lapMs < a.lapMs ? b : a))
      : null;

    // fix: группировка по trackId, а не по trackName — в каталоге трасс
    // намеренно есть разные физические конфигурации с одинаковым названием
    // (напр. "Bahrain" GP и "Bahrain" Outer Circuit — разные trackId), их
    // круги не должны схлопываться в одну "любимую трассу".
    const trackLapCounts = new Map<number, { name: string; count: number }>();
    for (const l of driverLaps) {
      const cur = trackLapCounts.get(l.trackId);
      if (cur) cur.count += 1;
      else trackLapCounts.set(l.trackId, { name: l.trackName, count: 1 });
    }
    let favoriteTrack: string | null = null;
    let favoriteTrackLaps = 0;
    for (const { name, count } of Array.from(trackLapCounts.values())) {
      if (count > favoriteTrackLaps) {
        favoriteTrack = name;
        favoriteTrackLaps = count;
      }
    }

    const raceSessions = driverSessions.filter((s) => {
      const raw = s.sessionType.toLowerCase();
      return raw.includes("гонка") || raw.includes("race");
    });
    const wins = raceSessions.filter((s) => s.classPosition === 1).length;
    const podiums = raceSessions.filter((s) => s.classPosition <= 3).length;
    const avgPosition = raceSessions.length
      ? raceSessions.reduce((sum, s) => sum + s.classPosition, 0) / raceSessions.length
      : null;

    const firstSeen = driverSessions.length
      ? driverSessions.reduce((a, b) => (b.dateTime < a.dateTime ? b : a)).dateTime
      : null;

    return {
      bestLap,
      totalLaps: driverLaps.length,
      totalSessions: driverSessions.length,
      favoriteTrack,
      favoriteTrackLaps,
      wins,
      podiums,
      raceSessionsCount: raceSessions.length,
      avgPosition,
      firstSeen,
    };
  }, [driverLaps, driverSessions]);

  const isLoading = driversLoading || lapsLoading || bestLapsLoading || sessionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {t("driverDetail.notFound")}{" "}
        <Link href="/leaderboards" className="text-primary">{t("driverDetail.notFoundBack")}</Link>
      </div>
    );
  }

  const firstSeenYear = stats?.firstSeen ? new Date(stats.firstSeen).getFullYear() : null;
  const incidents = incidentsData?.incidents ?? [];
  const trackLimits = incidentsData?.trackLimits ?? [];
  const hasIncidents = incidents.length > 0;
  const hasTrackLimits = trackLimits.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight">
              <DriverName name={driver.name} isPlayer={driver.isPlayer} />
            </h1>
            <Badge
              variant="outline"
              className={driver.isPlayer === 1
                ? "border-green-500/30 bg-green-500/10 text-green-500"
                : "border-amber-400/30 bg-amber-400/10 text-amber-500"}
            >
              {driver.isPlayer === 1 ? t("driverDetail.badgePlayer") : t("driverDetail.badgeAi")}
            </Badge>
            {firstSeenYear != null && (
              <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                {t("driverDetail.sinceBadge", { year: firstSeenYear })}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {driver.team && driver.team !== "—" && (
              <span className="flex items-center gap-1"><Flag size={14} /> {driver.team}</span>
            )}
            {driver.country && driver.country !== "—" && (
              <span className="flex items-center gap-1">{countryFlag(driver.country)} {driver.country}</span>
            )}
          </div>
        </div>
      </Card>

      {!stats ? (
        <div className="py-12 text-center text-muted-foreground">{t("driverDetail.noData")}</div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat icon={Timer} label={t("driverDetail.bestLap")}
              value={stats.bestLap ? formatLap(stats.bestLap.lapMs) : t("common.dash")}
              sub={stats.bestLap?.trackName} />
            <Stat icon={ListChecks} label={t("driverDetail.sessions")} value={String(stats.totalSessions)} />
            <Stat icon={Repeat} label={t("driverDetail.laps")} value={String(stats.totalLaps)}
              sub={stats.favoriteTrack ? t("driverDetail.favoriteTrack", { track: stats.favoriteTrack }) : undefined} />
            <Stat icon={Trophy} label={t("driverDetail.wins")} value={String(stats.wins)} />
            <Stat icon={Medal} label={t("driverDetail.podiums")} value={String(stats.podiums)} />
            <Stat icon={TrendingUp} label={t("driverDetail.avgPosition")}
              value={stats.avgPosition != null ? stats.avgPosition.toFixed(1) : t("common.dash")} />
          </div>

          {/* Track records */}
          {trackRecords.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-secondary/40 px-4 py-3">
                <h2 className="font-semibold">{t("driverDetail.recordsTitle")}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">{t("driverDetail.colTrack")}</th>
                      <th className="px-4 py-2.5 text-left font-medium">{t("driverDetail.colClass")}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{t("driverDetail.colLap")}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{t("driverDetail.colGapToRecord")}</th>
                      <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">{t("driverDetail.colDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackRecords.map((r) => (
                      <tr key={`${r.trackId}-${r.courseLabel ?? ""}-${r.carClass}`} className="border-t border-border hover:bg-muted/40">
                        <td className="px-4 py-2.5 flex items-center gap-1.5">
                          <MapPin size={13} className="text-muted-foreground" /> {r.trackName}
                          {r.courseLabel && (
                            <span className="text-xs text-muted-foreground">· {r.courseLabel}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className={getClassBadgeClass(r.carClass)}>{r.carClass}</Badge>
                        </td>
                        <td className={`px-4 py-2.5 text-right font-data tabular-nums ${r.isRecord ? "font-bold text-primary" : ""}`}>
                          {formatLap(r.bestLapMs)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground">
                          {r.isRecord ? t("driverDetail.trackRecordBadge") : formatDelta(r.bestLapMs, r.trackBestMs)}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground sm:table-cell">
                          {formatDateOnly(r.date, intlLocale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Session history */}
          {driverSessions.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border bg-secondary/40 px-4 py-3">
                <h2 className="font-semibold">{t("driverDetail.sessionsTitle")}</h2>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-[760px] items-center gap-4 border-b border-border bg-secondary/20 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <div className="w-[110px] shrink-0">{t("driverDetail.colType")}</div>
                  <div className="w-[130px] shrink-0">{t("driverDetail.colDate")}</div>
                  <div className="min-w-0 flex-1">{t("driverDetail.colTrack")}</div>
                  <div className="w-[70px] shrink-0">{t("driverDetail.colClass")}</div>
                  <div className="w-[70px] shrink-0 text-right">{t("driverDetail.colClassPos")}</div>
                  <div className="hidden w-[90px] shrink-0 text-right md:block">{t("driverDetail.colLap")}</div>
                  <div className="hidden w-[70px] shrink-0 text-right lg:block">{t("driverDetail.colStatus")}</div>
                  <div className="w-[15px] shrink-0" />
                </div>
                {driverSessions.map((s) => (
                  <Link
                    key={s.sessionId}
                    href={`/sessions/${s.sessionId}`}
                    data-testid={`row-driver-session-${s.sessionId}`}
                    className="flex min-w-[760px] items-center gap-4 border-t border-border px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-[110px] shrink-0">
                      <SessionTypeBadge sessionType={s.sessionType} />
                    </div>
                    <div className="w-[130px] shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(s.dateTime, intlLocale)}
                    </div>
                    <div className="min-w-0 flex-1 truncate font-medium">{s.trackName}</div>
                    <div className="w-[70px] shrink-0">
                      <Badge variant="outline" className={`text-xs ${getClassBadgeClass(s.carClass)}`}>{s.carClass}</Badge>
                    </div>
                    <div className="w-[70px] shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 font-data text-sm font-bold tabular-nums">
                        {s.classPosition <= 3 && <Medal size={13} className={getMedalColorClass(s.classPosition)} />}
                        {s.classPosition}
                      </span>
                    </div>
                    <div className="hidden w-[90px] shrink-0 text-right font-data text-sm tabular-nums text-muted-foreground md:block">
                      {s.bestLapMs ? formatLap(s.bestLapMs) : "—"}
                    </div>
                    <div className="hidden w-[70px] shrink-0 text-right text-xs text-muted-foreground lg:block">
                      {s.finishStatus ?? "—"}
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-muted-foreground/50" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Incidents & track limits */}
          {!incidentsLoading && (hasIncidents || hasTrackLimits) && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
                <AlertTriangle size={15} className="text-amber-500" />
                <h2 className="font-semibold">{t("driverDetail.incidentsTitle")}</h2>
              </div>

              {hasIncidents && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colDate")}</th>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colTrack")}</th>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colRole")}</th>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colTarget")}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("driverDetail.colSeverity")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((inc, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(inc.dateTime, intlLocale)}</td>
                          <td className="px-4 py-2">{inc.trackName}</td>
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              className={inc.role === "caused"
                                ? "border-red-500/30 bg-red-500/10 text-[10px] text-red-500"
                                : "border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-500"}
                            >
                              {inc.role === "caused" ? t("driverDetail.roleCaused") : t("driverDetail.roleReceived")}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{inc.otherDriverName ?? "—"}</td>
                          <td className="px-4 py-2 text-right font-data tabular-nums">
                            {inc.severity.toFixed(1)}
                            {inc.isImmovable === 1 && (
                              <Badge variant="outline" className="ml-2 border-red-500/30 bg-red-500/10 text-[10px] text-red-500">
                                {t("driverDetail.immovable")}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hasTrackLimits && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colDate")}</th>
                        <th className="px-4 py-2 text-left font-medium">{t("driverDetail.colTrack")}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("driverDetail.colLapNum")}</th>
                        <th className="px-4 py-2 text-right font-medium">{t("driverDetail.colPoints")}</th>
                        <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">{t("driverDetail.colDecision")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackLimits.map((tl, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-4 py-2 text-xs text-muted-foreground">{formatDateTime(tl.dateTime, intlLocale)}</td>
                          <td className="px-4 py-2">{tl.trackName}</td>
                          <td className="px-4 py-2 text-right font-data tabular-nums">{tl.lapNum}</td>
                          <td className="px-4 py-2 text-right font-data tabular-nums text-muted-foreground">
                            {tl.currentPoints ?? "—"}{tl.warningPoints != null ? ` / ${tl.warningPoints}` : ""}
                          </td>
                          <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">{tl.decision ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-2 font-data text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
