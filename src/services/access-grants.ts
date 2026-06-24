import { supabase, supabaseAny } from "@/integrations/supabase/client";

export interface AccessGrantRow {
  order_id: string;
  user_id: string;
  product_id: string | null;
  product_title: string | null;
  product_slug: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  amount_cents: number;
  currency: string;
  purchase_status: string;
  purchased_at: string;
  approved_at: string | null;
  payment_provider: string;
}

export interface AccessGrantsParams {
  search?: string;
  status?: string | "all";
  productId?: string | "all";
  fromDate?: string | null;
  toDate?: string | null;
  limit?: number;
}

export async function fetchAccessGrants(
  params: AccessGrantsParams = {},
): Promise<AccessGrantRow[]> {
  if (!supabase) return [];
  const limit = params.limit ?? 200;

  let q = supabaseAny
    .from("user_orders")
    .select(
      `
      id,
      user_id,
      product_id,
      amount_cents,
      currency,
      purchase_status,
      purchased_at,
      approved_at,
      payment_provider,
      catalog_products(title, slug),
      profiles!inner(display_name, purchase_email, phone)
    `,
    )
    .order("purchased_at", { ascending: false })
    .limit(limit);

  if (params.status && params.status !== "all") {
    q = q.eq("purchase_status", params.status);
  }
  if (params.productId && params.productId !== "all") {
    q = q.eq("product_id", params.productId);
  }
  if (params.fromDate) q = q.gte("purchased_at", params.fromDate);
  if (params.toDate) q = q.lte("purchased_at", params.toDate);

  const { data, error } = await q;
  if (error) {
    console.warn("[access-grants] fetch error:", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    user_id: string;
    product_id: string | null;
    amount_cents: number;
    currency: string;
    purchase_status: string;
    purchased_at: string;
    approved_at: string | null;
    payment_provider: string;
    catalog_products: { title: string; slug: string } | null;
    profiles: {
      display_name: string | null;
      purchase_email: string | null;
      phone: string | null;
    } | null;
  }>;

  // The relationship "profiles" returns a single row because of the
  // user_id FK; some Supabase clients still type it as array. Normalize.
  const normalized: AccessGrantRow[] = rows.map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const product = Array.isArray(r.catalog_products)
      ? r.catalog_products[0]
      : r.catalog_products;
    return {
      order_id: r.id,
      user_id: r.user_id,
      product_id: r.product_id,
      product_title: product?.title ?? null,
      product_slug: product?.slug ?? null,
      display_name: profile?.display_name ?? null,
      email: profile?.purchase_email ?? null,
      phone: profile?.phone ?? null,
      amount_cents: r.amount_cents,
      currency: r.currency,
      purchase_status: r.purchase_status,
      purchased_at: r.purchased_at,
      approved_at: r.approved_at,
      payment_provider: r.payment_provider,
    };
  });

  // Optional client-side filter by free text — name / email / phone
  const term = params.search?.trim().toLowerCase();
  if (!term) return normalized;
  return normalized.filter((r) => {
    return (
      (r.display_name ?? "").toLowerCase().includes(term) ||
      (r.email ?? "").toLowerCase().includes(term) ||
      (r.phone ?? "").toLowerCase().includes(term) ||
      (r.product_title ?? "").toLowerCase().includes(term)
    );
  });
}

export async function logAccessResend(input: {
  adminUserId: string;
  targetUserId: string;
  productId: string | null;
  orderId: string;
  channel: "email" | "whatsapp" | "copy_link";
  recipient: string | null;
  status?: "queued" | "sent" | "failed";
  notes?: string | null;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabaseAny.from("access_resend_log").insert({
    admin_user_id: input.adminUserId,
    target_user_id: input.targetUserId,
    product_id: input.productId,
    order_id: input.orderId,
    channel: input.channel,
    recipient: input.recipient,
    status: input.status ?? "queued",
    notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchRecentResends(targetUserId: string, limit = 5) {
  if (!supabase) return [];
  const { data, error } = await supabaseAny
    .from("access_resend_log")
    .select("id, channel, status, created_at, notes")
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Array<{
    id: string;
    channel: string;
    status: string;
    created_at: string;
    notes: string | null;
  }>;
}
