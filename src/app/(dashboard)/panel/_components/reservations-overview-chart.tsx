/**
 * ReservationsOverviewChart
 *
 * Bar chart showing daily reservation + visitor counts for the last 30 days.
 * Follows the exact shadcn-admin Overview chart pattern (recharts BarChart).
 * Client component — receives serialized data from Server Component.
 */

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCount } from "@/lib/queries/stats";
import { useMounted } from "@/hooks";

interface ReservationsOverviewChartProps {
  data: DailyCount[];
}

// Show every Nth label to avoid crowding (30 days → show ~8 labels)
function tickFormatter(value: string, index: number, total: number): string {
  const step = Math.max(1, Math.floor(total / 8));
  return index % step === 0 ? value : "";
}

export function ReservationsOverviewChart({
  data,
}: ReservationsOverviewChartProps) {
  const mounted = useMounted();

  const total = data.length;

  if (!mounted) return <div className="h-[350px]" />;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
      >
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
          tickFormatter={(v, i) => tickFormatter(v, i, total)}
        />
        <YAxis
          stroke="#888888"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / .5)" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          itemStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
          formatter={(value) =>
            value === "reservations" ? "Reservas" : "Visitantes"
          }
        />
        <Bar
          dataKey="reservations"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
          maxBarSize={20}
        />
        <Bar
          dataKey="visitors"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-muted-foreground"
          maxBarSize={20}
          opacity={0.6}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
