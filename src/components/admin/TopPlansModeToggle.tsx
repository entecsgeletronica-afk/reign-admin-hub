import { cn } from "@/lib/utils";
import type { TopPlansMode } from "@/services/dashboard";

/**
 * Toggle compacto para alternar o modo do card "Planos que mais venderam".
 *  - "sales": ranking pelo número de vendas no período.
 *  - "recurring": ranking pelas assinaturas ativas (recorrência) no período.
 */
const OPTIONS: { key: TopPlansMode; label: string }[] = [
  { key: "sales", label: "Mais vendidos" },
  { key: "recurring", label: "Mais recorrência" },
];

export function TopPlansModeToggle({
  value,
  onChange,
}: {
  value: TopPlansMode;
  onChange: (mode: TopPlansMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Modo do ranking de planos"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-elevated p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
