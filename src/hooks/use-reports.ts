import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminEntitlements,
  fetchPlansRanking,
  fetchRecentSales,
  fetchReportSummary,
} from "@/services/reports";
import type { PeriodKey } from "@/services/dashboard";

export function useAdminEntitlements(limit = 100) {
  return useQuery({
    queryKey: ["admin", "entitlements", limit],
    queryFn: () => fetchAdminEntitlements(limit),
  });
}

export function useReportSummary(period: PeriodKey) {
  return useQuery({
    queryKey: ["admin", "report-summary", period],
    queryFn: () => fetchReportSummary(period),
  });
}

export function usePlansRanking(period: PeriodKey) {
  return useQuery({
    queryKey: ["admin", "plans-ranking", period],
    queryFn: () => fetchPlansRanking(period),
  });
}

export function useRecentSales(period: PeriodKey) {
  return useQuery({
    queryKey: ["admin", "recent-sales", period],
    queryFn: () => fetchRecentSales(period),
  });
}
