import { useMemo } from "react";
import { Link, useRoute, useSearch } from "wouter";
import { useSession, useSessionLaps } from "@/lib/api";
import { formatLap, formatSector, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Medal, User } from "lucide-react";
import { DriverName } from "@/components/DriverName";
import { getClassBadgeClass, getSessionTypeBadgeClass } from "@/lib/classStyles";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function normalizeType(raw: string) {
  const s = raw.toLowerCase();
  if (s.includes("гонка") || s.includes("race")) return "race";
  if (s.includes("квалификация") || s.includes("qualify")) return "qualify";
  if (s.includes("superpole")) return "superpole";
  if (s.includes("прогрев") || s.includes("warmup")) return "warmup";
  return "practice";
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-10 w-full rounded-none" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-t border-border/40" />
        ))}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
  const searchString = useSearch();
  const backFilter = new URLSearchParams(searchString).get("from_filter");
  const backHref = backFilter ? `/sessions?filter=${encodeURIComponent(backFilter)}` : "/sessions";

  const id = params ? Number(params.id) : undefined;
  const { data: session, isLoading } = useSession(id);
  const { data: laps } = useSessionLaps(id);

  const lapsByDriver = useMemo(() => {
    const map = new Map<string, typeof laps>();
    for (const l of laps ?? []) {
      if (!map.has(l.driverName)) map.set(l.driverName, []);
      map.get(l.driverName)!.push(l);
    }
    return map;
  }, [laps]);

  // Loading state (Issue #30)
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} /> Все сессии
        </Link>
        <DetailSkeleton />
      </div>
    );
  }

  // Not found fallback
  if (!session) {
    return (
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} /> Все сессии
        </Link>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <p className="font-semibold text-muted-foreground">Сессия не найдена.</p>
          <Link href={backHref} className="text-sm text-primary underline-offset-4 hover:underline">
            Вернуться к списку сессий
          </Link>
        </div>
      </div>
    );
  }

  const fastest = session.results.reduce<number | null>((min, r) => {
    if (r.bestLapMs == null) return min;
    return min == null || r.bestLapMs < min ? r.bestLapMs : min;
  }, null);

  const courseLabel = session.course &&
    session.course.toLowerCase() !== session.trackName.toLowerCase()
    ? session.course : null;

  const cat = normalizeType(session.sessionType);

  return (
    <div className="space-y-5">
      {/* Back button (Issue #27) */}
      <Link
        href={backHref}
        data-testid="link-back"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} /> Все сессии
      </Link>

      {/* Compact session header (Issue #27) */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge
          variant="outline"
          className={`text-xs ${getSessionTypeBadgeClass(cat)}`}
        >
          {session.sessionType}
        </Badge>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-session-title">
          {session.trackName}
          {courseLabel && (
            <span className="ml-2 text-base font-normal text-muted-foreground">· {courseLabel}</span>
          )}
        </h1>
        <span className="text-sm text-muted-foreground font-mono">
          {formatDate(session.dateTime)}
        </span>
      </div>

      {/* Session meta */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{session.event}</span>
        <span>Пилотов: {session.driverCount}</span>
        <span>Кругов: {session.lapCount}</span>
        {session.gameVersion && <span>Версия: {session.gameVersion}</span>}
      </div>

      {/* Results table — primary content (Issues #27, #28) */}
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-4 py-3">
          <h2 className="font-semibold text-sm">Итоговые результаты</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 w-12">Поз.</th>
                <th className="px-4 py-2.5">Пилот</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Команда / машина</th>
                <th className="px-4 py-2.5">Класс</th>
                <th className="px-4 py-2.5 text-right">Кругов</th>
                <th className="hidden px-4 py-2.5 text-right md:table-cell">Пит</th>
                <th className="px-4 py-2.5 text-right">Лучший круг</th>
              </tr>
            </thead>
            <tbody>
              {session.results.map((r) => (
                <tr
                  key={r.id}
                  data-testid={`row-result-${r.id}`}
                  className={`border-b border-border/60 last:border-0 hover:bg-muted/40 ${r.isPlayer ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 font-data text-sm font-bold tabular-nums">
                      {r.position <= 3 ? <Medal size={14} className="text-chart-2" /> : r.position}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {r.isPlayer === 1 && <User size={13} className="text-primary" />}
                      <DriverName
                        name={r.driverName}
                        isPlayer={r.isPlayer}
                        className={r.isPlayer === 1 ? "font-medium text-primary" : "font-medium"}
                      />
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                    <div className="truncate">{r.team}</div>
                    <div className="truncate text-xs">{r.car}{r.carNumber ? ` · #${r.carNumber}` : ""}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={getClassBadgeClass(r.carClass)}>{r.carClass}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-data tabular-nums">{r.laps}</td>
                  <td className="hidden px-4 py-2.5 text-right font-data tabular-nums md:table-cell">{r.pitstops}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-data tabular-nums ${r.bestLapMs === fastest ? "font-bold text-primary" : ""}`}>
                      {r.bestLapMs ? formatLap(r.bestLapMs) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Per-driver laps — secondary section, demoted below main table (Issue #29) */}
      {lapsByDriver.size > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 list-none">
            <span className="transition-transform group-open:rotate-90">▶</span>
            Круги по пилотам
            <span className="font-normal text-xs">({lapsByDriver.size} пилотов)</span>
          </summary>

          <div className="mt-4 space-y-4">
            {Array.from(lapsByDriver.entries()).map(([driverName, dlaps]) => {
              const sortedLaps = [...(dlaps ?? [])].sort((a, b) => a.lapMs - b.lapMs);
              const best = sortedLaps[0]?.lapMs;
              const byNum = [...(dlaps ?? [])];
              return (
                <Card key={driverName} className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5">
                    <h3 className="font-semibold text-sm">{driverName}</h3>
                    <span className="font-data text-xs tabular-nums text-muted-foreground">
                      {byNum.length} кругов · лучший {best ? formatLap(best) : "—"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="px-4 py-2">Круг</th>
                          <th className="px-4 py-2 text-right">Сектор 1</th>
                          <th className="px-4 py-2 text-right">Сектор 2</th>
                          <th className="px-4 py-2 text-right">Сектор 3</th>
                          <th className="px-4 py-2 text-right">Время</th>
                          <th className="px-4 py-2 text-right">Дельта</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byNum.map((l, i) => (
                          <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                            <td className="px-4 py-2 font-data tabular-nums text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 text-right font-data tabular-nums">{formatSector(l.sector1Ms)}</td>
                            <td className="px-4 py-2 text-right font-data tabular-nums">{formatSector(l.sector2Ms)}</td>
                            <td className="px-4 py-2 text-right font-data tabular-nums">{formatSector(l.sector3Ms)}</td>
                            <td className={`px-4 py-2 text-right font-data tabular-nums ${l.lapMs === best ? "font-bold text-primary" : ""}`}>
                              {formatLap(l.lapMs)}
                            </td>
                            <td className="px-4 py-2 text-right font-data text-xs tabular-nums text-muted-foreground">
                              {l.lapMs === best ? "—" : formatDelta(l.lapMs, best ?? l.lapMs)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        </details>
      )}

      {lapsByDriver.size === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
          Данные по кругам недоступны для этой сессии.
        </div>
      )}
    </div>
  );
}
