// Commercial Offers service — gerencia ofertas comerciais que liberam produtos
// após confirmação de pagamento (substitui a antiga lógica de
// "Acessos / Bloqueios" do catálogo).

import { supabase, supabaseAny } from "@/integrations/supabase/client";

export type OfferGateway = "perfectpay" | "pepper" | "hotmart" | "kiwify" | "other";
export type OfferSaleMode =
  | "one_time"
  | "monthly"
  | "yearly"
  | "lifetime"
  | "custom";
export type OfferStatus = "active" | "inactive" | "draft";
export type AccessDurationType = "lifetime" | "days" | "custom" | "subscription_active";
export type ReleaseMode = "immediate" | "scheduled" | "gradual";

export interface CommercialOffer {
  id: string;
  account_id: string;
  variation_id: string;
  gateway: OfferGateway;
  offer_name: string;
  sale_mode: OfferSaleMode;
  token: string | null;
  status: OfferStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfferCode {
  id: string;
  offer_id: string;
  code: string;
  created_at: string;
}

export interface OfferProduct {
  id: string;
  offer_id: string;
  product_id: string;
  access_duration_type: AccessDurationType;
  access_duration_days: number | null;
  release_mode: ReleaseMode;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CommercialOfferFull extends CommercialOffer {
  codes: OfferCode[];
  products: OfferProduct[];
}

export interface CreateOfferInput {
  variation_id: string;
  gateway: OfferGateway;
  offer_name: string;
  sale_mode: OfferSaleMode;
  token?: string | null;
  status?: OfferStatus;
  notes?: string | null;
  codes: string[];
}

export interface UpdateOfferInput extends Partial<CreateOfferInput> {
  id: string;
}

export interface OfferProductInput {
  product_id: string;
  access_duration_type: AccessDurationType;
  access_duration_days?: number | null;
  release_mode?: ReleaseMode;
  order_index?: number;
}

// ---------- Helpers ----------

/** Parse codes from a raw text input (comma, semicolon, newline separated). */
export function parseCodesInput(raw: string): string[] {
  return raw
    .split(/[,;\n\r]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- List ----------

export async function listOffers(filter?: {
  variationId?: string;
  status?: OfferStatus | "all";
  gateway?: OfferGateway | "all";
  search?: string;
}): Promise<CommercialOfferFull[]> {
  if (!supabase) return [];

  let q = supabaseAny
    .from("commercial_offers")
    .select(
      `
      id, account_id, variation_id, gateway, offer_name, sale_mode, token,
      status, notes, created_at, updated_at,
      codes:commercial_offer_codes(id, offer_id, code, created_at),
      products:commercial_offer_products(
        id, offer_id, product_id, access_duration_type, access_duration_days,
        release_mode, order_index, created_at, updated_at
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (filter?.variationId) q = q.eq("variation_id", filter.variationId);
  if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter?.gateway && filter.gateway !== "all") q = q.eq("gateway", filter.gateway);
  if (filter?.search) q = q.ilike("offer_name", `%${filter.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CommercialOfferFull[];
}

export async function getOffer(id: string): Promise<CommercialOfferFull | null> {
  if (!supabase) return null;
  const { data, error } = await supabaseAny
    .from("commercial_offers")
    .select(
      `
      id, account_id, variation_id, gateway, offer_name, sale_mode, token,
      status, notes, created_at, updated_at,
      codes:commercial_offer_codes(id, offer_id, code, created_at),
      products:commercial_offer_products(
        id, offer_id, product_id, access_duration_type, access_duration_days,
        release_mode, order_index, created_at, updated_at
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CommercialOfferFull | null;
}

// ---------- Create ----------

export async function createOffer(input: CreateOfferInput): Promise<CommercialOffer> {
  if (!supabase) throw new Error("Supabase indisponível");

  const { data: offer, error } = await supabaseAny
    .from("commercial_offers")
    .insert({
      variation_id: input.variation_id,
      gateway: input.gateway,
      offer_name: input.offer_name,
      sale_mode: input.sale_mode,
      token: input.token ?? null,
      status: input.status ?? "active",
      notes: input.notes ?? null,
    })
    .select(
      "id, account_id, variation_id, gateway, offer_name, sale_mode, token, status, notes, created_at, updated_at",
    )
    .single();
  if (error) throw error;

  const created = offer as CommercialOffer;

  if (input.codes.length > 0) {
    const rows = input.codes.map((code) => ({ offer_id: created.id, code }));
    const { error: codesErr } = await supabaseAny
      .from("commercial_offer_codes")
      .insert(rows);
    if (codesErr) throw codesErr;
  }

  return created;
}

// ---------- Update ----------

export async function updateOffer(input: UpdateOfferInput): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível");
  const { id, codes, ...rest } = input;
  const patch: Record<string, unknown> = {};
  if (rest.variation_id !== undefined) patch.variation_id = rest.variation_id;
  if (rest.gateway !== undefined) patch.gateway = rest.gateway;
  if (rest.offer_name !== undefined) patch.offer_name = rest.offer_name;
  if (rest.sale_mode !== undefined) patch.sale_mode = rest.sale_mode;
  if (rest.token !== undefined) patch.token = rest.token;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.notes !== undefined) patch.notes = rest.notes;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAny
      .from("commercial_offers")
      .update(patch)
      .eq("id", id);
    if (error) throw error;
  }

  if (codes !== undefined) {
    // replace all codes
    const { error: delErr } = await supabaseAny
      .from("commercial_offer_codes")
      .delete()
      .eq("offer_id", id);
    if (delErr) throw delErr;
    if (codes.length > 0) {
      const rows = codes.map((code) => ({ offer_id: id, code }));
      const { error: insErr } = await supabaseAny
        .from("commercial_offer_codes")
        .insert(rows);
      if (insErr) throw insErr;
    }
  }
}

// ---------- Delete ----------

export async function deleteOffer(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível");
  const { error } = await supabaseAny
    .from("commercial_offers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Duplicate ----------

export async function duplicateOffer(id: string): Promise<string> {
  const src = await getOffer(id);
  if (!src) throw new Error("Oferta não encontrada");

  const copy = await createOffer({
    variation_id: src.variation_id,
    gateway: src.gateway,
    offer_name: `${src.offer_name} (cópia)`,
    sale_mode: src.sale_mode,
    token: src.token,
    status: "draft",
    notes: src.notes,
    codes: src.codes.map((c) => c.code),
  });

  if (src.products.length > 0) {
    const rows = src.products.map((p) => ({
      offer_id: copy.id,
      product_id: p.product_id,
      access_duration_type: p.access_duration_type,
      access_duration_days: p.access_duration_days,
      release_mode: p.release_mode,
      order_index: p.order_index,
    }));
    await supabaseAny.from("commercial_offer_products").insert(rows);
  }
  return copy.id;
}

// ---------- Toggle status ----------

export async function setOfferStatus(id: string, status: OfferStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível");
  const { error } = await supabaseAny
    .from("commercial_offers")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Products linkage ----------

export async function setOfferProducts(
  offerId: string,
  products: OfferProductInput[],
): Promise<void> {
  if (!supabase) throw new Error("Supabase indisponível");

  // simple replace strategy
  const { error: delErr } = await supabaseAny
    .from("commercial_offer_products")
    .delete()
    .eq("offer_id", offerId);
  if (delErr) throw delErr;

  if (products.length === 0) return;

  const rows = products.map((p, i) => ({
    offer_id: offerId,
    product_id: p.product_id,
    access_duration_type: p.access_duration_type,
    access_duration_days: p.access_duration_days ?? null,
    release_mode: p.release_mode ?? "immediate",
    order_index: p.order_index ?? i,
  }));
  const { error } = await supabaseAny
    .from("commercial_offer_products")
    .insert(rows);
  if (error) throw error;
}
