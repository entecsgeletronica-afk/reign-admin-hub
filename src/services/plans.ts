// Plans service: CRUD on `plans` + product-grant management.

import { supabase } from "@/integrations/supabase/client";

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  native_language: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanGrantRow {
  plan_id: string;
  product_id: string;
}

/* ---------- Plans ---------- */

export async function listPlans(): Promise<PlanRow[]> {
  const { data, error } = await supabase
    .from("plans" as never)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlanRow[];
}

export async function createPlan(input: Partial<PlanRow> & { code: string; name: string }) {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description ?? null,
    price_cents: input.price_cents ?? 0,
    currency: input.currency ?? "BRL",
    billing_interval: input.billing_interval ?? "monthly",
    native_language: input.native_language ?? "pt-BR",
    active: input.active ?? true,
  };
  const { data, error } = await supabase
    .from("plans" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PlanRow;
}

export async function updatePlan(id: string, patch: Partial<PlanRow>) {
  const next: Record<string, unknown> = { ...patch };
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  const { error } = await supabase
    .from("plans" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlan(id: string) {
  const { error } = await supabase.from("plans" as never).delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Plan ↔ Product grants ---------- */

export async function listGrantsForPlan(planId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("plan_product_grants" as never)
    .select("product_id")
    .eq("plan_id", planId);
  if (error) throw error;
  return ((data ?? []) as unknown as { product_id: string }[]).map((r) => r.product_id);
}

export async function setGrantsForPlan(planId: string, productIds: string[]) {
  // Replace strategy: delete then insert
  const { error: delErr } = await supabase
    .from("plan_product_grants" as never)
    .delete()
    .eq("plan_id", planId);
  if (delErr) throw delErr;

  if (productIds.length === 0) return;

  const rows = productIds.map((pid) => ({ plan_id: planId, product_id: pid }));
  const { error } = await supabase
    .from("plan_product_grants" as never)
    .insert(rows as never);
  if (error) throw error;
}
