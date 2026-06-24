// Admin-only helpers to grant / revoke product access manually.
// Used by the "Liberar produto manualmente" UI inside the admin Users page.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseAny } from "@/integrations/supabase/client";
import { listProducts } from "@/services/catalog-db";
import type { EntitlementRow } from "@/services/purchases";

export function useAdminUserEntitlements(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["admin", "entitlements", userId],
    queryFn: async (): Promise<EntitlementRow[]> => {
      if (!userId) return [];
      const { data, error } = await supabaseAny
        .from("user_product_entitlements")
        .select("*")
        .eq("user_id", userId)
        .order("granted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EntitlementRow[];
    },
    enabled: !!userId,
  });
}

export function useAdminAllProducts() {
  return useQuery({
    queryKey: ["admin", "all-products"],
    queryFn: () => listProducts(),
  });
}

export function useGrantEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; productId: string }) => {
      const { error } = await supabaseAny
        .from("user_product_entitlements")
        .insert({
          user_id: input.userId,
          product_id: input.productId,
          source_type: "manual",
          status: "active",
        });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "entitlements", vars.userId] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useRevokeEntitlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { entitlementId: string; userId: string }) => {
      const { error } = await supabaseAny
        .from("user_product_entitlements")
        .delete()
        .eq("id", input.entitlementId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "entitlements", vars.userId] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useUpdateEntitlementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      entitlementId: string;
      userId: string;
      status: "active" | "expired" | "cancelled" | "refunded";
    }) => {
      const { error } = await supabaseAny
        .from("user_product_entitlements")
        .update({ status: input.status })
        .eq("id", input.entitlementId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "entitlements", vars.userId] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}
