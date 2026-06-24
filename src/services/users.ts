import { supabase, supabaseAny } from "@/integrations/supabase/client";

export type UserStatus = "active" | "pending" | "canceled" | "no_plan";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  plan_name: string | null;
  total_paid: number;
  access_blocked: boolean;
  created_at: string;
}

export interface UsersSummary {
  total_filtered: number;
  active_subscriptions: number;
  blocked_access: number;
  revenue_displayed: number;
}

const ZERO_SUMMARY: UsersSummary = {
  total_filtered: 0,
  active_subscriptions: 0,
  blocked_access: 0,
  revenue_displayed: 0,
};

/**
 * Build the admin user list by joining profiles with subscriptions, orders and entitlements.
 * No SQL views needed — works with current schema and RLS (admin role bypasses).
 */
async function loadAggregatedUsers(): Promise<AdminUser[]> {
  if (!supabase) return [];

  console.log("[admin/users] loading aggregated data...");
  
  // We fetch each part separately to handle potential join/relationship errors gracefully
  const profilesRes = await supabaseAny
    .from("profiles")
    .select("user_id, display_name, full_name, email, purchase_email, created_at")
    .order("created_at", { ascending: false });

  if (profilesRes.error) {
    console.error("[admin/users] profiles fetch error:", profilesRes.error);
    // If we can't fetch profiles, we can't show anything.
    throw new Error(`Erro ao buscar perfis: ${profilesRes.error.message}`);
  }

  const profilesData = profilesRes.data ?? [];
  console.log(`[admin/users] found ${profilesData.length} profiles`);
  
  // These queries are allowed to fail (e.g. if tables don't exist or relationships are missing)
  const [subsRes, ordersRes, entitlementsRes] = await Promise.all([
    supabaseAny
      .from("subscriptions")
      .select("user_id, status, plan_id")
      .then((res: any) => res)
      .catch((e: any) => ({ data: [], error: e })),
    supabaseAny
      .from("user_orders")
      .select("user_id, amount_cents, purchase_status")
      .then((res: any) => res)
      .catch((e: any) => ({ data: [], error: e })),
    supabaseAny
      .from("user_product_entitlements")
      .select("user_id, status")
      .then((res: any) => res)
      .catch((e: any) => ({ data: [], error: e })),
  ]);

  // Optionally fetch plan names if we have subscriptions
  const planNames = new Map<string, string>();
  const subData = subsRes.data ?? [];
  const planIds = Array.from(new Set(subData.map((s: any) => s.plan_id).filter(Boolean)));
  
  if (planIds.length > 0) {
    const { data: plansData } = await supabaseAny
      .from("plans")
      .select("id, name")
      .in("id", planIds);
    
    if (plansData) {
      plansData.forEach((p: any) => planNames.set(p.id, p.name));
    }
  }
  
  const subs = (subsRes.data ?? []) as any[];
  const orders = (ordersRes.data ?? []) as any[];
  const ents = (entitlementsRes.data ?? []) as any[];

  // Index by user_id
  const subsByUser = new Map<string, any[]>();
  for (const s of subs) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push(s);
  }

  const totalsByUser = new Map<string, number>();
  for (const o of orders) {
    if (o.purchase_status === "approved" || o.purchase_status === "paid") {
      totalsByUser.set(o.user_id, (totalsByUser.get(o.user_id) ?? 0) + (o.amount_cents || 0));
    }
  }

  const activeEntsByUser = new Map<string, number>();
  for (const e of ents) {
    if (e.status === "active") {
      activeEntsByUser.set(e.user_id, (activeEntsByUser.get(e.user_id) ?? 0) + 1);
    }
  }

  const mappedUsers = profilesData.map((p: any) => {
    const userId = p.user_id;
    const userSubs = subsByUser.get(userId) ?? [];
    const activeSub = userSubs.find((s) => s.status === "active" || s.status === "trialing");
    const pendingSub = userSubs.find((s) => ["pending", "processing", "waiting_payment"].includes(s.status));
    const canceledSub = userSubs.find((s) => ["canceled", "cancelled", "inactive", "expired"].includes(s.status));
    const activeEnts = activeEntsByUser.get(userId) ?? 0;

    let status: UserStatus;
    if (activeSub) status = "active";
    else if (pendingSub) status = "pending";
    else if (canceledSub) status = "canceled";
    else if (activeEnts > 0) status = "active";
    else status = "no_plan";

    const planName = planNames.get(activeSub?.plan_id) ?? null;

    const userName = (p.display_name || p.full_name || p.email || "Usuário").trim();
    console.log(`[admin/users] Mapping user ${userId}: name="${userName}", display_name="${p.display_name}", email="${p.email}"`);
    
    return {
      id: userId,
      name: userName,
      email: (p.purchase_email || p.email || "Sem e-mail").trim(),
      status,
      plan_name: planName,
      total_paid: totalsByUser.get(userId) ?? 0,
      access_blocked: status === "no_plan" || status === "canceled",
      created_at: p.created_at,
    };
  });

  console.log(`[admin/users] successfully mapped ${mappedUsers.length} users`);
  return mappedUsers;
}

export async function fetchUsersSummary(): Promise<UsersSummary> {
  const all = await loadAggregatedUsers();
  if (all.length === 0) return ZERO_SUMMARY;
  return {
    total_filtered: all.length,
    active_subscriptions: all.filter((u) => u.status === "active").length,
    blocked_access: all.filter((u) => u.access_blocked).length,
    revenue_displayed: all.reduce((sum, u) => sum + u.total_paid, 0),
  };
}

export async function fetchUsers(params: {
  search?: string;
  status?: UserStatus | "all";
}): Promise<AdminUser[]> {
  const all = await loadAggregatedUsers().catch(err => {
    console.error("[admin/users] fetchUsers error", err);
    throw err;
  });
  let filtered = all;

  if (params.status && params.status !== "all") {
    filtered = filtered.filter((u) => u.status === params.status);
  }
  if (params.search && params.search.trim().length > 0) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    );
  }
  return filtered;
}

/**
 * Create a new user via Supabase Auth signUp.
 * The handle_new_user_profile trigger will create the profile row automatically.
 */
export async function createUserAccount(input: {
  email: string;
  password: string;
  displayName?: string;
  isAdmin?: boolean;
}): Promise<{ userId: string | null }> {
  if (!supabase) throw new Error("Supabase não configurado");

  console.log("[users] creating account via edge function:", input.email);
  
  const { data, error } = await supabase.functions.invoke("admin-management", {
    body: {
      action: "create-user",
      email: input.email.trim(),
      password: input.password,
      displayName: input.displayName?.trim(),
      isAdmin: input.isAdmin,
    },
  });

  if (error) {
    console.error("[users] edge function error:", error);
    throw error;
  }
  
  if (data?.error) {
    console.error("[users] business logic error:", data.error);
    throw new Error(data.error);
  }

  return { userId: data?.user?.id ?? null };
}
