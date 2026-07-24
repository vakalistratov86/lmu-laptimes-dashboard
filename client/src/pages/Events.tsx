import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  Flag,
  RefreshCw,
  ExternalLink,
  Star,
  AlertCircle,
  AlertTriangle,
  Trophy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrackMap, hasTrackMap } from "@/components/TrackMap";
import { useLanguage } from "@/lib/i18n";

// ─── Types ──────────────────────────────────────────────────────────────────

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
  source: "live" | "static";
}

interface DailyRace {
  id: string;
  track: string;
  classes: string[];
  durationMinutes: number;
  raceType: "Sprint" | "Endurance";
  activeFrom: string; // ISO date
  activeTo: string; // ISO date
}

// ─── Static Daily Races data (LMU official weekly rotation) ─────────────────
// Source: https://lemansultimate.com
const DAILY_RACES_STATIC: DailyRace[] = [
  {
    id: "dr-1",
    track: "Circuit de la Sarthe (Le Mans)",
    classes: ["Hypercar", "LMGT3"],
    durationMinutes: 30,
    raceType: "Endurance",
    activeFrom: "2025-01-01",
    activeTo: "2099-12-31",
  },
  {
    id: "dr-2",
    track: "Monza",
    classes: ["WEC LMP2", "LMP3"],
    durationMinutes: 20,
    raceType: "Sprint",
    activeFrom: "2025-01-01",
    activeTo: "2099-12-31",
  },
  {
    id: "dr-3",
    track: "Spa-Francorchamps",
    classes: ["ELMS LMP2", "LMGT3"],
    durationMinutes: 25,
    raceType: "Sprint",
    activeFrom: "2025-01-01",
    activeTo: "2099-12-31",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Та же адаптивная схема (bg .../15 + dark:text-...-400), что и в classStyles.ts —
// одинаково хорошо читается в тёмной и светлой теме.
const CLASS_COLORS: Record<string, string> = {
  Hypercar: "bg-red-500/15    text-red-600    dark:text-red-400    border-red-500/30",
  "WEC LMP2": "bg-blue-500/15   text-blue-600   dark:text-blue-400   border-blue-500/30",
  "ELMS LMP2": "bg-cyan-500/15   text-cyan-600   dark:text-cyan-400   border-cyan-500/30",
  LMP3: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  LMGT3: "bg-green-500/15  text-green-600  dark:text-green-400  border-green-500/30",
};

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// Алиасы: имя трассы в календаре LMU → ключ в TrackMap (там, где не совпадает дословно)
const TRACK_MAP_ALIASES: Record<string, string> = {
  Spa: "Spa-Francorchamps",
  Fuji: "Fuji Speedway",
  Portimao: "Portimão",
  "Circuit de la Sarthe (Le Mans)": "Le Mans",
};

function resolveTrackMapName(raw: string): string | null {
  if (hasTrackMap(raw)) return raw;
  const alias = TRACK_MAP_ALIASES[raw];
  if (alias && hasTrackMap(alias)) return alias;
  return null;
}

function classColor(cls: string): string {
  return CLASS_COLORS[cls] ?? "bg-muted/40 text-muted-foreground border-border";
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Компактная дата с днём недели: «Пт, 14 июля» / «Fri, Jul 14» (без года). Используем Intl —
    он сам знает падежи (родительный для ru: «14 июля», а не «14 Июль») и порядок день/месяц. */
function formatEventDateCompact(dateIso: string, intlLocale: string): string {
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  const weekday = capitalize(d.toLocaleDateString(intlLocale, { weekday: "short" }));
  const dayMonth = d.toLocaleDateString(intlLocale, { day: "numeric", month: "long" });
  return `${weekday}, ${dayMonth}`;
}

/** Обратный отсчёт: «сегодня» / «завтра» / «через N дн.» / «через N мес.» / «N дн. назад». */
function formatCountdown(dateIso: string, t: T): { label: string; tone: "soon" | "normal" | "past" } {
  const target = new Date(`${dateIso.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { label: t("events.today"), tone: "soon" };
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return { label: abs === 1 ? t("events.yesterday") : t("events.daysAgo", { n: abs }), tone: "past" };
  }
  if (diffDays === 1) return { label: t("events.tomorrow"), tone: "soon" };
  if (diffDays <= 60) return { label: t("events.inDays", { n: diffDays }), tone: diffDays <= 7 ? "soon" : "normal" };
  return { label: t("events.inMonths", { n: Math.round(diffDays / 30) }), tone: "normal" };
}

/** Минималистичная относительная метка времени обновления: «5 мин назад». */
function formatRelativeTime(iso: string, t: T): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return t("events.justNow");
  if (diffMin < 60) return t("events.minAgo", { n: diffMin });
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return t("events.hoursAgo", { n: diffH });
  return t("events.daysAgoShort", { n: Math.round(diffH / 24) });
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

// fix: раньше "today" здесь считался по UTC-дате (new Date().toISOString()),
// а formatCountdown() ниже — по ЛОКАЛЬНОЙ дате (setHours(0,0,0,0)). Для
// пользователя не в UTC эти два "сегодня" расходятся примерно половину
// суток — событие могло попасть во вкладку "прошедшие" с меткой отсчёта
// "сегодня" на самой карточке. Используем ту же локальную полночь, что и
// formatCountdown, чтобы обе метки всегда были согласованы.
function isUpcoming(ev: SpecialEvent): boolean {
  const target = new Date(`${ev.dateIso.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target >= today.getTime();
}

function isPast(ev: SpecialEvent): boolean {
  return !isUpcoming(ev);
}

// ─── Track icon (общий для обеих карточек) ────────────────────────────────────

function TrackIcon({ track, trackTba }: { track: string; trackTba?: boolean }) {
  const mapName = !trackTba ? resolveTrackMapName(track) : null;
  if (mapName) {
    return <TrackMap name={mapName} showStartFinish={false} className="h-8 w-8 shrink-0 text-primary/80" />;
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
      <Flag size={14} className={trackTba ? "text-muted-foreground" : "text-primary"} />
    </div>
  );
}

// ─── Countdown chip ────────────────────────────────────────────────────────────

const COUNTDOWN_TONE_CLASS: Record<"soon" | "normal" | "past", string> = {
  soon: "bg-primary/15 text-primary",
  normal: "bg-muted text-muted-foreground",
  past: "bg-muted/50 text-muted-foreground/60",
};

function CountdownChip({ dateIso }: { dateIso: string }) {
  const { t } = useLanguage();
  const { label, tone } = formatCountdown(dateIso, t);
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium",
        COUNTDOWN_TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

// ─── Special Event Card ───────────────────────────────────────────────────────

function EventCard({ ev }: { ev: SpecialEvent }) {
  const { t, intlLocale } = useLanguage();
  const past = isPast(ev);

  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all",
        ev.isFeatured
          ? "border-yellow-500/50 bg-yellow-500/10 shadow-md"
          : past
            ? "border-border bg-muted/20 opacity-60"
            : "border-border bg-card hover:border-primary/50",
      )}
    >
      {ev.isFeatured && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-950">
          <Star size={10} /> {t("events.featured")}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <TrackIcon track={ev.track} trackTba={ev.trackTba} />
          <div>
            <div
              className={cn("text-sm font-semibold", ev.trackTba ? "text-muted-foreground italic" : "text-foreground")}
            >
              {ev.trackTba ? t("events.trackTba") : ev.track}
            </div>
            <div className="text-xs text-muted-foreground">{formatEventDateCompact(ev.dateIso, intlLocale)}</div>
          </div>
        </div>
        <CountdownChip dateIso={ev.dateIso} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Clock size={10} /> {ev.duration}
          {t("events.hoursSuffix")}
        </span>
        {ev.classes.map((cls) => (
          <span key={cls} className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", classColor(cls))}>
            {cls}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Race Card ──────────────────────────────────────────────────────────

function DailyRaceCard({ race }: { race: DailyRace }) {
  const { t } = useLanguage();
  return (
    <div className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <TrackIcon track={race.track} />
          <span className="text-sm font-semibold text-foreground">{race.track}</span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            race.raceType === "Sprint"
              ? "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400"
              : "border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
          )}
        >
          {race.raceType}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          <Clock size={10} /> {race.durationMinutes} {t("events.minSuffix")}
        </span>
        {race.classes.map((cls) => (
          <span key={cls} className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", classColor(cls))}>
            {cls}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MainTab = "special" | "daily";
type EventFilter = "all" | "upcoming" | "past";

export default function Events() {
  const { t, tn, intlLocale } = useLanguage();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>("special");
  const [filter, setFilter] = useState<EventFilter>("upcoming");

  const { data, isLoading, isError } = useQuery<EventsResponse>({
    queryKey: ["special-events"],
    queryFn: () => fetch("/api/special-events").then((r) => r.json()),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const refresh = useMutation({
    mutationFn: () => fetch("/api/special-events/refresh", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["special-events"] }),
  });

  const events = data?.events ?? [];
  const filtered =
    filter === "upcoming" ? events.filter(isUpcoming) : filter === "past" ? events.filter(isPast) : events;

  const grouped = groupByMonth(filtered);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("events.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("events.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Минималистичный индикатор обновления — одинаково на обеих вкладках */}
          {data?.fetchedAt && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} />
              {formatRelativeTime(data.fetchedAt, t)}
            </span>
          )}
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover-elevate disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(refresh.isPending && "animate-spin")} />
            {t("events.refresh")}
          </button>
          <a
            href={
              mainTab === "special"
                ? "https://lemansultimate.com/special-events-calendar-q3-4-2026/"
                : "https://lemansultimate.com/daily-races/"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover-elevate"
          >
            <ExternalLink size={12} />
            LMU
          </a>
        </div>
      </div>

      {/* Предупреждение: сайт LMU недоступен, показаны сохранённые данные —
          без этого у пользователя нет способа понять, почему «Обновить»
          ничего не меняет на экране. */}
      {mainTab === "special" && data?.source === "static" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{t("events.staleSourceWarning")}</p>
        </div>
      )}

      {/* Основные табы */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        <button
          onClick={() => setMainTab("special")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            mainTab === "special"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Trophy size={14} />
          {t("events.tabSpecial")}
        </button>
        <button
          onClick={() => setMainTab("daily")}
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            mainTab === "daily"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap size={14} />
          {t("events.tabDaily")}
        </button>
      </div>

      {/* ── SPECIAL EVENTS ── */}
      {mainTab === "special" && (
        <div className="space-y-6">
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
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "upcoming"
                  ? t("events.filterUpcoming")
                  : f === "past"
                    ? t("events.filterPast")
                    : t("events.filterAll")}
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

          {isLoading && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <RefreshCw size={20} className="mr-2 animate-spin" /> {t("events.loading")}
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} /> {t("events.loadError")}
            </div>
          )}

          {!isLoading && !isError && (
            <div className="space-y-8">
              {grouped.size === 0 ? (
                <p className="text-center text-muted-foreground">{t("events.noEvents")}</p>
              ) : (
                Array.from(grouped.entries()).map(([monthKey, evs]) => {
                  const monthLabel = capitalize(
                    new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1).toLocaleDateString(
                      intlLocale,
                      { month: "long" },
                    ),
                  );
                  const year = monthKey.slice(0, 4);
                  return (
                    <section key={monthKey}>
                      <div className="mb-3 flex items-center gap-3">
                        <h2 className="font-display text-lg font-semibold">
                          {monthLabel} {year}
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">{tn(evs.length, "events")}</span>
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

          <p className="text-[11px] text-muted-foreground">
            {t("events.footerPrefix")}{" "}
            <a
              href="https://lemansultimate.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              lemansultimate.com
            </a>
            {t("events.footerSuffix")}
          </p>
        </div>
      )}

      {/* ── DAILY RACES ── */}
      {mainTab === "daily" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DAILY_RACES_STATIC.map((race) => (
              <DailyRaceCard key={race.id} race={race} />
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("events.dailyFooterPrefix")}{" "}
            <a
              href="https://lemansultimate.com/daily-races/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              {t("events.dailyFooterLinkText")}
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
