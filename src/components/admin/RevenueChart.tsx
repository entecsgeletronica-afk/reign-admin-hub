import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/services/dashboard";
import { formatBRLCompact, formatBRL } from "@/lib/format";

export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.82 0.14 80)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="oklch(0.82 0.14 80)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "oklch(0.7 0.025 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "oklch(0.7 0.025 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatBRLCompact(Number(v))}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: "oklch(0.82 0.14 80)", strokeOpacity: 0.4 }}
            contentStyle={{
              background: "oklch(0.21 0.025 260)",
              border: "1px solid oklch(1 0 0 / 0.08)",
              borderRadius: 12,
              color: "oklch(0.98 0.005 260)",
              fontSize: 12,
            }}
            formatter={(value: number) => [formatBRL(Number(value)), "Receita"]}
            labelStyle={{ color: "oklch(0.7 0.025 260)" }}
          />
          <Area
            type="monotone"
            dataKey="revenue_amount"
            stroke="oklch(0.82 0.14 80)"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
