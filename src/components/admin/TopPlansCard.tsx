import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopPlanItem } from "@/services/dashboard";
import { formatBRL } from "@/lib/format";

export type TopPlansMode = "sales" | "recurring";

interface TopPlansCardProps {
  data: TopPlanItem[];
  mode?: TopPlansMode;
}

export function TopPlansCard({ data, mode = "sales" }: TopPlansCardProps) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        {mode === "recurring"
          ? "Nenhuma assinatura ativa no período."
          : "Nenhuma venda registrada no período."}
      </div>
    );
  }
  // Em modo "recurring", o eixo representa o número de assinaturas ativas.
  // Em "sales", representa o número de vendas no período. O dataKey é o
  // mesmo (`total_sales`) porque a view de recorrência preenche essa coluna
  // com a contagem de assinaturas ativas — mantendo o componente agnóstico.
  const tooltipLabel = mode === "recurring" ? "Assinaturas ativas" : "Vendas";
  const barColor = mode === "recurring" ? "oklch(0.78 0.13 200)" : "oklch(0.82 0.14 80)";
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: "oklch(0.7 0.025 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="plan_name"
            tick={{ fill: "oklch(0.7 0.025 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
            contentStyle={{
              background: "oklch(0.21 0.025 260)",
              border: "1px solid oklch(1 0 0 / 0.08)",
              borderRadius: 12,
              color: "oklch(0.98 0.005 260)",
              fontSize: 12,
            }}
            formatter={(value: number, _n, p) => {
              if (p?.dataKey === "revenue_amount") return [formatBRL(Number(value)), "Receita"];
              return [value, tooltipLabel];
            }}
          />
          <Bar dataKey="total_sales" fill={barColor} radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
