// Admin user detail service.
// Aggregates everything related to a single user for the admin detail screen:
// profile, role, subscriptions, sales (with plan name), product orders and
// entitlements. Pure read aggregation + a couple of role-mutation helpers.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { listUserEntitlements, listUserOrders } from "@/services/purchases";

export interface UserDetailProfile {
  user_id: string;
  display_name: string | null;
  child_name: string | null;
  purchase_email: string | null;
  avatar_url: string | null;
  language_override: string | null;
  created_at: string;
}

export interface UserDetailSale {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  event_type: string | null;
  provider: string;
  sold_at: string;
  external_sale_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
}

export interface UserDetailSubscription {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  provider: string;
  started_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  plan_id: string | null;
  plan_name: string | null;
}

export interface UserDetailBundle {
  profile: UserDetailProfile | null;
  isAdmin: boolean;
  sales: UserDetailSale[];
  subscriptions: UserDetailSubscription[];
  totalsPaid: number; // in currency units (R$)
}

async function fetchProfile(userId: string): Promise<UserDetailProfile | null> {
  if (!supabase) return null;
  const { data } = await supabaseAny
    .from("profiles")
    .select(
      "user_id, display_name, child_name, purchase_email, avatar_url, language_override, created_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as UserDetailProfile | null) ?? null;
}

async function fetchIsAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabaseAny
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function fetchPlanNames(
  ids: Array<string | null>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const clean = Array.from(
    new Set(ids.filter((v): v is string => !!v)),
  );
  if (!supabase || clean.length === 0) return map;
  const { data } = await supabaseAny.from("plans").select("id, name").in("id", clean);
  ((data ?? []) as { id: string; name: string }[]).forEach((p) =>
    map.set(p.id, p.name),
  );
  return map;
}

async function fetchSales(userId: string): Promise<UserDetailSale[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("sales")
    .select(
      "id, amount_cents, currency, status, event_type, provider, sold_at, external_sale_id, plan_id",
    )
    .eq("user_id", userId)
    .order("sold_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  const rows = data as Omit<UserDetailSale, "plan_name">[];
  const planNames = await fetchPlanNames(rows.map((r) => r.plan_id));
  return rows.map((r) => ({
    ...r,
    plan_name: r.plan_id ? (planNames.get(r.plan_id) ?? null) : null,
  }));
}

async function fetchSubscriptions(
  userId: string,
): Promise<UserDetailSubscription[]> {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("subscriptions")
    .select(
      "id, status, amount_cents, currency, provider, started_at, current_period_end, canceled_at, plan_id",
    )
    .eq("user_id", userId)
    .order("started_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];
  const rows = data as Omit<UserDetailSubscription, "plan_name">[];
  const planNames = await fetchPlanNames(rows.map((r) => r.plan_id));
  return rows.map((r) => ({
    ...r,
    plan_name: r.plan_id ? (planNames.get(r.plan_id) ?? null) : null,
  }));
}

const PAID_STATUSES = new Set(["paid", "approved", "completed"]);

export async function fetchUserDetailBundle(
  userId: string,
): Promise<UserDetailBundle> {
  const [profile, isAdmin, sales, subscriptions] = await Promise.all([
    fetchProfile(userId),
    fetchIsAdmin(userId),
    fetchSales(userId),
    fetchSubscriptions(userId),
  ]);
  const totalsPaid =
    sales
      .filter((s) => PAID_STATUSES.has(s.status))
      .reduce((acc, s) => acc + s.amount_cents, 0) / 100;
  return { profile, isAdmin, sales, subscriptions, totalsPaid };
}

// ---------- Hooks ----------

export function useUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () =>
      userId ? fetchUserDetailBundle(userId) : Promise.resolve(null),
    enabled: !!userId,
  });
}

export function useUserOrdersAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user-orders", userId],
    queryFn: () => (userId ? listUserOrders(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useUserEntitlementsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user-entitlements", userId],
    queryFn: () =>
      userId ? listUserEntitlements(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

// ---------- Role mutations ----------

export function useToggleAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; makeAdmin: boolean }) => {
      if (!supabase) throw new Error("Supabase não conectado");
      if (input.makeAdmin) {
        const { error } = await supabaseAny
          .from("user_roles")
          .insert({ user_id: input.userId, role: "admin" });
        if (error && !`${error.message}`.toLowerCase().includes("duplicate"))
          throw error;
      } else {
        const { error } = await supabaseAny
          .from("user_roles")
          .delete()
          .eq("user_id", input.userId)
          .eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "user-detail", vars.userId] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "users-summary"] });
    },
  });
}
