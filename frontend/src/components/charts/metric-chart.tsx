"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartSpec } from "@/lib/types";
import { colorForIndex, cn } from "@/lib/utils";

interface MetricChartProps {
  spec: ChartSpec;
  height?: number;
  className?: string;
  /** "index" renders each series on its own scale (good for mixed units). */
  yScale?: "index" | "value";
}

type TooltipPayload = {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string | number;
};

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | string[];
  unit?: string | null;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line-strong bg-surface-900 px-3 py-2">
      <p className="label-caps mb-1.5">
        {Array.isArray(label) ? label.join(" · ") : label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="text-ink-300">{entry.name}</span>
            <span className="num ml-auto font-medium text-ink-100">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
                : (entry.value ?? "—")}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders a backend ChartSpec. Supports line / area / bar and falls back to
 * line for anything unknown so a bad spec never crashes the page.
 */
export function MetricChart({ spec, height = 300, className, yScale = "value" }: MetricChartProps) {
  const data = useMemo(() => {
    if (!spec.series.length) return [];
    const rows = new Map<string | number, Record<string, number | string | null>>();
    for (const series of spec.series) {
      for (const point of series.data) {
        const key = point.x;
        const row = rows.get(key) ?? { [spec.x_key]: key };
        row[series.key] = point.y;
        rows.set(key, row);
      }
    }
    return [...rows.values()].sort((a, b) =>
      String(a[spec.x_key]).localeCompare(String(b[spec.x_key]), undefined, { numeric: true }),
    );
  }, [spec]);

  if (!spec.series.length || data.length === 0) {
    return (
      <div
        className={cn(
          "grid place-items-center border border-dashed border-line font-mono text-[10px] uppercase tracking-wider text-ink-400",
          className,
        )}
        style={{ height }}
      >
        No chart data available
      </div>
    );
  }

  const isBar = spec.chart_type === "bar";
  const isArea = spec.chart_type === "area";
  const shared = yScale === "value";

  const axisProps = {
    stroke: "#b3aa98",
    tick: { fill: "#5d5e51", fontSize: 10 },
    tickLine: false,
    axisLine: { stroke: "#d2ccbe" },
  } as const;

  const grid = <CartesianGrid stroke="#d2ccbe" strokeDasharray="2 4" vertical={false} />;
  const tooltip = <ChartTooltip unit={spec.unit} />;
  const legend =
    spec.series.length > 1 ? (
      <Legend
        wrapperStyle={{ fontSize: 10, color: "#5d5e51", paddingTop: 10 }}
        iconType="rect"
        iconSize={7}
      />
    ) : null;

  const body = (() => {
    if (isBar) {
      return (
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {grid}
          <XAxis dataKey={spec.x_key} {...axisProps} />
          <YAxis
            {...axisProps}
            width={52}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
            }
          />
          {tooltip}
          {legend}
          {spec.series.map((series, index) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              fill={colorForIndex(index)}
              radius={[0, 0, 0, 0]}
              maxBarSize={34}
            />
          ))}
        </BarChart>
      );
    }

    const Curve = isArea ? Area : Line;
    const Chart = isArea ? AreaChart : LineChart;
    return (
      <Chart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        {grid}
        <XAxis dataKey={spec.x_key} {...axisProps} />
        <YAxis
          {...axisProps}
          width={52}
          tickFormatter={(v: number) =>
            Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        {tooltip}
        {legend}
        {spec.series.map((series, index) => {
          const color = colorForIndex(index);
          const sharedProps = {
            dataKey: series.key,
            name: series.label,
            stroke: color,
            strokeWidth: 2,
            dot: false,
            activeDot: { r: 3, strokeWidth: 0 },
          };
          return isArea ? (
            <Curve
              key={series.key}
              {...sharedProps}
              fill={color}
              fillOpacity={0.1}
              stackId={shared ? undefined : "stack"}
            />
          ) : (
            <Curve key={series.key} {...sharedProps} />
          );
        })}
      </Chart>
    );
  })();

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {body}
      </ResponsiveContainer>
    </div>
  );
}
