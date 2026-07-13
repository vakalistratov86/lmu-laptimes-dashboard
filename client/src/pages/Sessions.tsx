import { Link } from "wouter";
import { useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Users, Flag, ChevronRight, Upload } from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Sessions() {
  const { data: sessions, isLoading } = useSessions();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          Сессии
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Импортированные из логов игры сессии с результатами и кругами
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {!isLoading && (!sessions || sessions.length === 0) && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload size={22} />
          </div>
          <div>
            <p className="font-semibold">Пока нет импортированных сессий</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Подключите папку с логами игры, чтобы увидеть здесь результаты гонок и практик.
            </p>
          </div>
          <Link
            href="/import"
            data-testid="link-import-empty"
            className="mt-1 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover-elevate"
          >
            <Upload size={16} /> Импортировать логи
          </Link>
        </Card>
      )}

      {!isLoading && sessions && sessions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((s) => {
            const player = s.results.find((r) => r.isPlayer === 1);
            const winner = s.results[0];
            return (
              <Link key={s.id} href={`/sessions/${s.id}`} data-testid={`card-session-${s.id}`}>
                <Card className="group h-full cursor-pointer p-4 transition-colors hover-elevate">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Flag size={15} className="shrink-0 text-primary" />
                        <h2 className="truncate font-semibold">{s.trackName}</h2>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{s.event}</p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-secondary/40">{s.sessionType}</Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock size={13} /> {formatDate(s.dateTime)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                    <Stat icon={<Users size={13} />} label="Пилотов" value={String(s.driverCount)} />
                    <Stat label="Кругов" value={String(s.lapCount)} />
                    <Stat
                      label="Лучший круг"
                      value={winner?.bestLapMs ? formatLap(winner.bestLapMs) : "—"}
                      mono
                    />
                  </div>

                  {player && (
                    <div className="mt-3 flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-sm">
                      <span className="text-primary">Ваш результат</span>
                      <span className="font-data font-semibold tabular-nums text-primary">
                        P{player.position} · {player.bestLapMs ? formatLap(player.bestLapMs) : "—"}
                      </span>
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

function Stat({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold ${mono ? "font-data tabular-nums" : ""}`}>{value}</div>
    </div>
  );
}
