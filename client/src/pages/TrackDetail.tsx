import { useRoute, Link } from "wouter";
import { useTrack, useLaps } from "@/lib/api";
import { formatLap, formatSector, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MapPin, Ruler, RotateCw, Timer, Users, Lightbulb, History } from "lucide-react";
import { TrackMap, hasTrackMap, resolveTrackMapName } from "@/components/TrackMap";
import { DriverName } from "@/components/DriverName";
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { getClassBadgeClass } from "@/lib/classStyles";
import { useLanguage, translateCountry, type Locale } from "@/lib/i18n";

const TRACK_FACTS: Record<Locale, Record<string, string>> = {
  ru: {
    "Spa-Francorchamps": "Радийон-де-Спа — самый быстрый поворот в мировом автоспорте, 8G при 300+ км/ч.",
    "Monza": "Самая быстрая трасса Ф1: средняя скорость круга превышает 260 км/ч.",
    "Bahrain": "Первая ночная гонка Ф1 в 2014 году; под трассой проложены нефтепроводы.",
    "Portimão": "Самый новый автодром Ф1 (дебют 2020) с перепадом высот 80 м.",
    "Imola": "В 1994 году здесь погибли Айртон Сенна и Роланд Ратценбергер за один уикенд.",
    "Interlagos": "Работает с 1940 г.; дождь там падает сверху и снизу одновременно — из-за озера.",
    "COTA": "Единственная трасса в США, спроектированная специально под Формулу 1.",
    "Silverstone": "Первая в истории трасса Ф1: Гран-при Великобритании 1950 года.",
    "Barcelona": "Используется для тестов всеми командами Ф1 — самая известная и изученная трасса.",
    "Paul Ricard": "Пять разных конфигураций асфальта снижают скорость вылетов — полосы голубого цвета.",
    "Lusail": "Первая трасса в Катаре; освещение 3400 прожекторов мощностью 100 000 люкс.",
    "Le Mans": "24-часовая гонка с 1923 г.; победители преодолевают до 5800 км за сутки.",
    "Fuji Speedway": "Проектирован в 1966 г. с уклоном для стока воды — трасса «наклонена» на 3°.",
    "Sebring": "Гонки проводятся с 1950 г. на бывшей авиабазе — асфальт на бетоне взлётной полосы.",
  },
  en: {
    "Spa-Francorchamps": "Raidillon at Spa is the fastest corner in world motorsport — 8G at 300+ km/h.",
    "Monza": "F1's fastest circuit: average lap speed exceeds 260 km/h.",
    "Bahrain": "Host of F1's first-ever night race in 2014; oil pipelines run beneath the track.",
    "Portimão": "F1's newest circuit (debuted 2020), with an 80 m elevation change.",
    "Imola": "Ayrton Senna and Roland Ratzenberger both died here in a single 1994 weekend.",
    "Interlagos": "Racing since 1940; rain seems to fall from above and below at once, thanks to the adjacent lake.",
    "COTA": "The only circuit in the US purpose-built for Formula 1.",
    "Silverstone": "Host of the first-ever F1 race: the 1950 British Grand Prix.",
    "Barcelona": "Used for pre-season testing by every F1 team — the most studied circuit on the calendar.",
    "Paul Ricard": "Five different asphalt run-off configurations slow cars after an off — the blue-striped tarmac.",
    "Lusail": "Qatar's first circuit; lit by 3,400 floodlights at 100,000 lux.",
    "Le Mans": "The 24-hour race has run since 1923; winners can cover up to 5,800 km in a day.",
    "Fuji Speedway": "Designed in 1966 with a drainage gradient — the track is tilted 3°.",
    "Sebring": "Racing since 1950 on a former airbase — asphalt laid over the old runway concrete.",
  },
};

interface TrackHistoryEntry {
  builtYear: number;
  openedNote?: string;
  renovations: { year: number; note: string }[];
}

