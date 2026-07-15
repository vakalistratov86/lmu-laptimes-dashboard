import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, Flag, RefreshCw, ExternalLink, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecialEvent {
  id: string;
  weekOf: string;
  dateIso: string;
  duration: number;
  track: string;
  trackTba: boolean;
  classes: string[];
  isFeatured: boolean;
  sourceUrl: string;
  fetchedAt: string;
}

interface EventsResponse {
  events: SpecialEvent[];
  fetchedAt: string;
  sourceUrl: string;
}

const CLASS_COLORS: Record<string, string> = {
  Hypercar:   "bg-red-900/40 text-red-300 border-red-800",
  "WEC LMP2": "bg-blue-900/40 text-blue-300 border-blue-800",
  "ELMS LMP2":"bg-cyan-900/40 text-cyan-300 border-cyan-800",
  LMP3:       "bg-purple-900/40 text-purple-300 border-purple-800",
  LMGT3:      "bg-green-900/40 text-green-300 border-green-800",
};

const MONTH_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

function classColor(cls: string): string {
  return CLASS_COLORS[cls] ?? "bg-zinc-800 text-zinc-300 border-zinc-700";
}

function formatDateRu(dateIso: string): string {
  const [year, month, day] = dateIso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function groupByMonth(events: SpecialEvent[]): Map<string, SpecialEvent[]> {
  const map = new Map<string, SpecialEvent[]>();
  for (const ev of events) {
    const month = ev.dateIso.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(ev);
  }
  return map;
}

function isUpcoming(ev: SpecialEvent): boolean {
  return new Date(ev.dateIso) >= new Date(new Date().toISOString().slice(0, 10));
}

function isPast(ev: SpecialEvent): boolean {
  return !isUpcoming(ev);
}

function EventCard({ ev }: { ev: SpecialEvent }) {
  const past = isPast(ev);
  const upcoming = isUpcoming(ev);
  // Ближайшее (в ближайшие 7 дней)
  const diff = (new Date(ev.dateIso).getTime() - Date.now()) / 86400000;
  const isNext = diff >= 0 && diff <= 7;

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all",
        ev.isFeatured
          ? "border-yellow-600/60 bg-yellow-950/20 shadow-md"
          : past
          ? "border-zinc-800 bg-zinc-900/40 opacity-60"
          : "border-zinc-700 bg-zinc-900/60 hover:border-primary/50",
        isNext && "ring-1 ring-primary/60"
      )}
    >
      {ev.isFeatured && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 rounded-full bg-yellow-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-100">
          <Star size={10} /> Featured
        </div>
      )}
      {isNext && (
        <div className="absolute -top-2 left-3 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          Ближайшее
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag size={14} className={ev.trackTba ? "text-zinc-500" : "text-primary"} />
          <span className={cn("text-sm font-semibold", ev.trackTba ? "text-zinc-400 italic" : "text-foreground")}>
            {ev.trackTba ? "Трасса TBA" : ev.track}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} />
          <span>{ev.duration}h</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <CalendarDays size={12} />
        <span>{formatDateRu(ev.dateIso)}</span>
        {past && <span className="ml-1 text-zinc-600">(прошло)</span>}
      </div>

      <div className="flex flex-wrap gap-1">
        {ev.classes.map((cls) => (
          <span
            key={cls}
            className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", classColor(cls))}
          >
            {cls}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Events() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");

  const { data, isLoading, isError } = useQuery<EventsResponse>({
    queryKey: ["special-events"],
    queryFn: () => fetch("/api/special-events").then((r) => r.json()),
    staleTime: 1000 * 60 * 30, // 30 мин
    refetchOnWindowFocus: false,
  });

  const refresh = useMutation({
    mutationFn: () =>
      fetch("/api/special-events/refresh", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["special-events"] }),
  });

  const events = data?.events ?? [];
  const filtered =
    filter === "upcoming"
      ? events.filter(isUpcoming)
      : filter === "past"
      ? events.filter(isPast)
      : events;

  const grouped = groupByMonth(filtered);

  const fetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleString("ru-RU")
    : null;

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Special Events</h1>
          <p className="text-sm text-muted-foreground">
            Официальный календарь гонок на выносливость Le Mans Ultimate
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-muted-foreground">Обновлено: {fetchedAt}</span>
          )}
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover-elevate disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(refresh.isPending && "animate-spin")} />
            Обновить
          </button>
          <a
            href="https://lemansultimate.com/special-events-calendar-q3-4-2026/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover-elevate"
          >
            <ExternalLink size={12} />
            LMU
          </a>
        </div>
      </div>

      {/* Фильтр */}
      <div className="flex gap-2">
        {(["upcoming", "all", "past"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "upcoming" ? "Предстоящие" : f === "past" ? "Прошедшие" : "Все"}
            <span className="ml-1.5 text-[10px] opacity-60">
              {f === "upcoming"
                ? events.filter(isUpcoming).length
                : f === "past"
                ? events.filter(isPast).length
                : events.length}
            </span>
          </button>
        ))}
      </div>

      {/* Состояния */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center text-muted-foreground">
          <RefreshCw size={20} className="mr-2 animate-spin" /> Загрузка...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
          <AlertCircle size={16} /> Не удалось загрузить события. Проверьте соединение.
        </div>
      )}

      {/* Список по месяцам */}
      {!isLoading && !isError && (
        <div className="space-y-8">
          {grouped.size === 0 ? (
            <p className="text-center text-muted-foreground">Нет событий</p>
          ) : (
            Array.from(grouped.entries()).map(([monthKey, evs]) => {
              const [year, month] = monthKey.split("-").map(Number);
              return (
                <section key={monthKey}>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="font-display text-lg font-semibold">
                      {MONTH_RU[month - 1]} {year}
                    </h2>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">{evs.length} событий</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {evs.map((ev) => (
                      <EventCard key={ev.id} ev={ev} />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* Сноска */}
      <p className="text-[11px] text-muted-foreground">
        Расписание публикуется на{" "}
        <a
          href="https://lemansultimate.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          lemansultimate.com
        </a>
        . Пт/Сб/Вс — точное время слотов уточняется ближе к дате.
      </p>
    </div>
  );
}
