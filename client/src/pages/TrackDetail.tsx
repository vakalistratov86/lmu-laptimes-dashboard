import { useRoute, Link } from "wouter";
import { useTrack, useLaps } from "@/lib/api";
import { formatLap, formatSector, formatDelta } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MapPin, Ruler, RotateCw, Timer, Users, Lightbulb } from "lucide-react";
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

  return (
    <div className="space-y-5">
      <Link href="/tracks" data-testid="link-back-tracks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> {t("trackDetail.back")}
      </Link>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{track.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin size={14} /> {translateCountry(track.country, locale)}</span>
            <span className="flex items-center gap-1"><Ruler size={14} /> {track.lengthKm} {t("trackDetail.km")}</span>
            <span className="flex items-center gap-1"><RotateCw size={14} /> {track.turns} {t("trackDetail.turns")}</span>
            <Badge variant="outline">{track.layout}</Badge>
          </div>
        </div>
      </div>

      {fact && (
        <Card className="flex items-start gap-3 px-4 py-3 bg-primary/5 border-primary/20">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">{t("trackDetail.trivia")}</span>
            <p className="mt-0.5 text-sm text-foreground">{fact}</p>
          </div>
        </Card>
      )}

      {hasTrackMap(resolveTrackMapName(track)) && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-3">
            <h2 className="font-semibold">{t("trackDetail.schemeTitle")}</h2>
            <span className="text-xs text-muted-foreground">{track.lengthKm} {t("trackDetail.km")} · {track.turns} {t("trackDetail.turns")}</span>
          </div>
          <div className="flex items-center justify-center bg-gradient-to-b from-card to-secondary/20 p-6">
            <TrackMap name={resolveTrackMapName(track)} className="h-56 w-full max-w-xl text-primary" />
          </div>
        </Card>
      )}

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
                      <div className="font-medium">
                        <DriverName name={l.driverName} isPlayer={l.isPlayer} />
                      </div>
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
