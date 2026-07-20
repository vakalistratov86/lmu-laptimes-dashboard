import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
} from "recharts";
import type { TelemetryLapPoint } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface TelemetryChartProps {
  points: TelemetryLapPoint[];
  onHoverIndexChange: (index: number | null) => void;
}

export function TelemetryChart({ points, onHoverIndexChange }: TelemetryChartProps) {
  const { t } = useLanguage();

  const seriesThrottle = t("telemetryPage.seriesThrottle");
  const seriesBrake = t("telemetryPage.seriesBrake");
  const seriesSpeed = t("telemetryPage.seriesSpeed");

  // Мемоизация обязательна: Brush (масштабирование) хранит выбранный диапазон
  // по ссылке на массив data — пересоздание data на каждый ре-рендер (например
  // при каждом движении мыши, поднимающем hoverIndex в родителя) сбрасывало бы зум.
  const data = useMemo(
    () =>
      points.map((p, i) => ({
        idx: i,
        lapDist: p.lapDist ?? 0,
        [seriesThrottle]: p.throttle,
        [seriesBrake]: p.brake,
        [seriesSpeed]: p.speedKph,
      })),
    [points, seriesThrottle, seriesBrake, seriesSpeed]
  );

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("telemetryPage.noChartData")}</p>
    );
  }

  return (
    <div className="p-4">
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
            dataKey="lapDist"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => `${Math.round(v)}`}
            tick={{ fontSize: 11 }}
            label={{ value: t("telemetryPage.axisDistance"), position: "insideBottomRight", offset: -4, fontSize: 11 }}
          />
          <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fontSize: 11 }} width={36} />
          <YAxis yAxisId="speed" orientation="right" domain={[0, "dataMax"]} tick={{ fontSize: 11 }} width={44} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === seriesSpeed ? `${Math.round(value)} km/h` : `${Math.round(value)}%`,
              name,
            ]}
            labelFormatter={(label: number) => `${Math.round(label)} m`}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey={seriesThrottle}
            stroke="#16a34a"
            dot={false}
            strokeWidth={1.5}
            connectNulls
            isAnimationActive={false}
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
          />
          <Brush
            dataKey="lapDist"
            height={26}
            travellerWidth={8}
            tickFormatter={(v: number) => `${Math.round(v)}`}
            stroke="var(--color-primary, #ef4444)"
            fill="var(--color-card, transparent)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
