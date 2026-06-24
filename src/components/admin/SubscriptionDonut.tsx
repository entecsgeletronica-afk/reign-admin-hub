import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { SubscriptionStatusItem } from "@/services/dashboard";

const COLORS = [
  "oklch(0.82 0.14 80)",
  "oklch(0.7 0.18 35)",
  "oklch(0.65 0.15 200)",
  "oklch(0.7 0.18 320)",
];

export function SubscriptionDonut({ data }: { data: SubscriptionStatusItem[] }) {
  const total = data.reduce((acc, d) => acc + d.total, 0);
  const chartData =
    total === 0 ? [{ status_key: "empty", status_label: "sem dados", total: 1 }] : data;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="total"
              innerRadius={70}
              outerRadius={92}
              paddingAngle={total === 0 ? 0 : 2}
              stroke="none"
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={total === 0 ? "oklch(1 0 0 / 0.08)" : COLORS[i % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-foreground">{total}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Assinaturas
          </div>
        </div>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {data.map((item, i) => (
          <li key={item.status_key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{item.status_label}</span>
            </div>
            <span className="font-semibold text-foreground">{item.total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
