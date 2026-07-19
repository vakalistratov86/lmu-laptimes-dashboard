import { useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Upload, Timer, Dumbbell, Trophy, ChevronRight, Calendar, Activity } from "lucide-react";
import { getSessionTypeBadgeClass, SESSION_TYPE_ORDER } from "@/lib/classStyles";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10);
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type SessionCategory = "practice" | "qualify" | "race" | "warmup" | "superpole";

function normalizeType(raw: string): SessionCategory {
  const s = raw.toLowerCase();
  if (s.includes("гонка") || s.includes("race")) return "race";
  if (s.includes("квалификация") || s.includes("qualify")) return "qualify";
  if (s.includes("superpole")) return "superpole";
  if (s.includes("прогрев") || s.includes("warmup")) return "warmup";
  return "practice";
}

const CATEGORY_META: Record<SessionCategory, { label: string; icon: React.ReactNode }> = {
  practice:  { label: "Тренировка",   icon: <Dumbbell size={12} /> },
  qualify:   { label: "Квалификация", icon: <Timer size={12} /> },
  superpole: { label: "Квалификация", icon: <Timer size={12} /> },
  warmup:    { label: "Тренировка",   icon: <Dumbbell size={12} /> },
  race:      { label: "Гонка",        icon: <Trophy size={12} /> },
};

const FILTER_BG_CLASSES: Record<SessionCategory, string> = {
  practice:  "bg-blue-500/15 text-blue-500 dark:text-blue-400 border-blue-500/30",
  qualify:   "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  race:      "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  superpole: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  warmup:    "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
};

// Gradient accent per category for the left border stripe
const CATEGORY_ACCENT: Record<SessionCategory, string> = {
  practice:  "border-l-blue-500",
  qualify:   "border-l-yellow-500",
  superpole: "border-l-purple-500",
  warmup:    "border-l-orange-500",
  race:      "border-l-red-500",
};

function trackDisplayLabel(trackName: string, course: string | null | undefined): string {
  if (!course || course.toLowerCase() === trackName.toLowerCase()) return trackName;
  return `${trackName} · ${course}`;
}

type SessionItem = {
  id: number;
  trackName: string;
  course?: string | null;
  sessionType: string;
  dateTime: string;
  event: string;
  driverCount: number;
  lapCount: number;
  results: { isPlayer: number; position: number; bestLapMs: number | null }[];
};

function getBestLapForSession(session: SessionItem): number | null {
  return session.results.reduce<number | null>((min, r) => {
    if (r.bestLapMs == null) return min;
    return min == null || r.bestLapMs < min ? r.bestLapMs : min;
  }, null);
}

