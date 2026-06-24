// Entitlements service: queries which catalog products the current user can access.
//
// Access rules (mirror the SQL `user_has_product_access` function):
//  • Admin → access to everything
//  • Product not locked → public access
//  • Product in `user_product_entitlements` (status='active', not expired) → access
//
// We compute a single Set<productId> of accessible IDs for the UI to consult.
// Locked products that the user does NOT own are shown with a lock badge and
// route them to the product page (which offers the purchase CTA), not the editor.

import { supabase } from "@/integrations/supabase/client";

export interface AccessibleProductsResult {
  accessibleIds: Set<string>;
  isAdmin: boolean;
}

export async function getAccessibleProductIds(
  userId: string | undefined,
  options: { forceUserView?: boolean } = {},
): Promise<AccessibleProductsResult> {
  // Admin? They see everything — UNLESS we're in "view as user" preview mode,
  // in which case we want the lock badges to show as a real customer would see.
  let isAdmin = false;
  if (userId && !options.forceUserView) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    isAdmin = (roles ?? []).some((r) => (r as { role: string }).role === "admin");
  }

  // Public (unlocked) products are always accessible.
  const { data: publicProducts } = await supabase
    .from("catalog_products" as never)
    .select("id")
    .eq("is_locked", false);
  const accessibleIds = new Set<string>(
    ((publicProducts ?? []) as { id: string }[]).map((p) => p.id),
  );

  if (isAdmin) {
    // Add ALL products if admin.
    const { data: allProducts } = await supabase
      .from("catalog_products" as never)
      .select("id");
    ((allProducts ?? []) as { id: string }[]).forEach((p) => accessibleIds.add(p.id));
    return { accessibleIds, isAdmin };
  }

  if (!userId) return { accessibleIds, isAdmin };

  // Add user-owned (entitled) products
  const { data: ents } = await supabase
    .from("user_product_entitlements" as never)
    .select("product_id, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active");
  const now = Date.now();
  ((ents ?? []) as { product_id: string; expires_at: string | null }[]).forEach((e) => {
    if (!e.expires_at || new Date(e.expires_at).getTime() > now) {
      accessibleIds.add(e.product_id);
    }
  });

  return { accessibleIds, isAdmin };
}

/**
 * Convenience: does the user have access to a specific product?
 * Used by route guards (e.g. /pintar/...) before mounting the editor.
 */
export async function userHasProductAccess(
  userId: string | undefined,
  productId: string,
): Promise<boolean> {
  const { accessibleIds } = await getAccessibleProductIds(userId);
  return accessibleIds.has(productId);
}
