import { useMemo } from "react";
import { Link, useRoute } from "wouter";
import { useSession, useSessionLaps } from "@/lib/api";
import { formatLap, formatSector, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Flag, CalendarClock, Medal, User, Fuel } from "lucide-react";
import { DriverName } from "@/components/DriverName";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function SessionDetail() {
  const [, params] = useRoute("/sessions/:id");
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Сессия не найдена.</p>
        <Link href="/sessions" className="text-primary underline">Назад к сессиям</Link>
      </div>
    );
  }

  const fastest = session.results.reduce<number | null>((min, r) => {
    if (r.bestLapMs == null) return min;
    return min == null || r.bestLapMs < min ? r.bestLapMs : min;
  }, null);

  // Заголовок: trackName + course если отличается
  const courseLabel = session.course && session.course.toLowerCase() !== session.trackName.toLowerCase()
    ? session.course
    : null;

  return (
    <div className="space-y-5">
      <Link
        href="/sessions"
        data-testid="link-back"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Все сессии
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <Flag size={18} className="text-primary" />
          <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-session-title">
            {session.trackName}
            {courseLabel && (
              <span className="ml-2 text-base font-normal text-muted-foreground">· {courseLabel}</span>
            )}
          </h1>
          <Badge variant="outline" className="bg-secondary/40">{session.sessionType}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{session.event}</p>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CalendarClock size={13} /> {formatDate(session.dateTime)}</span>
          <span>Пилотов: {session.driverCount}</span>
          <span>Кругов засчитано: {session.lapCount}</span>
          {session.gameVersion && <span>Версия игры: {session.gameVersion}</span>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-4 py-3">
          <h2 className="font-semibold">Итоговые результаты</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Поз.</th>
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
                    <Badge variant="outline" className="bg-chart-3/15 text-chart-3 border-chart-3/30">{r.carClass}</Badge>
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

      {lapsByDriver.size > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold tracking-tight">Круги по пилотам</h2>
          {Array.from(lapsByDriver.entries()).map(([driverName, dlaps]) => {
            const sorted = [...(dlaps ?? [])].sort((a, b) => a.lapMs - b.lapMs);
            const best = sorted[0]?.lapMs;
            const byNum = [...(dlaps ?? [])];
            return (
              <Card key={driverName} className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-2.5">
                  <h3 className="font-semibold">{driverName}</h3>
                  <span className="font-data text-xs tabular-nums text-muted-foreground">
                    засчитано кругов: {byNum.length} · лучший {best ? formatLap(best) : "—"}
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
                        <th className="px-4 py-2 text-right">Время круга</th>
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
      )}

      {lapsByDriver.size === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
          <Fuel size={16} className="text-primary" />
          В этой сессии нет засчитанных кругов с валидным временем (например, только out-lap или пит).
        </div>
      )}
    </div>
  );
}
