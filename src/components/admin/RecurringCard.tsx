import type { MonthlyRecurringItem } from "@/services/dashboard";
import { formatBRLCompact } from "@/lib/format";

export function RecurringCard({ data }: { data: MonthlyRecurringItem[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
        Nenhuma assinatura recorrente ativa.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex h-[240px] flex-col justify-end gap-2">
      <div className="flex h-full items-end gap-3">
        {data.map((m) => {
          const h = Math.max(4, Math.round((m.amount / max) * 100));
          return (
            <div key={m.month_key} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-gold/70"
                style={{ height: `${h}%` }}
                title={formatBRLCompact(m.amount)}
              />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.month_label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
