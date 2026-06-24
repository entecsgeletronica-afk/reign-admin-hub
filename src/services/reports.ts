// Admin reports service.
// Aggregates real data from `sales`, `subscriptions`, `plans`, `profiles`,
// `user_product_entitlements` — no synthetic views required.
//
// All numbers are derived per-period in the browser to keep the service simple
// and avoid extra SQL views.  The data volumes are small (admin dashboards),
// so client-side aggregation is fine.

import { supabase, supabaseAny } from "@/integrations/supabase/client";
import type { PeriodKey } from "@/services/dashboard";

export interface ReportSummary {
  top_plan_name: string | null;
  revenue_last_7d: number;
  sales_today_amount: number;
  sales_today_count: number;
  canceled_subscriptions: number;
  users_count: number;
  active_plans: number;
}

export interface PlanRanking {
  plan_name: string;
  total_sales: number;
  revenue_amount: number;
}

export interface RecentSale {
  id: string;
  customer_name: string | null;
  plan_name: string | null;
  amount: number;
  sold_at: string;
}

const ZERO_SUMMARY: ReportSummary = {
  top_plan_name: null,
  revenue_last_7d: 0,
  sales_today_amount: 0,
  sales_today_count: 0,
  canceled_subscriptions: 0,
  users_count: 0,
  active_plans: 0,
};

// ---------- helpers ----------

function periodStart(period: PeriodKey): Date {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d;
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "90d":
      d.setDate(d.getDate() - 90);
      return d;
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "custom":
    default:
      d.setDate(d.getDate() - 30);
      return d;
  }
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sevenDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

interface PaidSale {
  id: string;
  amount_cents: number;
  sold_at: string;
  plan_id: string | null;
  customer_email: string | null;
  user_id: string | null;
  status: string;
}

const PAID_STATUSES = ["paid", "approved", "completed"];

async function fetchPaidSalesSince(since: Date): Promise<PaidSale[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("sales")
    .select("id, amount_cents, sold_at, plan_id, customer_email, user_id, status")
    .in("status", PAID_STATUSES)
    .gte("sold_at", since.toISOString())
    .order("sold_at", { ascending: false })
    .limit(1000);
  if (error || !data) return [];
  return data as PaidSale[];
}

async function fetchPlansMap(): Promise<Map<string, string>> {
  if (!supabase) return new Map();
  const { data } = await supabaseAny.from("plans").select("id, name");
  const map = new Map<string, string>();
  ((data ?? []) as { id: string; name: string }[]).forEach((p) =>
    map.set(p.id, p.name),
  );
  return map;
}

async function fetchProfilesMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || userIds.length === 0) return map;
  const { data } = await supabaseAny
    .from("profiles")
    .select("user_id, display_name, purchase_email")
    .in("user_id", userIds);
  ((data ?? []) as {
    user_id: string;
    display_name: string | null;
    purchase_email: string | null;
  }[]).forEach((p) =>
    map.set(p.user_id, p.display_name || p.purchase_email || ""),
  );
  return map;
}

// ---------- public API ----------

export async function fetchReportSummary(period: PeriodKey): Promise<ReportSummary> {
  if (!supabase) return ZERO_SUMMARY;

  const since = periodStart(period);
  const [paidSales, recent7, todaySales, plansMap, canceledSubs, usersCount, activePlans] =
    await Promise.all([
      fetchPaidSalesSince(since),
      fetchPaidSalesSince(sevenDaysAgo()),
      fetchPaidSalesSince(todayStart()),
      fetchPlansMap(),
      countCanceledSubscriptions(since),
      countProfiles(),
      countActivePlans(),
    ]);

  // Top plan in the selected period
  const planRevenue = new Map<string, number>();
  for (const s of paidSales) {
    if (!s.plan_id) continue;
    planRevenue.set(s.plan_id, (planRevenue.get(s.plan_id) ?? 0) + s.amount_cents);
  }
  let topPlanName: string | null = null;
  let topAmount = -1;
  for (const [planId, total] of planRevenue.entries()) {
    if (total > topAmount) {
      topAmount = total;
      topPlanName = plansMap.get(planId) ?? null;
    }
  }

  return {
    top_plan_name: topPlanName,
    revenue_last_7d: recent7.reduce((s, x) => s + x.amount_cents, 0) / 100,
    sales_today_amount: todaySales.reduce((s, x) => s + x.amount_cents, 0) / 100,
    sales_today_count: todaySales.length,
    canceled_subscriptions: canceledSubs,
    users_count: usersCount,
    active_plans: activePlans,
  };
}

