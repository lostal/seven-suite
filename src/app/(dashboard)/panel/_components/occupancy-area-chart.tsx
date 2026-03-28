/**
 * OccupancyAreaChart
 *
 * Area chart showing daily reservation trends for the last 30 days.
 * Follows the exact shadcn-admin analytics-chart.tsx pattern.
 * Client component.
 */

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCount } from "@/lib/queries/stats";
import { useMounted } from "@/hooks/use-mounted";

interface OccupancyAreaChartProps {
  data: DailyCount[];
}

export function OccupancyAreaChart({ data }: OccupancyAreaChartProps) {
  const mounted = useMounted();

  const total = data.length;

  function labelTick(value: string, index: number): string {
    const step = Math.max(1, Math.floor(total / 7));
    return index % step === 0 ? value : "";
  }

  if (!mounted) return <div className="h-75" />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
      >
        <defs>
          <linearGradient id="fillReservations" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--primary))"
              stopOpacity={0}
            />
          </linearGradient>
          <linearGradient id="fillVisitors" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity={0.2}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--muted-foreground))"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          className="stroke-muted"
        />
        <XAxis
          dataKey="label"
          stroke="#888888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v, i) => labelTick(v, i)}
        />
        <YAxis
          stroke="#888888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          itemStyle={{ color: "hsl(var(--muted-foreground))" }}
          formatter={(value, name) => [
            value,
            name === "reservations" ? "Reservas" : "Visitantes",
          ]}
        />
        <Area
          type="monotone"
          dataKey="reservations"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#fillReservations)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="visitors"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          fill="url(#fillVisitors)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