const TRACK_HISTORY: Record<Locale, Record<string, TrackHistoryEntry>> = {
  ru: {
    "Le Mans": {
      builtYear: 1923,
      openedNote: "Первая гонка 24 Heures du Mans",
      renovations: [
        { year: 1932, note: "Спрямлена шпилька Pontlieue, построена новая пит-стрит" },
        { year: 1990, note: "На Mulsanne Straight добавлены две шиканы для безопасности" },
        { year: 2002, note: "Перепрофилированы Porsche Curves и шикана Dunlop" },
      ],
    },
    "Spa-Francorchamps": {
      builtYear: 1921,
      renovations: [
        { year: 1979, note: "Трасса сокращена с 14 до 7 км, убраны участки по открытым дорогам" },
        { year: 2022, note: "Расширены зоны вылета на Eau Rouge/Raidillon после аварий" },
      ],
    },
    "Monza": {
      builtYear: 1922,
      renovations: [
        { year: 1955, note: "Построен высокоскоростной банкинг (сейчас не используется)" },
        { year: 1972, note: "Установлены первые шиканы для снижения скоростей" },
      ],
    },
    "Bahrain": {
      builtYear: 2004,
      renovations: [
        { year: 2010, note: "Добавлена внешняя трасса для длинной (Endurance) конфигурации" },
      ],
    },
    "Portimão": {
      builtYear: 2008,
      openedNote: "Дебют в календаре Ф1 состоялся в 2020 году",
      renovations: [],
    },
    "Imola": {
      builtYear: 1953,
      renovations: [
        { year: 1972, note: "Добавлены первые шиканы для снижения скоростей" },
        { year: 1995, note: "Масштабная реконструкция Tamburello и Villeneuve после трагедии 1994 года" },
      ],
    },
    "Interlagos": {
      builtYear: 1940,
      renovations: [
        { year: 1990, note: "Трасса сокращена с 7.8 км до текущей конфигурации" },
      ],
    },
    "COTA": {
      builtYear: 2012,
      renovations: [
        { year: 2019, note: "Полная переукладка асфальтового покрытия" },
      ],
    },
    "Silverstone": {
      builtYear: 1948,
      openedNote: "Бывший военный аэродром, первый Гран-при Великобритании",
      renovations: [
        { year: 1991, note: "Реконфигурированы повороты Becketts и Chapel" },
        { year: 2010, note: "Добавлен новый комплекс Arena и пит-комплекс Wing" },
      ],
    },
    "Barcelona": {
      builtYear: 1991,
      renovations: [
        { year: 2004, note: "Перед финишной прямой добавлена медленная шикана" },
        { year: 2021, note: "Изменена конфигурация последнего сектора" },
      ],
    },
    "Paul Ricard": {
      builtYear: 1970,
      renovations: [
        { year: 1986, note: "На Mistral Straight добавлена шикана после гибели Элио де Анджелиса" },
        { year: 2018, note: "Модернизация зон вылета перед возвращением в календарь Ф1" },
      ],
    },
    "Lusail": {
      builtYear: 2004,
      openedNote: "Изначально построена для мотогонок",
      renovations: [
        { year: 2021, note: "Реконфигурация трассы под требования Формулы 1" },
      ],
    },
    "Fuji Speedway": {
      builtYear: 1966,
      renovations: [
        { year: 2005, note: "Масштабная реконструкция по проекту Германа Тильке" },
      ],
    },
    "Sebring": {
      builtYear: 1950,
      openedNote: "Гонки проходят на бывшей авиабазе времён Второй мировой",
      renovations: [],
    },
  },
  en: {
    "Le Mans": {
      builtYear: 1923,
      openedNote: "First running of the 24 Heures du Mans",
      renovations: [
        { year: 1932, note: "Pontlieue hairpin bypassed, new pit straight built" },
        { year: 1990, note: "Two chicanes added on the Mulsanne Straight for safety" },
        { year: 2002, note: "Porsche Curves and Dunlop chicane reprofiled" },
      ],
    },
    "Spa-Francorchamps": {
      builtYear: 1921,
      renovations: [
        { year: 1979, note: "Circuit shortened from 14 km to 7 km, public-road sections removed" },
        { year: 2022, note: "Runoff areas widened at Eau Rouge/Raidillon after accidents" },
      ],
    },
    "Monza": {
      builtYear: 1922,
      renovations: [
        { year: 1955, note: "High-speed banked oval built (now disused)" },
        { year: 1972, note: "First chicanes installed to reduce speeds" },
      ],
    },
    "Bahrain": {
      builtYear: 2004,
      renovations: [
        { year: 2010, note: "Outer circuit added for the longer Endurance layout" },
      ],
    },
    "Portimão": {
      builtYear: 2008,
      openedNote: "Made its F1 debut in 2020",
      renovations: [],
    },
    "Imola": {
      builtYear: 1953,
      renovations: [
        { year: 1972, note: "First chicanes added to reduce speeds" },
        { year: 1995, note: "Tamburello and Villeneuve rebuilt after the 1994 tragedy" },
      ],
    },
    "Interlagos": {
      builtYear: 1940,
      renovations: [
        { year: 1990, note: "Circuit shortened from 7.8 km to its current configuration" },
      ],
    },
    "COTA": {
      builtYear: 2012,
      renovations: [
        { year: 2019, note: "Full asphalt resurfacing" },
      ],
    },
    "Silverstone": {
      builtYear: 1948,
      openedNote: "A former WWII airfield, host of the first British Grand Prix",
      renovations: [
        { year: 1991, note: "Becketts and Chapel corners reconfigured" },
        { year: 2010, note: "New Arena complex and Wing pit building added" },
      ],
    },
    "Barcelona": {
      builtYear: 1991,
      renovations: [
        { year: 2004, note: "Slow chicane added before the start/finish straight" },
        { year: 2021, note: "Final sector reconfigured" },
      ],
    },
    "Paul Ricard": {
      builtYear: 1970,
      renovations: [
        { year: 1986, note: "Mistral Straight chicane added after Elio de Angelis's fatal testing crash" },
        { year: 2018, note: "Runoff areas modernized ahead of its F1 return" },
      ],
    },
    "Lusail": {
      builtYear: 2004,
      openedNote: "Originally built for motorcycle racing",
      renovations: [
        { year: 2021, note: "Circuit reconfigured to Formula 1 requirements" },
      ],
    },
    "Fuji Speedway": {
      builtYear: 1966,
      renovations: [
        { year: 2005, note: "Extensively rebuilt to a Hermann Tilke design" },
      ],
    },
    "Sebring": {
      builtYear: 1950,
      openedNote: "Racing takes place on a former WWII-era airbase",
      renovations: [],
    },
  },
};

