import * as React from "react";
import { Trophy } from "lucide-react";
import { useAccumulatedRevenue } from "@/hooks/use-revenue-milestone";
import {
  computeMilestoneProgress,
  MILESTONES,
} from "@/services/revenue-milestone";
import { formatBRLCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Tracker de faturamento acumulado exibido no header do admin.
 *
 * - Ícone de troféu indica o "rank" atual (cor muda conforme o marco).
 * - Barra de progresso mostra o quanto falta para o próximo marco.
 * - Tooltip exibe a lista completa de marcos e o valor exato.
 *
 * Os dados vêm de `sales` (status approved/paid/completed) e são
 * atualizados a cada 60s — capturando vendas que entram via webhooks
 * cadastrados (pagamento único ou recorrência).
 */
export function RevenueMilestoneTracker() {
  const { data: revenue = 0, isLoading } = useAccumulatedRevenue();
  const progress = React.useMemo(
    () => computeMilestoneProgress(revenue),
    [revenue],
  );

  const trophyColor = trophyColorFor(progress.reachedIndex);
  const isMaxedOut = progress.reachedIndex >= MILESTONES.length - 1;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="group flex h-9 items-center gap-3 rounded-full border border-border/60 bg-card/40 px-3 text-left transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Faturamento acumulado"
          >
            <Trophy
              className={cn("h-4 w-4 shrink-0 transition-colors", trophyColor)}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2 text-[11px] font-medium leading-none">
                <span className="text-foreground">
                  {isLoading ? "—" : formatBRLCompact(revenue)}
                </span>
                {!isMaxedOut && (
                  <span className="text-muted-foreground/70">
                    / {formatBRLCompact(progress.next.value)}
                  </span>
                )}
                {isMaxedOut && (
                  <span className="text-muted-foreground/70">máximo</span>
                )}
              </div>
              <div
                className="h-1.5 w-32 overflow-hidden rounded-full bg-border/50"
                role="progressbar"
                aria-valuenow={Math.round(progress.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progressBarFor(progress.reachedIndex),
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="w-64 border border-border bg-card p-3 text-card-foreground shadow-lg"
        >
          <div className="mb-2 flex items-center gap-2">
            <Trophy className={cn("h-4 w-4", trophyColor)} />
            <span className="text-xs font-semibold">
              Faturamento acumulado
            </span>
          </div>
          <div className="mb-3 text-sm font-semibold">
            {formatBRLCompact(revenue)}
          </div>
          <ul className="space-y-1.5">
            {MILESTONES.slice(1).map((m, i) => {
              const reached = revenue >= m.value;
              return (
                <li
                  key={m.value}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      reached
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Trophy
                      className={cn(
                        "h-3 w-3",
                        reached ? trophyColorFor(i + 1) : "text-muted-foreground/40",
                      )}
                    />
                    {m.label}
                  </span>
                  {reached && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-500">
                      conquistado
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-border/50 pt-2 text-[10px] leading-relaxed text-muted-foreground">
            Soma de todas as vendas aprovadas (pagamento único + recorrências)
            recebidas pelos webhooks cadastrados.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function trophyColorFor(reachedIndex: number): string {
  // 0 = bronze fraco, sobe para prata, ouro, platina, diamante.
  switch (reachedIndex) {
    case 0:
      return "text-muted-foreground/60";
    case 1:
      return "text-amber-600"; // bronze
    case 2:
      return "text-slate-300"; // prata
    case 3:
      return "text-yellow-400"; // ouro
    case 4:
    default:
      return "text-cyan-300"; // diamante
  }
}

function progressBarFor(reachedIndex: number): string {
  switch (reachedIndex) {
    case 0:
      return "bg-muted-foreground/40";
    case 1:
      return "bg-amber-600";
    case 2:
      return "bg-slate-300";
    case 3:
      return "bg-yellow-400";
    case 4:
    default:
      return "bg-cyan-300";
  }
}
