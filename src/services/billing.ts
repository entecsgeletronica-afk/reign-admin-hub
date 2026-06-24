import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseAny } from "@/integrations/supabase/client";

export interface SubscriptionRow {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  current_period_end: string | null;
  started_at: string | null;
  canceled_at: string | null;
  plan_id: string | null;
  customer_email: string | null;
}

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  currency: string;
  billing_interval: string;
}

export interface SubscriptionWithPlan {
  subscription: SubscriptionRow | null;
  plan: PlanRow | null;
}

async function fetchActiveSubscription(
  userId: string | undefined,
  email: string | null | undefined,
): Promise<SubscriptionWithPlan> {
  if (!supabase || (!userId && !email)) {
    return { subscription: null, plan: null };
  }

  // Try by user_id first; fall back to customer_email
  let query = supabaseAny
    .from("subscriptions")
    .select(
      "id, status, amount_cents, currency, current_period_end, started_at, canceled_at, plan_id, customer_email, user_id",
    )
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (email) {
    query = query.eq("customer_email", email);
  }

  const { data: subData } = await query.maybeSingle();

  if (!subData && email && userId) {
    // fallback: same userId returned nothing, try email
    const { data } = await supabaseAny
      .from("subscriptions")
      .select(
        "id, status, amount_cents, currency, current_period_end, started_at, canceled_at, plan_id, customer_email",
      )
      .eq("customer_email", email)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { subscription: null, plan: null };
    return { subscription: data as SubscriptionRow, plan: await loadPlan(data.plan_id) };
  }

  if (!subData) return { subscription: null, plan: null };
  return { subscription: subData as SubscriptionRow, plan: await loadPlan(subData.plan_id) };
}

async function loadPlan(planId: string | null): Promise<PlanRow | null> {
  if (!planId || !supabase) return null;
  const { data } = await supabaseAny
    .from("plans")
    .select("id, code, name, price_cents, currency, billing_interval")
    .eq("id", planId)
    .maybeSingle();
  return (data ?? null) as PlanRow | null;
}

export function useActiveSubscription(
  userId: string | undefined,
  email: string | null | undefined,
) {
  return useQuery({
    queryKey: ["billing", "active-subscription", userId ?? "noid", email ?? "noemail"],
    queryFn: () => fetchActiveSubscription(userId, email),
    enabled: !!userId || !!email,
  });
}
