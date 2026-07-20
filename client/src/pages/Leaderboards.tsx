import { useState, useMemo } from "react";
import { useLaps, useTracks } from "@/lib/api";
import { useDriverFilter } from "@/lib/driverFilter";
import { formatLap, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, Medal } from "lucide-react";
import { CLASS_ORDER, getClassBadgeClass, getClassAccentClass } from "@/lib/classStyles";
import { DriverName } from "@/components/DriverName";

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

function formatRecordDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function buildBoards(laps: LapRow[], maxPerClass: number): TrackBoard[] {
  const byBoard = new Map<string, { displayName: string; laps: LapRow[] }>();
  for (const l of laps) {
    const course = l.sessionCourse ?? null;
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
  const [trackId, setTrackId] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const { data: tracks } = useTracks();
  const { data: laps, isLoading } = useLaps();
  const { selectedDriverIds, isFiltered: globalFiltered } = useDriverFilter();

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
      if (l.sessionCourse) set.add(l.sessionCourse);
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
      filtered = filtered.filter((l: LapRow) => l.sessionCourse === courseFilter);
    }

    if (globalFiltered) {
      filtered = filtered.filter((l: LapRow) => selectedDriverIds.has(l.driverId));
    }

    const maxPerClass = trackId === "all" ? 3 : 50;
    return buildBoards(filtered, maxPerClass);
  }, [laps, trackId, classFilter, courseFilter, globalFiltered, selectedDriverIds]);

  return (
    <div className="flex flex-col gap-5">
      {/* Фильтры */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Лидерборды</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Лучшее время каждого пилота по трассам и классам
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Трасса</span>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger className="h-9 w-[200px]" data-testid="filter-track-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все трассы (топ-3 / класс)</SelectItem>
                {(tracks ?? []).map((t: { id: number; name: string }) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Класс</span>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-9 w-[160px]" data-testid="filter-class-lb">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все классы</SelectItem>
                {availableClasses.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {availableCourses.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Конфигурация</span>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="h-9 w-[180px]" data-testid="filter-course-lb">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все конфигурации</SelectItem>
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
                {board.classes.reduce((s, c) => s + c.rows.length, 0)} пилотов
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
                    {cls.rows.length} пилот{cls.rows.length === 1 ? "" : cls.rows.length < 5 ? "а" : "ов"}
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
                        <th className="w-10 px-4 py-2 text-center">#</th>
                        <th className="px-4 py-2 text-left">Пилот</th>
                        <th className="hidden px-4 py-2 text-left sm:table-cell">Команда</th>
                        <th className="hidden px-4 py-2 text-left md:table-cell">Автомобиль</th>
                        <th className="px-4 py-2 text-right">Время</th>
                        <th className="px-4 py-2 text-right">Отставание</th>
                        <th className="hidden px-4 py-2 text-right lg:table-cell">Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.rows.map((l, i) => {
                        const best = cls.rows[0].lapMs;
                        const recordDate = formatRecordDate(l.date);
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
                              <span className="font-medium">
                                <DriverName name={l.driverName} isPlayer={l.isPlayer} />
                              </span>
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
        <p className="py-12 text-center text-sm text-muted-foreground">Нет данных для выбранных фильтров</p>
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
