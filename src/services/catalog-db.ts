// Supabase-backed catalog service.
// Tables: catalog_sections, catalog_products, home_settings,
//         user_recent_products, catalog_user_favorites
// Storage bucket: catalog-covers (public)

import { supabase } from "@/integrations/supabase/client";

export interface CatalogSectionRow {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  order_index: number;
  is_active: boolean;
  variation_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductType = "drawing" | "course" | "ebook" | "download";
export type EbookMode = "single_pdf" | "modules";

export interface CatalogProductRow {
  id: string;
  section_id: string | null;
  variation_id: string | null;
  story_id: string | null;
  product_type: ProductType;
  /** Apenas usado quando product_type === "ebook". */
  ebook_mode: EbookMode | null;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  hero_image_url: string | null;
  is_featured: boolean;
  is_published: boolean;
  is_locked: boolean;
  external_url: string | null;
  badge_text: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  // Espelhamento entre áreas de membros.
  is_mirror?: boolean;
  source_product_id?: string | null;
  mirror_type?: "product" | "section" | null;
  content_source?: "own" | "mirror";
  inherited_cover?: boolean;
}

export interface HomeSettingsRow {
  id: string;
  variation_id: string | null;
  featured_product_id: string | null;
  continue_fallback_product_id: string | null;
  hero_label: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_button_label: string | null;
  hero_image_url: string | null;
  hero_overlay_opacity: number | null;
  updated_at: string;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

/* ---------------- Sections ---------------- */

export async function listSections(opts?: {
  includeInactive?: boolean;
  variationId?: string | null;
}): Promise<CatalogSectionRow[]> {
  let q = supabase
    .from("catalog_sections" as never)
    .select("*")
    .order("order_index", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("is_active", true);
  if (opts?.variationId) q = q.eq("variation_id", opts.variationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CatalogSectionRow[];
}

export async function createSection(
  input: Partial<CatalogSectionRow> & { title: string },
): Promise<CatalogSectionRow> {
  const payload = {
    title: input.title,
    slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.title),
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    order_index: input.order_index ?? 0,
    is_active: input.is_active ?? true,
    variation_id: input.variation_id ?? null,
  };
  const { data, error } = await supabase
    .from("catalog_sections" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CatalogSectionRow;
}

export async function updateSection(
  id: string,
  patch: Partial<CatalogSectionRow>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  if (typeof patch.slug === "string" && patch.slug) next.slug = slugify(patch.slug);
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  const { error } = await supabase
    .from("catalog_sections" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from("catalog_sections" as never).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Duplica uma seção dentro da MESMA área de membros, criando cópias
 * independentes de todos os produtos. Não cria espelhos: cada produto novo
 * tem seu próprio id e slug, mas mantém o mesmo story_id (compartilhando o
 * conteúdo de aulas/ebook/desenho da origem). Capa, oferta, publicação e
 * bloqueio são preservados como na origem.
 */
export async function duplicateSection(sectionId: string): Promise<CatalogSectionRow> {
  // 1. Carrega seção origem.
  const { data: src, error: secErr } = await supabase
    .from("catalog_sections" as never)
    .select("*")
    .eq("id", sectionId)
    .single();
  if (secErr) throw secErr;
  const source = src as unknown as CatalogSectionRow;

  // 2. Calcula próximo order_index na mesma variação.
  const { data: lastSec } = await supabase
    .from("catalog_sections" as never)
    .select("order_index")
    .eq("variation_id", source.variation_id as never)
    .order("order_index", { ascending: false })
    .limit(1);
  const nextSecOrder =
    ((lastSec ?? [])[0] as { order_index: number } | undefined)?.order_index ?? -1;

  // 3. Cria a nova seção (título com sufixo "(cópia)").
  const newTitle = `${source.title} (cópia)`;
  const newSection = await createSection({
    title: newTitle,
    slug: `${slugify(source.title)}-${Math.random().toString(36).slice(2, 6)}`,
    subtitle: source.subtitle ?? undefined,
    description: source.description ?? undefined,
    is_active: source.is_active,
    variation_id: source.variation_id,
    order_index: nextSecOrder + 1,
  });

  // 4. Lista produtos da seção origem.
  const { data: prods, error: pErr } = await supabase
    .from("catalog_products" as never)
    .select("*")
    .eq("section_id", sectionId)
    .order("order_index", { ascending: true });
  if (pErr) throw pErr;
  const products = (prods ?? []) as unknown as CatalogProductRow[];

  if (products.length > 0) {
    // 5. Monta payload de cópias independentes (sem campos de espelhamento).
    const payload = products.map((p, i) => ({
      section_id: newSection.id,
      variation_id: newSection.variation_id,
      story_id: p.story_id,
      product_type: p.product_type,
      ebook_mode: p.ebook_mode,
      title: p.title,
      slug: `${slugify(p.title)}-${Math.random().toString(36).slice(2, 6)}`,
      subtitle: p.subtitle,
      description: p.description,
      cover_image_url: p.cover_image_url,
      thumbnail_url: p.thumbnail_url,
      hero_image_url: p.hero_image_url,
      is_featured: false,
      is_published: p.is_published,
      is_locked: p.is_locked,
      external_url: p.external_url,
      badge_text: p.badge_text,
      order_index: i,
    }));
    const { error: insErr } = await supabase
      .from("catalog_products" as never)
      .insert(payload as never);
    if (insErr) throw insErr;
  }

  return newSection;
}

/* ---------------- Products ---------------- */

export async function listProducts(opts?: {
  includeUnpublished?: boolean;
  variationId?: string | null;
}): Promise<CatalogProductRow[]> {
  let q = supabase
    .from("catalog_products" as never)
    .select("*")
    .order("order_index", { ascending: true });
  if (!opts?.includeUnpublished) q = q.eq("is_published", true);
  if (opts?.variationId) q = q.eq("variation_id", opts.variationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CatalogProductRow[];
}

export async function createProduct(
  input: Partial<CatalogProductRow> & { title: string; section_id: string },
): Promise<CatalogProductRow> {
  const payload = {
    section_id: input.section_id,
    variation_id: input.variation_id ?? null,
    product_type: input.product_type ?? "drawing",
    ebook_mode: input.ebook_mode ?? null,
    title: input.title,
    slug: input.slug?.trim() ? slugify(input.slug) : slugify(input.title),
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    cover_image_url: input.cover_image_url ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    hero_image_url: input.hero_image_url ?? null,
    is_featured: input.is_featured ?? false,
    is_published: input.is_published ?? true,
    is_locked: input.is_locked ?? false,
    external_url: input.external_url ?? null,
    badge_text: input.badge_text ?? null,
    order_index: input.order_index ?? 0,
  };
  const { data, error } = await supabase
    .from("catalog_products" as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CatalogProductRow;
}

export async function updateProduct(
  id: string,
  patch: Partial<CatalogProductRow>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  if (typeof patch.slug === "string" && patch.slug) next.slug = slugify(patch.slug);
  delete next.id;
  delete next.created_at;
  delete next.updated_at;
  const { error } = await supabase
    .from("catalog_products" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("catalog_products" as never).delete().eq("id", id);
  if (error) throw error;
}

export async function getProductBySlug(slug: string): Promise<CatalogProductRow | null> {
  const { data, error } = await supabase
    .from("catalog_products" as never)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CatalogProductRow) ?? null;
}

export async function getProductById(id: string): Promise<CatalogProductRow | null> {
  const { data, error } = await supabase
    .from("catalog_products" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as CatalogProductRow) ?? null;
}

/* ---------------- Home settings ---------------- */

export async function getHomeSettings(
  variationId?: string | null,
): Promise<HomeSettingsRow | null> {
  // Per-variation row when scoped, otherwise fall back to a legacy global row.
  let q = supabase.from("home_settings" as never).select("*");
  if (variationId) {
    q = q.eq("variation_id", variationId);
  } else {
    q = q.is("variation_id", null);
  }
  const { data, error } = await q
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  let row = (data as unknown as HomeSettingsRow) ?? null;

  // Auto-provision an empty row for this variation so the admin always has
  // something to edit (avoids "no row" UI states across areas).
  if (!row && variationId) {
    const { data: created, error: insErr } = await supabase
      .from("home_settings" as never)
      .insert({ variation_id: variationId } as never)
      .select("*")
      .single();
    if (insErr) throw insErr;
    row = created as unknown as HomeSettingsRow;
  }
  return row;
}

export async function updateHomeSettings(
  id: string,
  patch: Partial<HomeSettingsRow>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  delete next.id;
  delete next.updated_at;
  delete next.variation_id; // never reassign which variation owns the row
  const { error } = await supabase
    .from("home_settings" as never)
    .update(next as never)
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Storage upload ---------------- */

export async function uploadCatalogCover(
  file: File,
  prefix = "products",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("catalog-covers")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("catalog-covers").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------------- User recent + favorites ---------------- */

export async function getMostRecentProduct(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_recent_products" as never)
    .select("product_id, last_opened_at")
    .eq("user_id", userId)
    .order("last_opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as { product_id: string } | null)?.product_id ?? null;
}

/**
 * Lista os IDs dos produtos abertos recentemente pelo usuário, em ordem
 * decrescente de uso. Usado pela seção "Continue colorindo" da home.
 */
export async function listRecentProductIds(
  userId: string,
  limit = 12,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_recent_products" as never)
    .select("product_id, last_opened_at")
    .eq("user_id", userId)
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data as { product_id: string }[] | null) ?? []).map((r) => r.product_id);
}

/**
 * Marks a product as recently opened by the user. Used by the home's
 * "Continuar lendo" tile so e-books, courses and drawings all surface here
 * after the learner accesses them. Upsert keyed on (user_id, product_id).
 */
export async function upsertRecentProduct(input: {
  user_id: string;
  product_id: string;
  progress_percent?: number;
}): Promise<void> {
  await supabase
    .from("user_recent_products" as never)
    .upsert(
      {
        user_id: input.user_id,
        product_id: input.product_id,
        progress_percent: Math.max(0, Math.min(100, input.progress_percent ?? 0)),
        last_opened_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,product_id" },
    );
}

export async function listUserFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("catalog_user_favorites" as never)
    .select("product_id")
    .eq("user_id", userId);
  if (error) return new Set();
  return new Set(((data as { product_id: string }[] | null) ?? []).map((d) => d.product_id));
}

export async function toggleFavorite(
  userId: string,
  productId: string,
  on: boolean,
): Promise<void> {
  if (on) {
    await supabase
      .from("catalog_user_favorites" as never)
      .insert({ user_id: userId, product_id: productId } as never);
  } else {
    await supabase
      .from("catalog_user_favorites" as never)
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
  }
}
