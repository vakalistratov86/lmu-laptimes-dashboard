import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useSessions } from "@/lib/api";
import { formatLap } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock, Users, Flag, ChevronRight, Upload,
  ChevronDown, ChevronUp, Dumbbell, Trophy, Timer, Gauge,
} from "lucide-react";

// ─── Утилиты ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "";
  const datePart = iso.slice(0, 10); // "YYYY-MM-DD"
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}.${month}.${year}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

/** Извлекает строку даты "YYYY-MM-DD" из ISO-строки */
function extractDateKey(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function normalizeType(raw: string): SessionCategory {
  const s = raw.toLowerCase();
  if (s.includes("гонка") || s.includes("race")) return "race";
  if (s.includes("квалификация") || s.includes("qualify")) return "qualify";
  if (s.includes("прогрев") || s.includes("warmup")) return "warmup";
  return "practice";
}

type SessionCategory = "practice" | "qualify" | "race" | "warmup";

interface CategoryMeta {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
  order: number;
}

const CATEGORY_META: Record<SessionCategory, CategoryMeta> = {
  practice: {
    label: "Тренировка",
    icon: <Dumbbell size={14} />,
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    order: 0,
  },
  qualify: {
    label: "Квалификация",
    icon: <Timer size={14} />,
    badgeClass: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    order: 1,
  },
  warmup: {
    label: "Прогрев",
    icon: <Gauge size={14} />,
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    order: 2,
  },
  race: {
    label: "Гонка",
    icon: <Trophy size={14} />,
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
    order: 3,
  },
};

/**
 * Формирует отображаемый заголовок трассы:
 * если course есть и отличается от trackName — добавляем через «·»
 */
function trackDisplayLabel(trackName: string, course: string | null | undefined): string {
  if (!course || course.toLowerCase() === trackName.toLowerCase()) return trackName;
  return `${trackName} · ${course}`;
}

interface GroupedEntry {
  /** Ключ группы: "YYYY-MM-DD|||trackName|||course" */
  groupKey: string;
  dateKey: string;       // "YYYY-MM-DD"
  trackName: string;
  course: string | null;
  categories: [SessionCategory, SessionItem[]][];
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

/**
 * Группирует сессии по (дата + трасса + конфигурация),
 * затем внутри каждой группы — по категории.
 * Одна и та же трасса в разные дни — разные группы.
 */
function groupSessions(items: SessionItem[]): GroupedEntry[] {
  const byGroup = new Map<string, { dateKey: string; trackName: string; course: string | null; items: SessionItem[] }>();

  for (const item of items) {
    const dateKey = extractDateKey(item.dateTime);
    const course = item.course ?? null;
    const groupKey = `${dateKey}|||${item.trackName}|||${course ?? ""}`;
    if (!byGroup.has(groupKey)) {
      byGroup.set(groupKey, { dateKey, trackName: item.trackName, course, items: [] });
    }
    byGroup.get(groupKey)!.items.push(item);
  }

  // Сортируем группы по дате убывания (новые сверху)
  const entries = Array.from(byGroup.entries()).sort(([a], [b]) => {
    const dateA = a.slice(0, 10);
    const dateB = b.slice(0, 10);
    return dateB.localeCompare(dateA);
  });

  return entries.map(([groupKey, { dateKey, trackName, course, items: groupItems }]) => {
    const byCategory = new Map<SessionCategory, SessionItem[]>();
    for (const s of groupItems) {
      const cat = normalizeType(s.sessionType);
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(s);
    }
    const sorted = Array.from(byCategory.entries()).sort(
      ([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order,
    );
    return { groupKey, dateKey, trackName, course, categories: sorted } as GroupedEntry;
  });
}

// ─── Компонент ─────────────────────────────────────────────────────────────────

export default function Sessions() {
  const { data: sessions, isLoading } = useSessions();

  const grouped = useMemo(() => (sessions ? groupSessions(sessions as SessionItem[]) : []), [sessions]);

  // По умолчанию все группы и категории свёрнуты
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const isGroupCollapsed = (key: string) => collapsedGroups[key] ?? true;
  const isCatCollapsed = (key: string) => collapsedCategories[key] ?? true;

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [key]: !isGroupCollapsed(key) }));

  const toggleCategory = (groupKey: string, cat: string) => {
    const key = `${groupKey}::${cat}`;
    setCollapsedCategories((prev) => ({ ...prev, [key]: !isCatCollapsed(key) }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-page-title">
          Сессии
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Импортированные из логов игры сессии — по дате, трассе и типу сессии
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
        <div className="space-y-8">
          {grouped.map(({ groupKey, dateKey, trackName, course, categories }) => {
            const isCollapsed = isGroupCollapsed(groupKey);
            const totalSessions = categories.reduce((sum, [, s]) => sum + s.length, 0);
            const displayLabel = trackDisplayLabel(trackName, course);
            const displayDate = formatDate(dateKey);

            return (
              <section key={groupKey}>
                {/* ── Заголовок группы (дата + трасса) ── */}
                <button
                  type="button"
                  onClick={() => toggleGroup(groupKey)}
                  className="mb-3 flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-secondary/40 transition-colors"
                >
                  <Flag size={16} className="shrink-0 text-primary" />
                  <h2 className="flex-1 font-display font-bold tracking-tight">{displayLabel}</h2>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                    <CalendarClock size={12} /> {displayDate}
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {totalSessions}{" "}
                    {totalSessions === 1 ? "сессия" : totalSessions < 5 ? "сессии" : "сессий"}
                  </Badge>
                  {isCollapsed
                    ? <ChevronDown size={16} className="text-muted-foreground" />
                    : <ChevronUp size={16} className="text-muted-foreground" />}
                </button>

                {/* ── Категории внутри группы ── */}
                {!isCollapsed && (
                  <div className="space-y-4 pl-5 border-l-2 border-border/40">
                    {categories.map(([cat, catSessions]) => {
                      const meta = CATEGORY_META[cat];
                      const catKey = `${groupKey}::${cat}`;
                      const isCatCol = isCatCollapsed(catKey);

                      return (
                        <div key={cat}>
                          {/* Заголовок категории */}
                          <button
                            type="button"
                            onClick={() => toggleCategory(groupKey, cat)}
                            className="mb-2 flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-secondary/30 transition-colors"
                          >
                            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>
                              {meta.icon}
                              {meta.label}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ×{catSessions.length}
                            </span>
                            {isCatCol
                              ? <ChevronDown size={14} className="text-muted-foreground" />
                              : <ChevronUp size={14} className="text-muted-foreground" />}
                          </button>

                          {/* Карточки сессий */}
                          {!isCatCol && (
                            <div className="grid gap-3 md:grid-cols-2">
                              {catSessions.map((s) => {
                                const player = s.results.find((r) => r.isPlayer === 1);
                                const winner = s.results[0];
                                return (
                                  <Link key={s.id} href={`/sessions/${s.id}`} data-testid={`card-session-${s.id}`}>
                                    <Card className="group h-full cursor-pointer p-4 transition-colors hover-elevate">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-sm text-muted-foreground">{s.event}</p>
                                        </div>
                                        <ChevronRight
                                          size={18}
                                          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                        />
                                      </div>

                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badgeClass}`}>
                                          {meta.icon}
                                          {s.sessionType.replace(/\s*\(.*\)/, "")}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <CalendarClock size={12} /> {formatDate(s.dateTime)}
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
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold ${mono ? "font-data tabular-nums" : ""}`}>
        {value}
      </div>
    </div>
  );
}
