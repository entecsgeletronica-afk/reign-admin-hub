import { supabase, supabaseAny } from "@/integrations/supabase/client";

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "month" | "custom";

export interface DashboardKpis {
  revenue_amount: number;
  sales_count: number;
  mrr_amount: number;
  active_subscriptions: number;
  avg_ticket: number;
  top_plan_name: string | null;
  users_count: number;
}

export interface SeriesPoint {
  label: string;
  revenue_amount: number;
  sales_count: number;
}

export interface SubscriptionStatusItem {
  status_key: string;
  status_label: string;
  total: number;
}

export interface TopPlanItem {
  plan_name: string;
  total_sales: number;
  revenue_amount: number;
}

export interface MonthlyRecurringItem {
  month_key: string;
  month_label: string;
  amount: number;
}

const ZERO_KPIS: DashboardKpis = {
  revenue_amount: 0,
  sales_count: 0,
  mrr_amount: 0,
  active_subscriptions: 0,
  avg_ticket: 0,
  top_plan_name: null,
  users_count: 1,
};

export async function fetchDashboardKpis(period: PeriodKey): Promise<DashboardKpis> {
  if (!supabase) return ZERO_KPIS;
  const { data, error } = await supabaseAny
    .from("dashboard_kpis")
    .select(
      "revenue_amount, sales_count, mrr_amount, active_subscriptions, avg_ticket, top_plan_name",
    )
    .eq("period_key", period)
    .maybeSingle();
  if (error || !data) return ZERO_KPIS;
  return { ...ZERO_KPIS, ...data };
}

export async function fetchDashboardSeries(period: PeriodKey): Promise<SeriesPoint[]> {
  if (!supabase) return buildEmptySeries(period);
  const { data, error } = await supabaseAny
    .from("dashboard_series")
    .select("label, revenue_amount, sales_count, sort_order")
    .eq("period_key", period)
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) return buildEmptySeries(period);
  return data.map((d: any) => ({
    label: d.label,
    revenue_amount: Number(d.revenue_amount) || 0,
    sales_count: Number(d.sales_count) || 0,
  }));
}

export async function fetchSubscriptionStatus(
  period: PeriodKey,
): Promise<SubscriptionStatusItem[]> {
  if (!supabase) return [{ status_key: "none", status_label: "sem dados", total: 0 }];
  const { data, error } = await supabaseAny
    .from("subscription_status_summary")
    .select("status_key, status_label, total, sort_order")
    .eq("period_key", period)
    .order("sort_order", { ascending: true });
  if (error || !data || data.length === 0) {
    return [{ status_key: "none", status_label: "sem dados", total: 0 }];
  }
  return data.map((d: any) => ({
    status_key: d.status_key,
    status_label: d.status_label,
    total: Number(d.total) || 0,
  }));
}

export type TopPlansMode = "sales" | "recurring";

export async function fetchTopPlans(
  period: PeriodKey,
  mode: TopPlansMode = "sales",
): Promise<TopPlanItem[]> {
  if (!supabase) return [];
  // Modo "recurring": ranqueia planos pelo número de assinaturas ativas
  // (recorrência viva) no período. A view `top_plans_recurring_summary` é
  // opcional — se não existir, retornamos vazio sem quebrar a UI.
  const view = mode === "recurring" ? "top_plans_recurring_summary" : "top_plans_summary";
  const { data, error } = await supabaseAny
    .from(view)
    .select("plan_name, total_sales, revenue_amount, sort_order")
    .eq("period_key", period)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((d: any) => ({
    plan_name: d.plan_name,
    total_sales: Number(d.total_sales) || 0,
    revenue_amount: Number(d.revenue_amount) || 0,
  }));
}

export async function fetchMonthlyRecurring(): Promise<MonthlyRecurringItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("monthly_recurring_summary")
    .select("month_key, month_label, amount, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((d: any) => ({
    month_key: d.month_key,
    month_label: d.month_label,
    amount: Number(d.amount) || 0,
  }));
}

function buildEmptySeries(period: PeriodKey): SeriesPoint[] {
  const days =
    period === "today" ? 1 : period === "7d" ? 7 : period === "90d" ? 90 : period === "month" ? 30 : 30;
  const now = new Date();
  const points: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    points.push({ label, revenue_amount: 0, sales_count: 0 });
  }
  return points;
}