export async function fetchPlansRanking(period: PeriodKey): Promise<PlanRanking[]> {
  if (!supabase) return [];
  const since = periodStart(period);
  const [paidSales, plansMap] = await Promise.all([
    fetchPaidSalesSince(since),
    fetchPlansMap(),
  ]);

  const agg = new Map<string, { total_sales: number; revenue_amount: number }>();
  for (const s of paidSales) {
    if (!s.plan_id) continue;
    const cur = agg.get(s.plan_id) ?? { total_sales: 0, revenue_amount: 0 };
    cur.total_sales += 1;
    cur.revenue_amount += s.amount_cents;
    agg.set(s.plan_id, cur);
  }

  return Array.from(agg.entries())
    .map(([planId, v]) => ({
      plan_name: plansMap.get(planId) ?? "—",
      total_sales: v.total_sales,
      revenue_amount: v.revenue_amount / 100,
    }))
    .sort((a, b) => b.revenue_amount - a.revenue_amount);
}

export async function fetchRecentSales(period: PeriodKey): Promise<RecentSale[]> {
  if (!supabase) return [];
  const since = periodStart(period);
  const sales = await fetchPaidSalesSince(since);
  const top = sales.slice(0, 20);
  const userIds = top
    .map((s) => s.user_id)
    .filter((id): id is string => !!id);
  const [plansMap, profilesMap] = await Promise.all([
    fetchPlansMap(),
    fetchProfilesMap(userIds),
  ]);

  return top.map((s) => ({
    id: s.id,
    customer_name:
      (s.user_id ? profilesMap.get(s.user_id) : null) || s.customer_email || null,
    plan_name: s.plan_id ? (plansMap.get(s.plan_id) ?? null) : null,
    amount: s.amount_cents / 100,
    sold_at: s.sold_at,
  }));
}

// ---------- counts ----------

async function countCanceledSubscriptions(since: Date): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabaseAny
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "canceled")
    .gte("canceled_at", since.toISOString());
  return count ?? 0;
}

async function countProfiles(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabaseAny
    .from("profiles")
    .select("user_id", { count: "exact", head: true });
  return count ?? 0;
}

async function countActivePlans(): Promise<number> {
  if (!supabase) return 0;
  const { count } = await supabaseAny
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count ?? 0;
}

// ---------- admin "Compras / Liberações" ----------

export interface AdminEntitlementRow {
  id: string;
  user_id: string;
  product_id: string;
  status: string;
  source_type: string;
  granted_at: string;
  expires_at: string | null;
  external_purchase_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  product_title: string | null;
}

/**
 * Lists the most recent product entitlements (cross-user) for the admin
 * "Compras / Liberações" screen, joined with profile + product titles.
 */
export async function fetchAdminEntitlements(
  limit = 100,
): Promise<AdminEntitlementRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("user_product_entitlements")
    .select("*")
    .order("granted_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const rows = data as Array<{
    id: string;
    user_id: string;
    product_id: string;
    status: string;
    source_type: string;
    granted_at: string;
    expires_at: string | null;
    external_purchase_id: string | null;
  }>;

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));

  const [profilesMap, productsMap, emailsMap] = await Promise.all([
    fetchProfilesMap(userIds),
    fetchProductTitles(productIds),
    fetchProfileEmails(userIds),
  ]);

  return rows.map((r) => ({
    ...r,
    customer_name: profilesMap.get(r.user_id) || null,
    customer_email: emailsMap.get(r.user_id) || null,
    product_title: productsMap.get(r.product_id) || null,
  }));
}

async function fetchProductTitles(
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || ids.length === 0) return map;
  const { data } = await supabaseAny
    .from("catalog_products")
    .select("id, title")
    .in("id", ids);
  ((data ?? []) as { id: string; title: string }[]).forEach((p) =>
    map.set(p.id, p.title),
  );
  return map;
}

async function fetchProfileEmails(
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || ids.length === 0) return map;
  const { data } = await supabaseAny
    .from("profiles")
    .select("user_id, purchase_email")
    .in("user_id", ids);
  ((data ?? []) as { user_id: string; purchase_email: string | null }[]).forEach(
    (p) => p.purchase_email && map.set(p.user_id, p.purchase_email),
  );
  return map;
}
