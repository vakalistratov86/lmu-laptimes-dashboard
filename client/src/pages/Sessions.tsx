import { useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Upload, Timer, Dumbbell, Trophy, ChevronRight } from "lucide-react";
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

// Цветовые классы фильтров — совпадают с цветами бейджей сессий
const FILTER_BG_CLASSES: Record<SessionCategory, string> = {
  practice:  "bg-sky-400/10 text-sky-400",
  qualify:   "bg-amber-400/10 text-amber-400",
  race:      "bg-emerald-400/10 text-emerald-400",
  superpole: "bg-fuchsia-400/10 text-fuchsia-400",
  warmup:    "bg-slate-400/10 text-slate-300",
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
// Оставлены только 3 основных типа: тренировка, квалификация, гонка
const FILTER_BUTTONS: { key: string; label: string }[] = [
  { key: "Все",       label: "Все" },
  { key: "practice", label: "Тренировка" },
  { key: "qualify",  label: "Квалификация" },
  { key: "race",     label: "Гонка" },
];

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SessionsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <div className="flex gap-6">
          {["w-16", "w-28", "w-24", "w-16", "w-20"].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-6 border-b border-border/50 px-4 py-3 last:border-0">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sessions() {
  const { data: sessions, isLoading } = useSessions();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const activeFilter = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("filter") ?? "Все";
  }, [searchString]);

  const setActiveFilter = (key: string) => {
    if (key === "Все") navigate("/sessions");
    else navigate(`/sessions?filter=${encodeURIComponent(key)}`);
  };

  const filtered = useMemo(() => {
    if (!sessions) return [] as SessionItem[];
    const all = sessions as SessionItem[];
    if (activeFilter === "Все") return all;
    // Для фильтра «qualify» — захватываем и superpole
    if (activeFilter === "qualify") {
      return all.filter((s) => {
        const cat = normalizeType(s.sessionType);
        return cat === "qualify" || cat === "superpole";
      });
    }
    // Для фильтра «practice» — захватываем и warmup
    if (activeFilter === "practice") {
      return all.filter((s) => {
        const cat = normalizeType(s.sessionType);
        return cat === "practice" || cat === "warmup";
      });
    }
    return all.filter((s) => normalizeType(s.sessionType) === activeFilter);
  }, [sessions, activeFilter]);

  // Sort by date descending, then by session type order
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
    <div className="space-y-4">
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
          const isAll = key === "Все";
          const isActive = activeFilter === key;
          const normalizedType: SessionCategory | null = isAll ? null : normalizeType(key);
          const colorClass = normalizedType != null ? FILTER_BG_CLASSES[normalizedType] : "";

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
                    : "bg-background text-muted-foreground border-border opacity-50 hover:opacity-80 hover:bg-accent/20",
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
      </div>

      {/* Loading state */}
      {isLoading && <SessionsTableSkeleton />}

      {/* Empty state — no sessions at all */}
      {!isLoading && !hasSessions && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-14 text-center">
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <p className="font-semibold text-muted-foreground">
            Нет сессий с выбранным типом
          </p>
          <button
            type="button"
            onClick={() => setActiveFilter("Все")}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Показать все сессии
          </button>
        </div>
      )}

      {/* Sessions table */}
      {!isLoading && hasSessions && hasFiltered && (
        <div className="overflow-hidden rounded-lg border border-border bg-card" role="table" aria-label="Список сессий">
          {/* Table header */}
          <div
            className="grid border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: "160px 1fr 140px 80px 110px 24px" }}
            role="row"
          >
            <div role="columnheader">Тип</div>
            <div role="columnheader">Трек</div>
            <div role="columnheader" className="text-right">Лучший круг</div>
            <div role="columnheader" className="text-right">Кругов</div>
            <div role="columnheader" className="text-right">Дата</div>
            <div role="columnheader" />
          </div>

          {/* Table rows */}
          {sorted.map((session) => {
            const cat = normalizeType(session.sessionType);
            const meta = CATEGORY_META[cat];
            const bestLap = getBestLapForSession(session);
            const filterParam = activeFilter !== "Все"
              ? `?from_filter=${encodeURIComponent(activeFilter)}`
              : "";
            const href = `/sessions/${session.id}${filterParam}`;

            return (
              <Link
                key={session.id}
                href={href}
                data-testid={`row-session-${session.id}`}
                className="grid cursor-pointer items-center border-b border-border/50 px-4 py-3 last:border-0 hover:bg-muted/40 active:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                style={{ gridTemplateColumns: "160px 1fr 140px 80px 110px 24px" }}
                role="row"
                aria-label={`${meta.label} — ${trackDisplayLabel(session.trackName, session.course)} — ${formatDate(session.dateTime)}`}
              >
                {/* Type badge */}
                <div role="cell">
                  <Badge
                    variant="outline"
                    className={`inline-flex items-center gap-1 text-xs font-medium ${getSessionTypeBadgeClass(cat)}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </Badge>
                </div>

                {/* Track */}
                <div className="truncate font-medium" role="cell">
                  {trackDisplayLabel(session.trackName, session.course)}
                </div>

                {/* Best lap */}
                <div className="text-right font-data tabular-nums text-sm text-muted-foreground" role="cell">
                  {bestLap ? formatLap(bestLap) : "—"}
                </div>

                {/* Lap count */}
                <div className="text-right font-data tabular-nums text-sm text-muted-foreground" role="cell">
                  {session.lapCount ?? "—"}
                </div>

                {/* Date */}
                <div className="text-right text-sm text-muted-foreground" role="cell">
                  {formatDate(session.dateTime)}
                </div>

                {/* Chevron */}
                <div className="flex justify-end text-muted-foreground/50" role="cell" aria-hidden="true">
                  <ChevronRight size={15} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
