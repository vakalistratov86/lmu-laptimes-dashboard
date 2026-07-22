import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useLaps, useTracks } from "@/lib/api";
import { formatLap, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal, Upload } from "lucide-react";
import { CLASS_ORDER, getClassBadgeClass, getClassAccentClass } from "@/lib/classStyles";
import { DriverName } from "@/components/DriverName";
import { DriverFilterBar } from "@/components/DriverFilterBar";
import { useLanguage } from "@/lib/i18n";

type LapRow = {
  id: number;
  driverId: number;
  driverName: string;
  team: string;
  car: string;
  carClass: string;
  lapMs: number;
  trackId: number;
  trackName: string;
  date?: string;
  isPlayer?: number | null;
  sessionCourse?: string | null;
};

interface ClassBoard {
  carClass: string;
  rows: LapRow[];
}

interface TrackBoard {
  boardKey: string;
  displayName: string;
  classes: ClassBoard[];
}

function formatRecordDate(dateStr: string | undefined, intlLocale: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * A session's course only identifies a distinct track layout when it actually
 * differs from the venue name. Some LMU logs write the course tag as a plain
 * copy of the venue (or leave it blank) while others record it for the same
 * physical track — without this, those sessions split into a second,
 * near-identical leaderboard card for the same track.
 */
function normalizeCourse(course: string | null | undefined, trackName: string): string | null {
  const trimmed = course?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase() === trackName.trim().toLowerCase() ? null : trimmed;
}

function buildBoards(laps: LapRow[], maxPerClass: number): TrackBoard[] {
  const byBoard = new Map<string, { displayName: string; laps: LapRow[] }>();
  for (const l of laps) {
    const course = normalizeCourse(l.sessionCourse, l.trackName);
    const boardKey = course ? `${l.trackName}|||${course}` : l.trackName;
    const displayName = course ? `${l.trackName} · ${course}` : l.trackName;
    if (!byBoard.has(boardKey)) byBoard.set(boardKey, { displayName, laps: [] });
    byBoard.get(boardKey)!.laps.push(l);
  }

  return Array.from(byBoard.entries())
    .map(([boardKey, { displayName, laps: ls }]) => {
      const byClass = new Map<string, Map<number, LapRow>>();
      for (const l of ls) {
        if (!byClass.has(l.carClass)) byClass.set(l.carClass, new Map());
        const classMap = byClass.get(l.carClass)!;
        const cur = classMap.get(l.driverId);
        if (!cur || l.lapMs < cur.lapMs) classMap.set(l.driverId, l);
      }

      const sortedClasses = Array.from(byClass.keys()).sort((a, b) => {
        const ai = CLASS_ORDER.indexOf(a as typeof CLASS_ORDER[number]);
        const bi = CLASS_ORDER.indexOf(b as typeof CLASS_ORDER[number]);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });

      const classes: ClassBoard[] = sortedClasses.map((carClass) => {
        const rows = Array.from(byClass.get(carClass)!.values())
          .sort((a, b) => a.lapMs - b.lapMs)
          .slice(0, maxPerClass);
        return { carClass, rows };
      });

      return { boardKey, displayName, classes };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default function Leaderboards() {
  const { t, tn, intlLocale } = useLanguage();
  const [trackId, setTrackId] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const { data: tracks } = useTracks();
  const { data: laps, isLoading } = useLaps();

  // Фильтр по пилотам — состояние страницы, не глобальный контекст: сбрасывается
  // при уходе с Leaderboards и ни на что за пределами этой страницы не влияет.
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<number>>(new Set());
  const driversFiltered = selectedDriverIds.size > 0;
  const toggleDriver = (id: number) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const setManyDrivers = (ids: number[], selected: boolean) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const clearDrivers = () => setSelectedDriverIds(new Set());

  const availableClasses = useMemo(() => {
    if (!laps) return [];
    const set = new Set<string>(laps.map((l: LapRow) => l.carClass).filter(Boolean));
    return Array.from(set).sort((a, b) => {
      const ai = CLASS_ORDER.indexOf(a as typeof CLASS_ORDER[number]);
      const bi = CLASS_ORDER.indexOf(b as typeof CLASS_ORDER[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [laps]);

  const availableCourses = useMemo(() => {
    if (!laps) return [];
    const set = new Set<string>();
    for (const l of laps as LapRow[]) {
      const course = normalizeCourse(l.sessionCourse, l.trackName);
      if (course) set.add(course);
    }
    return Array.from(set).sort();
  }, [laps]);

  const boards = useMemo((): TrackBoard[] => {
    if (!laps) return [];

    let filtered: LapRow[] = trackId === "all"
      ? laps
      : laps.filter((l: LapRow) => l.trackId === Number(trackId));

    if (classFilter !== "all") {
      filtered = filtered.filter((l: LapRow) => l.carClass === classFilter);
    }

    if (courseFilter !== "all") {
      filtered = filtered.filter((l: LapRow) => normalizeCourse(l.sessionCourse, l.trackName) === courseFilter);
    }

    if (driversFiltered) {
      filtered = filtered.filter((l: LapRow) => selectedDriverIds.has(l.driverId));
    }

    const maxPerClass = trackId === "all" ? 3 : 50;
    return buildBoards(filtered, maxPerClass);
  }, [laps, trackId, classFilter, courseFilter, driversFiltered, selectedDriverIds]);

  return (
    <div className="flex flex-col gap-5">
      {/* Фильтры */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{t("leaderboards.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("leaderboards.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DriverFilterBar
            selectedDriverIds={selectedDriverIds}
            onToggleDriver={toggleDriver}
            onSetManyDrivers={setManyDrivers}
            onClear={clearDrivers}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("leaderboards.filterTrack")}</span>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger className="h-9 w-[200px]" data-testid="filter-track-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leaderboards.filterTrackAll")}</SelectItem>
                {(tracks ?? []).map((tr: { id: number; name: string }) => (
                  <SelectItem key={tr.id} value={String(tr.id)}>{tr.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("leaderboards.filterClass")}</span>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-9 w-[160px]" data-testid="filter-class-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("leaderboards.filterClassAll")}</SelectItem>
                {availableClasses.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {availableCourses.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("leaderboards.filterCourse")}</span>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="h-9 w-[180px]" data-testid="filter-course-lb">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("leaderboards.filterCourseAll")}</SelectItem>
                  {availableCourses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Скелетон загрузки */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      )}

      {/* Карточки трасс — вертикальный стек, каждая на всю ширину */}
      <div className="flex flex-col gap-4">
        {boards.map((board) => (
          <Card key={board.boardKey} className="w-full overflow-hidden">
            {/* Заголовок карточки */}
            <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
              <Trophy size={16} className="text-primary" />
              <h2 className="font-semibold">{board.displayName}</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {tn(board.classes.reduce((s, c) => s + c.rows.length, 0), "pilots")}
              </span>
            </div>

            {/* Таблица для каждого класса */}
            {board.classes.map((cls) => (
              <div key={cls.carClass}>
                {/* Заголовок класса */}
                <div
                  className={`flex items-center gap-2 border-l-4 bg-muted/30 px-4 py-1.5 ${getClassAccentClass(cls.carClass)}`}
                >
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${getClassBadgeClass(cls.carClass)}`}
                  >
                    {cls.carClass}
                  </Badge>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {tn(cls.rows.length, "pilots")}
                  </span>
                </div>

                {/* Таблица результатов. Команда/Автомобиль/Дата скрыты на узких экранах —
                    без max-w+truncate длинные названия команд ("Toyota Gazoo Racing" и т.п.)
                    переносились на 2-3 строки в своей ячейке, раздувая высоту каждой строки
                    и вытесняя время круга и отставание за пределы экрана без прокрутки. */}
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="w-10 px-4 py-2 text-center">{t("leaderboards.colPos")}</th>
                        <th className="px-4 py-2 text-left">{t("leaderboards.colDriver")}</th>
                        <th className="hidden px-4 py-2 text-left sm:table-cell">{t("leaderboards.colTeam")}</th>
                        <th className="hidden px-4 py-2 text-left md:table-cell">{t("leaderboards.colCar")}</th>
                        <th className="px-4 py-2 text-right">{t("leaderboards.colTime")}</th>
                        <th className="px-4 py-2 text-right">{t("leaderboards.colGap")}</th>
                        <th className="hidden px-4 py-2 text-right lg:table-cell">{t("leaderboards.colDate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.rows.map((l, i) => {
                        const best = cls.rows[0].lapMs;
                        const recordDate = formatRecordDate(l.date, intlLocale);
                        return (
                          <tr
                            key={l.id}
                            data-testid={`lb-row-${board.displayName}-${cls.carClass}-${i}`}
                            className="border-t border-border/60 hover:bg-muted/40"
                          >
                            {/* Позиция */}
                            <td className="px-4 py-2.5 text-center">
                              <RankBadge rank={i + 1} />
                            </td>
                            {/* Пилот */}
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/drivers/${l.driverId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium hover:underline"
                              >
                                <DriverName name={l.driverName} isPlayer={l.isPlayer} />
                              </Link>
                            </td>
                            {/* Команда */}
                            <td className="hidden max-w-[160px] truncate px-4 py-2.5 text-muted-foreground sm:table-cell">
                              {l.team || "—"}
                            </td>
                            {/* Автомобиль */}
                            <td
                              className="hidden max-w-[160px] truncate px-4 py-2.5 text-muted-foreground/80 md:table-cell"
                              data-testid={`text-car-${l.id}`}
                            >
                              {l.car}
                            </td>
                            {/* Время круга */}
                            <td className="px-4 py-2.5 text-right">
                              <span
                                className={`font-data tabular-nums ${
                                  i === 0 ? "font-bold text-green-500" : ""
                                }`}
                              >
                                {formatLap(l.lapMs)}
                              </span>
                            </td>
                            {/* Отставание */}
                            <td className="px-4 py-2.5 text-right">
                              {i > 0 ? (
                                <span className="font-data tabular-nums text-muted-foreground">
                                  {formatDelta(l.lapMs, best)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                            {/* Дата */}
                            <td className="hidden px-4 py-2.5 text-right lg:table-cell">
                              <span className="font-data text-[11px] tabular-nums text-muted-foreground/60">
                                {recordDate || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      {!isLoading && boards.length === 0 && (
        (laps?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload size={22} />
            </div>
            <div>
              <p className="font-semibold">{t("leaderboards.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                {t("leaderboards.emptyBody")}
              </p>
            </div>
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Upload size={16} /> {t("leaderboards.emptyCta")}
            </Link>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("leaderboards.noData")}</p>
        )
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "bg-chart-2/20 text-chart-2",
    2: "bg-muted-foreground/15 text-muted-foreground",
    3: "bg-chart-1/20 text-chart-1",
  };
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-data text-sm font-bold tabular-nums ${
        colors[rank] ?? "bg-muted/50 text-muted-foreground"
      }`}
    >
      {rank <= 3 ? <Medal size={15} /> : rank}
    </div>
  );
}