// ─── Filter buttons ────────────────────────────────────────────────────────────
const FILTER_BUTTONS: { key: string; label: string }[] = [
  { key: "all",      label: "Все" },
  { key: "practice", label: "Тренировка" },
  { key: "qualify",  label: "Квалификация" },
  { key: "race",     label: "Гонка" },
];

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SessionsCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, activeFilter }: { session: SessionItem; activeFilter: string }) {
  const cat = normalizeType(session.sessionType);
  const meta = CATEGORY_META[cat];
  const bestLap = getBestLapForSession(session);
  const filterParam = activeFilter !== "all"
    ? `?from_filter=${encodeURIComponent(activeFilter)}`
    : "";
  const href = `/sessions/${session.id}${filterParam}`;
  const accentClass = CATEGORY_ACCENT[cat];

  return (
    <Link
      href={href}
      data-testid={`card-session-${session.id}`}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        "border-l-[3px]", accentClass,
        "hover:bg-muted/40 hover:shadow-md active:bg-muted/60 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
      )}
      aria-label={`${meta.label} — ${trackDisplayLabel(session.trackName, session.course)} — ${formatDate(session.dateTime)}`}
    >
      {/* Top row: badge + date */}
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn("inline-flex items-center gap-1 text-xs font-medium", getSessionTypeBadgeClass(cat))}
        >
          {meta.icon}
          {meta.label}
        </Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar size={11} />
          {formatDate(session.dateTime)}
        </span>
      </div>

      {/* Track name */}
      <div className="font-semibold text-sm leading-snug truncate">
        {trackDisplayLabel(session.trackName, session.course)}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Activity size={11} />
          <span className="font-data tabular-nums font-medium text-foreground">
            {bestLap ? formatLap(bestLap) : "—"}
          </span>
          <span>лучший</span>
        </span>
        <span>{session.lapCount ?? "—"} кругов</span>
        {session.driverCount > 1 && (
          <span>{session.driverCount} пилотов</span>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={15}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors"
        aria-hidden
      />
    </Link>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sessions() {
  const { data: sessions, isLoading } = useSessions();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const activeFilter = useMemo(() => {
    const normalizedSearch = searchString.startsWith("?")
      ? searchString.slice(1)
      : searchString;
    const params = new URLSearchParams(normalizedSearch);
    const filter = params.get("filter");
    return filter === "practice" || filter === "qualify" || filter === "race"
      ? filter
      : "all";
  }, [searchString]);

  const setActiveFilter = (key: string) => {
    if (key === "all") navigate("/sessions");
    else navigate(`/sessions?filter=${encodeURIComponent(key)}`);
  };

  const filtered = useMemo(() => {
    if (!sessions) return [] as SessionItem[];
    const all = sessions as SessionItem[];
    if (activeFilter === "all") return all;
    if (activeFilter === "qualify") {
      return all.filter((s) => {
        const cat = normalizeType(s.sessionType);
        return cat === "qualify" || cat === "superpole";
      });
    }
    if (activeFilter === "practice") {
      return all.filter((s) => {
        const cat = normalizeType(s.sessionType);
        return cat === "practice" || cat === "warmup";
      });
    }
    return all.filter((s) => normalizeType(s.sessionType) === activeFilter);
  }, [sessions, activeFilter]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const dateCmp = b.dateTime.localeCompare(a.dateTime);
      if (dateCmp !== 0) return dateCmp;
      return (SESSION_TYPE_ORDER[normalizeType(a.sessionType)] ?? 99) -
             (SESSION_TYPE_ORDER[normalizeType(b.sessionType)] ?? 99);
    }),
    [filtered],
  );

  const hasSessions = sessions && sessions.length > 0;
  const hasFiltered = sorted.length > 0;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          Сессии
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Импортированные сессии — по дате, трассе и типу
        </p>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по типу сессии">
        {FILTER_BUTTONS.map(({ key, label }) => {
          const isAll = key === "all";
          const isActive = activeFilter === key;
          const normalizedType: SessionCategory | null =
            isAll ? null : (normalizeType(key) as SessionCategory);
          const colorClass =
            normalizedType != null ? FILTER_BG_CLASSES[normalizedType] : "";

          const icon =
            normalizedType === "practice" ? <Dumbbell className="h-3 w-3" /> :
            normalizedType === "qualify"  ? <Timer className="h-3 w-3" /> :
            normalizedType === "race"     ? <Trophy className="h-3 w-3" /> :
            null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors",
                isAll
                  ? isActive
                    ? "bg-accent text-accent-foreground border-border"
                    : "bg-background text-muted-foreground border-border hover:bg-accent/40"
                  : isActive
                    ? cn(colorClass, "border-transparent hover:ring-1 hover:ring-border/60")
                    : "bg-background text-muted-foreground/80 border-border opacity-60 hover:opacity-100 hover:bg-accent/10",
              )}
            >
              {icon && (
                <span className="flex h-4 w-4 items-center justify-center">
                  {icon}
                </span>
              )}
              <span>{label}</span>
            </button>
          );
        })}
        {hasSessions && (
          <span className="ml-auto flex items-center text-xs text-muted-foreground self-center">
            {sorted.length} сессий
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <SessionsCardSkeleton />}

      {/* Empty state — no sessions at all */}
      {!isLoading && !hasSessions && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload size={22} />
          </div>
          <div>
            <p className="font-semibold">Пока нет импортированных сессий</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
              Подключите папку с логами игры, чтобы увидеть здесь результаты гонок и практик.
            </p>
          </div>
          <Link
            href="/import"
            data-testid="link-import-empty"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload size={16} /> Импортировать логи
          </Link>
        </div>
      )}

      {/* No-results state — sessions exist but filter yields nothing */}
      {!isLoading && hasSessions && !hasFiltered && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <p className="font-semibold text-muted-foreground">
            Нет сессий с выбранным типом
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Показать все сессии
          </button>
        </div>
      )}

      {/* Sessions cards grid */}
      {!isLoading && hasSessions && hasFiltered && (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="Список сессий"
        >
          {sorted.map((session) => (
            <div key={session.id} role="listitem">
              <SessionCard session={session} activeFilter={activeFilter} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
