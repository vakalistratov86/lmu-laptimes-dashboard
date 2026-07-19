import { useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Upload, Dumbbell, Timer, Trophy, ChevronRight, type LucideIcon } from "lucide-react";
import {
  normalizeSessionCategory,
  getSessionTypeBadgeClass,
  SESSION_CATEGORY_LABEL,
  SESSION_TYPE_ORDER,
  type SessionCategory,
} from "@/lib/classStyles";
import { SessionTypeBadge } from "@/components/SessionTypeBadge";

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

// ─── Filter — единая сегментированная кнопка ───────────────────────────────────
// Технический ключ all → человекочитаемое "Все". Цвета и текст берутся из тех
// же источников (classStyles.ts), что и плашки в таблице — гарантированно
// совпадают.
const FILTER_ICON: Record<SessionCategory, LucideIcon> = {
  practice: Dumbbell,
  qualify: Timer,
  race: Trophy,
};

const FILTER_OPTIONS: { key: "all" | SessionCategory; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "practice", label: SESSION_CATEGORY_LABEL.practice },
  { key: "qualify", label: SESSION_CATEGORY_LABEL.qualify },
  { key: "race", label: SESSION_CATEGORY_LABEL.race },
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
    if (key === "all") {
      // wouter's hash-location navigate() only overwrites location.search
      // when the target URL has a query string of its own — it never
      // clears an existing one, so switching to "all" from another filter
      // silently keeps the old ?filter= param. Clear it explicitly first.
      if (window.location.search) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.hash,
        );
      }
      navigate("/sessions");
    } else {
      navigate(`/sessions?filter=${encodeURIComponent(key)}`);
    }
  };

  const filtered = useMemo(() => {
    if (!sessions) return [] as SessionItem[];
    const all = sessions as SessionItem[];

    if (activeFilter === "all") return all;

    return all.filter((s) => normalizeSessionCategory(s.sessionType) === activeFilter);
  }, [sessions, activeFilter]);

  // Sort by date descending, then by session type order
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const dateCmp = b.dateTime.localeCompare(a.dateTime);
      if (dateCmp !== 0) return dateCmp;
      return SESSION_TYPE_ORDER[normalizeSessionCategory(a.sessionType)] -
             SESSION_TYPE_ORDER[normalizeSessionCategory(b.sessionType)];
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

      {/* Filter — одна кнопка, разделённая на секции; цвет секции совпадает с плашкой */}
      <div
        className="inline-flex overflow-hidden rounded-lg border border-border"
        role="group"
        aria-label="Фильтр по типу сессии"
      >
        {FILTER_OPTIONS.map(({ key, label }, index) => {
          const isAll = key === "all";
          const isActive = activeFilter === key;
          const Icon = isAll ? null : FILTER_ICON[key];

          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-colors",
                index > 0 && "border-l border-border",
                isAll
                  ? isActive
                    ? "bg-accent text-accent-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent/40"
                  : isActive
                    // Активная цветная секция: тот же цвет, что и плашка этого типа
                    ? getSessionTypeBadgeClass(key)
                    // Неактивная: нейтральный фон
                    : "bg-background text-muted-foreground/80 hover:bg-accent/10",
              )}
            >
              {Icon && <Icon size={13} />}
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
            onClick={() => setActiveFilter("all")}
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
            const cat = normalizeSessionCategory(session.sessionType);
            const bestLap = getBestLapForSession(session);
            const filterParam = activeFilter !== "all"
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
                aria-label={`${SESSION_CATEGORY_LABEL[cat]} — ${trackDisplayLabel(session.trackName, session.course)} — ${formatDate(session.dateTime)}`}
              >
                {/* Type badge */}
                <div role="cell">
                  <SessionTypeBadge sessionType={session.sessionType} />
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
