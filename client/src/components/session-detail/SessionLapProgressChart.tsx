/**
 * SD-14: График прогрессии времён кругов.
 * Использует Recharts (LineChart) — уже есть в зависимостях проекта.
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { LapProgressSeries } from "./types";
import { useLanguage } from "@/lib/i18n";

/** Палитра цветов для серий (до 10 пилотов). */
const SERIES_COLORS = [
  "var(--color-chart-1, #2563eb)",
  "var(--color-chart-2, #16a34a)",
  "var(--color-chart-3, #dc2626)",
  "var(--color-chart-4, #d97706)",
  "var(--color-chart-5, #7c3aed)",
  "#0891b2",
  "#be185d",
  "#059669",
  "#b45309",
  "#4f46e5",
];

/** Форматировщик оси Y: секунды → «M:SS». */
function fmtYAxis(sec: number): string {
  if (!Number.isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

interface SessionLapProgressChartProps {
  series: LapProgressSeries[];
}

export function SessionLapProgressChart({ series }: SessionLapProgressChartProps) {
  const { t } = useLanguage();
  if (series.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("sessionDetail.noChartData")}</p>;
  }

  // Объединяем точки всех пилотов по номеру круга в один массив объектов для Recharts
  const lapSet = new Set<number>();
  for (const s of series) {
    for (const p of s.points) lapSet.add(p.lap);
  }
  const sortedLaps = Array.from(lapSet).sort((a, b) => a - b);

  const data = sortedLaps.map((lap) => {
    const row: Record<string, number | undefined> = { lap };
    for (const s of series) {
      const pt = s.points.find((p) => p.lap === lap);
      row[s.driverName] = pt?.timeSeconds;
    }
    return row;
  });

  return (
    <div className="p-4">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" strokeOpacity={0.5} />
          <XAxis
            dataKey="lap"
            tick={{ fontSize: 11 }}
            label={{ value: t("sessionDetail.colLap"), position: "insideBottomRight", offset: -4, fontSize: 11 }}
          />
          <YAxis tickFormatter={fmtYAxis} tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={(value: number, name: string) => [
              series.find((s) => s.driverName === name)?.points.find((p) => p.timeSeconds === value)?.timeFormatted ??
                fmtYAxis(value),
              name,
            ]}
            labelFormatter={(label) => t("sessionDetail.lapLabel", { n: label })}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s, idx) => (
            <Line
              key={s.driverName}
              type="monotone"
              dataKey={s.driverName}
              stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
