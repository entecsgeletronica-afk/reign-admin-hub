import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchDashboardKpis,
  fetchDashboardSeries,
  fetchMonthlyRecurring,
  fetchSubscriptionStatus,
  fetchTopPlans,
  type PeriodKey,
  type TopPlansMode,
} from "@/services/dashboard";

/**
 * Cache "por sessão logada" para o Dashboard.
 *
 * Estratégia:
 *  - `staleTime: Infinity` — uma vez carregada, a query nunca é considerada
 *    obsoleta automaticamente. Não há refetch ao trocar de aba, focar a
 *    janela, reconectar ou remontar o componente.
 *  - `gcTime: Infinity` — o cache nunca é coletado durante a sessão. Voltar
 *    a uma rota já visitada renderiza com dados instantaneamente.
 *  - `refetchOn{WindowFocus,Reconnect,Mount}: false` — explicitamente
 *    desligados como segurança (mesmo com `staleTime: Infinity`, futuros
 *    overrides não disparariam refetch indesejado).
 *  - `placeholderData: keepPreviousData` — ao trocar o período/filtro,
 *    o dashboard mantém os dados anteriores visíveis até a nova query
 *    chegar (evita piscadas).
 *
 * Invalidação: somente quando uma mutação relevante ocorre, usando
 * `queryClient.invalidateQueries({ queryKey: ["dashboard"] })`. No logout,
 * `queryClient.clear()` no AuthProvider garante isolamento entre sessões.
 */
const SESSION_CACHE = {
  placeholderData: keepPreviousData,
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

export function useDashboardKpis(period: PeriodKey) {
  return useQuery({
    queryKey: ["dashboard", "kpis", period],
    queryFn: () => fetchDashboardKpis(period),
    ...SESSION_CACHE,
  });
}

export function useDashboardSeries(period: PeriodKey) {
  return useQuery({
    queryKey: ["dashboard", "series", period],
    queryFn: () => fetchDashboardSeries(period),
    ...SESSION_CACHE,
  });
}

export function useSubscriptionStatus(period: PeriodKey) {
  return useQuery({
    queryKey: ["dashboard", "subscription-status", period],
    queryFn: () => fetchSubscriptionStatus(period),
    ...SESSION_CACHE,
  });
}

export function useTopPlans(period: PeriodKey, mode: TopPlansMode = "sales") {
  return useQuery({
    queryKey: ["dashboard", "top-plans", period, mode],
    queryFn: () => fetchTopPlans(period, mode),
    ...SESSION_CACHE,
  });
}

export function useMonthlyRecurring() {
  return useQuery({
    queryKey: ["dashboard", "monthly-recurring"],
    queryFn: () => fetchMonthlyRecurring(),
    ...SESSION_CACHE,
  });
}
