import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ZoomIn, ZoomOut } from "lucide-react";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface TelemetryChartProps {
  points: TelemetryLapPoint[];
  onHoverIndexChange: (index: number | null) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ONE_SECOND_TICKS_ZOOM = 10;

type SeriesKey = "throttle" | "brake" | "speed";

/** Секунды с сотыми, например 12.34. */
function formatLapTime(sec: number): string {
  return sec.toFixed(2);
}

export function TelemetryChart({ points, onHoverIndexChange }: TelemetryChartProps) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    throttle: true,
    brake: true,
    speed: true,
  });

  // Новый круг открывается в обзорном масштабе.
  useEffect(() => {
    setZoom(MIN_ZOOM);
  }, [points]);

  const seriesThrottle = t("telemetryPage.seriesThrottle");
  const seriesBrake = t("telemetryPage.seriesBrake");
  const seriesSpeed = t("telemetryPage.seriesSpeed");

  const legendItems: { key: SeriesKey; label: string; color: string }[] = [
    { key: "throttle", label: seriesThrottle, color: "#16a34a" },
    { key: "brake", label: seriesBrake, color: "#dc2626" },
    { key: "speed", label: seriesSpeed, color: "#2563eb" },
  ];

  // Время круга (с) с начала выбранного круга — первая точка принимается за 0.
  const data = useMemo(() => {
    const t0 = points[0]?.t ?? 0;
    return points.map((p, i) => ({
      idx: i,
      lapTimeSec: (p.t ?? t0) - t0,
      [seriesThrottle]: p.throttle,
      [seriesBrake]: p.brake,
      [seriesSpeed]: p.speedKph,
    }));
  }, [points, seriesThrottle, seriesBrake, seriesSpeed]);

  const lapDurationSec = data.length > 0 ? data[data.length - 1].lapTimeSec : 0;

  // С масштаба ONE_SECOND_TICKS_ZOOM и выше деления ставятся ровно каждую
  // секунду; на меньших масштабах recharts сам подбирает "круглые" интервалы
  // под примерное количество делений (растёт вместе с zoom).
  const xAxisTicksProp = useMemo(() => {
    if (zoom < ONE_SECOND_TICKS_ZOOM) return undefined;
    const count = Math.floor(lapDurationSec) + 1;
    return Array.from({ length: count }, (_, i) => i);
  }, [zoom, lapDurationSec]);

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("telemetryPage.noChartData")}</p>
    );
  }

  return (
    <div className="p-4">
      <div className="relative">
        {/* Кнопки масштаба — растягивают график по горизонтали (по времени круга).
            Сам блок графика остаётся в границах карточки, прокрутка — через
            появляющийся снизу скроллбар (overflow-x контейнера). */}
        <div className="absolute right-1 top-1 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate disabled:opacity-40"
            aria-label={t("telemetryPage.zoomIn")}
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 text-muted-foreground hover-elevate disabled:opacity-40"
            aria-label={t("telemetryPage.zoomOut")}
          >
            <ZoomOut size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <div style={{ width: `${zoom * 100}%` }}>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart
                data={data}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                onMouseMove={(state: { activeTooltipIndex?: number }) => {
                  if (state?.activeTooltipIndex != null) onHoverIndexChange(state.activeTooltipIndex);
                }}
                onMouseLeave={() => onHoverIndexChange(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="lapTimeSec"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  {...(xAxisTicksProp
                    ? { ticks: xAxisTicksProp }
                    : { tickCount: Math.min(40, 8 * zoom) })}
                  tickFormatter={formatLapTime}
                  tick={{ fontSize: 11 }}
                  label={{ value: t("telemetryPage.axisLapTime"), position: "insideBottomRight", offset: -4, fontSize: 11 }}
                />
                <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11 }} width={36} />
                <YAxis yAxisId="speed" orientation="right" domain={[0, "dataMax"]} tick={{ fontSize: 11 }} width={44} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === seriesSpeed ? `${Math.round(value)} km/h` : `${Math.round(value)}%`,
                    name,
                  ]}
                  labelFormatter={(label: number) => `${formatLapTime(label)} s`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey={seriesThrottle}
                  stroke="#16a34a"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                  isAnimationActive={false}
                  hide={!visible.throttle}
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey={seriesBrake}
                  stroke="#dc2626"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                  isAnimationActive={false}
                  hide={!visible.brake}
                />
                <Line
                  yAxisId="speed"
                  type="monotone"
                  dataKey={seriesSpeed}
                  stroke="#2563eb"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls
                  isAnimationActive={false}
                  hide={!visible.speed}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Легенда с чекбоксами — вне области графика, управляет видимостью линий. */}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {legendItems.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground"
          >
            <input
              type="checkbox"
              checked={visible[item.key]}
              onChange={(e) => setVisible((v) => ({ ...v, [item.key]: e.target.checked }))}
              className="h-3.5 w-3.5 rounded border-border"
              style={{ accentColor: item.color }}
            />
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className={visible[item.key] ? "text-card-foreground" : ""}>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