export default function TrackDetail() {
  const { t, locale } = useLanguage();
  const [, params] = useRoute("/tracks/:id");
  const id = params ? Number(params.id) : undefined;
  const { data: track, isLoading: trackLoading } = useTrack(id);
  const { data: laps, isLoading: lapsLoading } = useLaps({ trackId: id });

  const stats = useMemo(() => {
    if (!laps || laps.length === 0) return null;
    const best = laps.reduce((a, b) => (b.lapMs < a.lapMs ? b : a));
    const avg = laps.reduce((s, l) => s + l.lapMs, 0) / laps.length;
    const drivers = new Set(laps.map((l) => l.driverId)).size;
    // Лучший круг каждого пилота
    const bestByDriver = new Map<number, typeof laps[0]>();
    for (const l of laps) {
      const cur = bestByDriver.get(l.driverId);
      if (!cur || l.lapMs < cur.lapMs) bestByDriver.set(l.driverId, l);
    }
    const board = Array.from(bestByDriver.values()).sort((a, b) => a.lapMs - b.lapMs);
    const chart = board.slice(0, 8).map((l) => ({
      name: l.driverName.split(" ")[0],
      seconds: +(l.lapMs / 1000).toFixed(1),
      label: formatLap(l.lapMs),
    }));
    return { best, avg, drivers, board, chart, count: laps.length };
  }, [laps]);

  if (trackLoading || lapsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {t("trackDetail.notFound")}. <Link href="/tracks" className="text-primary">{t("trackDetail.notFoundBack")}</Link>
      </div>
    );
  }

  const fact = TRACK_FACTS[locale][track.name];
  const history = TRACK_HISTORY[locale][track.name];
  const showMap = hasTrackMap(resolveTrackMapName(track));
  const showInfoColumn = Boolean(history || fact);

  return (
    <div className="space-y-5">
      <Link href="/tracks" data-testid="link-back-tracks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> {t("trackDetail.back")}
      </Link>

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-secondary/40 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-bold tracking-tight">{track.name}</h1>
            {history && (
              <Badge variant="outline" className="border-primary/35 bg-primary/10 text-primary">
                {t("trackDetail.sinceBadge", { year: history.builtYear })}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{track.layout}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin size={14} /> {translateCountry(track.country, locale)}</span>
            <span className="flex items-center gap-1"><Ruler size={14} /> {track.lengthKm} {t("trackDetail.km")}</span>
            <span className="flex items-center gap-1"><RotateCw size={14} /> {track.turns} {t("trackDetail.turns")}</span>
          </div>
        </div>

        {(showInfoColumn || showMap) && (
          <div className={showInfoColumn && showMap ? "grid md:grid-cols-[1.05fr_1fr]" : "grid"}>
            {showInfoColumn && (
              <div className={`p-5 ${showMap ? "order-2 border-t border-border md:order-none md:border-t-0 md:border-r" : ""}`}>
                {history && (
                  <>
                    <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <History size={13} /> {t("trackDetail.history")}
                    </div>
                    <ul className="mb-1">
                      <li className="relative border-l-2 border-border py-0 pb-3.5 pl-5 text-sm before:absolute before:-left-[5px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-primary before:content-['']">
                        <span className="font-data font-bold">{history.builtYear}</span>{" "}
                        <span className="text-muted-foreground">{history.openedNote ?? t("trackDetail.trackOpened")}</span>
                      </li>
                      {history.renovations.map((r, i) => (
                        <li key={r.year} className={`relative border-l-2 py-0 pl-5 text-sm ${i === history.renovations.length - 1 ? "border-transparent pb-0" : "border-border pb-3.5"} before:absolute before:-left-[5px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-primary before:content-['']`}>
                          <span className="font-data font-bold">{r.year}</span>{" "}
                          <span className="text-muted-foreground">{r.note}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {fact && (
                  <div className={`flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 ${history ? "mt-5" : ""}`}>
                    <Lightbulb size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-primary">{t("trackDetail.trivia")}</span>
                      <p className="mt-0.5 text-sm text-foreground">{fact}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showMap && (
              <div className="order-1 flex items-center justify-center bg-gradient-to-b from-card to-secondary/20 p-6 md:order-none">
                <TrackMap name={resolveTrackMapName(track)} className="h-56 w-full max-w-xl text-primary" />
              </div>
            )}
          </div>
        )}
      </Card>

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat icon={Timer} label={t("trackDetail.lapRecord")} value={formatLap(stats.best.lapMs)} sub={stats.best.driverName} />
            <Stat icon={Timer} label={t("trackDetail.avgLap")} value={formatLap(Math.round(stats.avg))} />
            <Stat icon={Users} label={t("trackDetail.drivers")} value={String(stats.drivers)} />
            <Stat icon={Timer} label={t("trackDetail.entries")} value={String(stats.count)} />
          </div>

          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">{t("trackDetail.chartTitle")}</h2>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chart} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                    domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }}
                    formatter={(_v: any, _n: any, p: any) => [p.payload.label, t("trackDetail.chartTooltipLap")]} />
                  <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
                    {stats.chart.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-1) / 0.5)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-secondary/40 px-4 py-3">
              <h2 className="font-semibold">{t("trackDetail.ratingTitle")}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">{t("trackDetail.colPos")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("trackDetail.colDriver")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("trackDetail.colClass")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("trackDetail.colLap")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("trackDetail.colDelta")}</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">{t("trackDetail.colSectors")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.board.map((l, i) => (
                  <tr key={l.id} className="border-t border-border hover:bg-muted/40" data-testid={`td-row-${l.id}`}>
                    <td className="px-4 py-2.5 font-data tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/drivers/${l.driverId}`} className="font-medium hover:underline">
                        <DriverName name={l.driverName} isPlayer={l.isPlayer} />
                      </Link>
                      <div className="text-xs text-muted-foreground">{l.team}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={getClassBadgeClass(l.carClass)}>{l.carClass}</Badge>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-data tabular-nums ${i === 0 ? "font-bold text-primary" : ""}`}>
                      {formatLap(l.lapMs)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground">
                      {i === 0 ? "—" : formatDelta(l.lapMs, stats.board[0].lapMs)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right font-data text-xs tabular-nums text-muted-foreground md:table-cell">
                      {formatSector(l.sector1Ms)} / {formatSector(l.sector2Ms)} / {formatSector(l.sector3Ms)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <div className="py-12 text-center text-muted-foreground">{t("trackDetail.noLaps")}</div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon size={13} /> {label}
      </div>
      <div className="mt-2 font-data text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}
