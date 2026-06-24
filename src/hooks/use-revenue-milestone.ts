import { useQuery } from "@tanstack/react-query";
import { fetchAccumulatedRevenue } from "@/services/revenue-milestone";

/**
 * Faturamento acumulado total para o tracker do header.
 *
 * Atualiza a cada 60s para refletir vendas aprovadas que chegam pelos
 * webhooks (PerfectPay etc.). Sempre busca em foreground também ao
 * remontar para que o admin veja o número fresco ao trocar de página.
 */
export function useAccumulatedRevenue() {
  return useQuery({
    queryKey: ["admin", "accumulated-revenue"],
    queryFn: fetchAccumulatedRevenue,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
