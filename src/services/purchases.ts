// Services for the new "Minhas Compras" + "Explorar Mais Histórias" areas.
// Pulls user_product_entitlements, user_orders, and computes locked products.

import { useQuery } from "@tanstack/react-query";
import { supabaseAny } from "@/integrations/supabase/client";
import { listProducts, type CatalogProductRow } from "@/services/catalog-db";

export interface EntitlementRow {
  id: string;
  user_id: string;
  product_id: string;
  source_type: "purchase" | "plan" | "manual" | "bonus" | string;
  status: "active" | "expired" | "cancelled" | "refunded" | string;
  granted_at: string;
  expires_at: string | null;
  external_purchase_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  user_id: string;
  product_id: string | null;
  plan_id: string | null;
  order_number: string | null;
  external_order_id: string | null;
  payment_provider: string;
  purchase_status: "pending" | "approved" | "refunded" | "cancelled" | string;
  amount_cents: number;
  currency: string;
  purchased_at: string;
  approved_at: string | null;
  refunded_at: string | null;
}

/** All entitlements for a user (any status). */
export async function listUserEntitlements(
  userId: string,
): Promise<EntitlementRow[]> {
  const { data, error } = await supabaseAny
    .from("user_product_entitlements")
    .select("*")
    .eq("user_id", userId)
    .order("granted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EntitlementRow[];
}

/** All orders for a user. */
export async function listUserOrders(userId: string): Promise<OrderRow[]> {
  const { data, error } = await supabaseAny
    .from("user_orders")
    .select("*")
    .eq("user_id", userId)
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

export interface OwnedProduct {
  product: CatalogProductRow;
  entitlement: EntitlementRow;
  /** Most relevant order for this product, if any. */
  order: OrderRow | null;
}

/** Joins entitlements + products + orders into a unified "owned" list. */
export function joinOwnedProducts(
  entitlements: EntitlementRow[],
  products: CatalogProductRow[],
  orders: OrderRow[],
): OwnedProduct[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const orderByProduct = new Map<string, OrderRow>();
  for (const o of orders) {
    if (o.product_id && !orderByProduct.has(o.product_id)) {
      orderByProduct.set(o.product_id, o);
    }
  }
  return entitlements
    .map((ent) => {
      const product = productById.get(ent.product_id);
      if (!product) return null;
      return {
        product,
        entitlement: ent,
        order: orderByProduct.get(ent.product_id) ?? null,
      } satisfies OwnedProduct;
    })
    .filter((x): x is OwnedProduct => x !== null);
}

/** Products published & active that the user does NOT yet own. */
export function computeLockedProducts(
  products: CatalogProductRow[],
  entitlements: EntitlementRow[],
): CatalogProductRow[] {
  const ownedActive = new Set(
    entitlements.filter((e) => e.status === "active").map((e) => e.product_id),
  );
  return products
    .filter((p) => p.is_published && !ownedActive.has(p.id))
    .sort((a, b) => a.order_index - b.order_index);
}

// ---------- Hooks ----------

export function useUserEntitlements(userId: string | undefined) {
  return useQuery({
    queryKey: ["purchases", "entitlements", userId],
    queryFn: () => (userId ? listUserEntitlements(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useUserOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["purchases", "orders", userId],
    queryFn: () => (userId ? listUserOrders(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useAllProducts() {
  return useQuery({
    queryKey: ["purchases", "all-products"],
    queryFn: () => listProducts(),
  });
}
