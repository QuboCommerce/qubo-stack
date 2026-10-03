"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SalesChart({ data, currency }: { data: { day: string; sales: number; orders: number }[]; currency: string }) {
  const empty = data.every((d) => d.sales === 0);
  const fmt = new Intl.NumberFormat("en-BE", { style: "currency", currency, notation: "compact" });
  return (
    <div className="relative h-56 w-full @min-[40rem]:h-64 @min-[100rem]:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            domain={empty ? [0, 1000] : [0, "auto"]}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={(v: number) => fmt.format(v)}
          />
          {!empty && (
            <Tooltip
              cursor={{ stroke: "var(--color-border)" }}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-popover)", fontSize: 12 }}
              formatter={(v) => [fmt.format(Number(v)), "Sales"]}
              labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            />
          )}
          <Area type="monotone" dataKey="sales" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#sales-fill)" />
        </AreaChart>
      </ResponsiveContainer>
      {empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-full border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            No sales in this period yet
          </div>
        </div>
      )}
    </div>
  );
}
