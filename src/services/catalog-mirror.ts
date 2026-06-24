// Espelhamento de produtos entre áreas de membros.
//
// Um espelho é uma cópia leve: tem seu próprio id, título, capa, seção,
// publicação, oferta e bloqueio, mas resolve o conteúdo (story/aulas/ebook)
// a partir do produto original (source_product_id) quando content_source = 'mirror'.

import { supabase, supabaseAny } from "@/integrations/supabase/client";
import { slugify, type CatalogProductRow } from "./catalog-db";
import { resolveProductCover } from "@/lib/catalog-covers";

export interface MirrorProductsInput {
  /** Produtos da área origem que serão espelhados. */
  sourceProductIds: string[];
  /** Variation/área onde os espelhos serão criados. */
  destinationVariationId: string;
  /** Seção destino dentro da área atual. */
  destinationSectionId: string;
  mirrorType: "product" | "section";
}

export interface MirrorSectionInput {
  sourceSectionId: string;
  destinationVariationId: string;
  /** Seção destino existente (string id) OU "__new__" para criar uma nova
   *  com o mesmo nome da origem. */
  destinationSectionId: string | "__new__";
}

/**
 * Cria N produtos espelhados a partir de uma lista de produtos de origem.
 * Espelhos nascem sempre: ocultos (is_published=false), bloqueados
 * (is_locked=true), sem destaque, sem oferta, sem plano.
 */
export async function createMirrorProducts(
  input: MirrorProductsInput,
): Promise<CatalogProductRow[]> {
  if (!input.sourceProductIds.length) return [];
  if (!input.destinationSectionId) {
    throw new Error("Selecione a seção destino antes de criar espelhos.");
  }

  // Busca dados completos dos produtos origem.
  const { data: sources, error: srcErr } = await supabase
    .from("catalog_products" as never)
    .select("*")
    .in("id", input.sourceProductIds);
  if (srcErr) throw srcErr;
  const sourceRows = (sources ?? []) as unknown as CatalogProductRow[];

  // Validação: nenhum origem pode pertencer à mesma área destino.
  for (const src of sourceRows) {
    if (src.variation_id === input.destinationVariationId) {
      throw new Error(
        `O produto "${src.title}" já pertence a esta área de membros.`,
      );
    }
  }

  // Calcula próximo order_index na seção destino.
  const { data: lastRows } = await supabase
    .from("catalog_products" as never)
    .select("order_index")
    .eq("section_id", input.destinationSectionId)
    .order("order_index", { ascending: false })
    .limit(1);
  let nextOrder =
    ((lastRows ?? [])[0] as { order_index: number } | undefined)?.order_index ?? -1;

  const payload = sourceRows.map((src) => {
    nextOrder += 1;
    // O espelho referencia o source raiz: se o origem já é um espelho,
    // resolve para o produto original real para evitar cadeias.
    const rootSourceId = src.is_mirror && src.source_product_id
      ? src.source_product_id
      : src.id;
    // Resolve a capa REAL do source (cobre slug → asset bundlado quando o
    // source não tem cover_image_url próprio), porque o espelho terá um
    // slug novo com sufixo aleatório que nunca bateria no SEED_COVERS.
    const resolvedCover = resolveProductCover(src) ?? src.cover_image_url ?? null;
    return {
      section_id: input.destinationSectionId,
      variation_id: input.destinationVariationId,
      story_id: src.story_id,
      product_type: src.product_type,
      ebook_mode: src.ebook_mode,
      title: src.title,
      // Slug precisa ser único — anexa sufixo curto.
      slug: `${slugify(src.title)}-${Math.random().toString(36).slice(2, 6)}`,
      subtitle: src.subtitle,
      description: src.description,
      cover_image_url: resolvedCover,
      thumbnail_url: src.thumbnail_url,
      hero_image_url: src.hero_image_url,
      // Regras comerciais obrigatórias dos espelhos:
      is_featured: false,
      is_published: false,
      is_locked: true,
      external_url: null,
      badge_text: src.badge_text,
      order_index: nextOrder,
      // Metadados de espelhamento:
      is_mirror: true,
      source_product_id: rootSourceId,
      mirror_type: input.mirrorType,
      content_source: "mirror",
      inherited_cover: true,
    };
  });

  // Tenta o INSERT completo. Se a migration de espelhamento ainda não rodou
  // no Supabase do projeto (colunas is_mirror/source_product_id ausentes),
  // refaz o insert sem essas colunas para que o espelhamento funcione mesmo
  // como cópia "burra" — nesse modo o conteúdo será duplicado por referência
  // ao mesmo story_id, mas sem o vínculo formal de espelho.
  let { data, error } = await supabaseAny
    .from("catalog_products")
    .insert(payload)
    .select("*");

  // Fallback: se a migration de espelhamento ainda não rodou no Supabase do
  // projeto, o PostgREST devolve PGRST204 ("column ... not found in schema
  // cache"). Refazemos o insert removendo todas as colunas novas para que o
  // espelhamento funcione como cópia leve (sem vínculo formal de espelho).
  const isSchemaCacheMiss =
    !!error &&
    (
      (error.code && String(error.code).toUpperCase() === "PGRST204") ||
      /schema cache|is_mirror|source_product_id|mirror_type|content_source|inherited_cover/i.test(
        String(error.message ?? "") + " " + String((error as { details?: string }).details ?? ""),
      )
    );
  if (isSchemaCacheMiss) {
    const fallbackPayload = payload.map((row) => {
      const {
        is_mirror: _a,
        source_product_id: _b,
        mirror_type: _c,
        content_source: _d,
        inherited_cover: _e,
        ...rest
      } = row;
      return rest;
    });
    const retry = await supabaseAny
      .from("catalog_products")
      .insert(fallbackPayload)
      .select("*");
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return (data ?? []) as CatalogProductRow[];
}

/**
 * Espelha uma seção inteira: opcionalmente cria a seção destino, depois
 * espelha todos os produtos da seção origem para ela.
 */
export async function createMirrorSection(
  input: MirrorSectionInput,
): Promise<{ sectionId: string; products: CatalogProductRow[] }> {
  // Resolve seção destino.
  let destSectionId = input.destinationSectionId;
  if (destSectionId === "__new__") {
    const { data: src, error: srcErr } = await supabaseAny
      .from("catalog_sections")
      .select("title")
      .eq("id", input.sourceSectionId)
      .single();
    if (srcErr) throw srcErr;

    const { data: lastSec } = await supabaseAny
      .from("catalog_sections")
      .select("order_index")
      .eq("variation_id", input.destinationVariationId)
      .order("order_index", { ascending: false })
      .limit(1);
    const nextSecOrder =
      ((lastSec ?? [])[0]?.order_index as number | undefined) ?? -1;

    const { data: created, error: insErr } = await supabaseAny
      .from("catalog_sections")
      .insert({
        title: src.title,
        slug: `${slugify(src.title)}-${Math.random().toString(36).slice(2, 6)}`,
        is_active: true,
        variation_id: input.destinationVariationId,
        order_index: nextSecOrder + 1,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    destSectionId = created.id as string;
  }

  // Lista produtos da seção origem.
  const { data: srcProducts, error: pErr } = await supabaseAny
    .from("catalog_products")
    .select("id")
    .eq("section_id", input.sourceSectionId)
    .order("order_index", { ascending: true });
  if (pErr) throw pErr;
  const ids = ((srcProducts ?? []) as { id: string }[]).map((p) => p.id);

  if (!ids.length) {
    return { sectionId: destSectionId, products: [] };
  }

  const products = await createMirrorProducts({
    sourceProductIds: ids,
    destinationVariationId: input.destinationVariationId,
    destinationSectionId: destSectionId,
    mirrorType: "section",
  });

  return { sectionId: destSectionId, products };
}

/** Lista seções de uma variação específica (para o select de origem). */
export async function listSectionsByVariation(variationId: string) {
  const { data, error } = await supabaseAny
    .from("catalog_sections")
    .select("id, title, slug, variation_id, order_index")
    .eq("variation_id", variationId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    variation_id: string;
    order_index: number;
  }>;
}

/** Lista produtos de uma variação específica (para o picker).
 *  Aceita produtos vinculados diretamente (variation_id) OU indiretamente
 *  via seção (section_id → catalog_sections.variation_id), pois produtos
 *  antigos podem não ter variation_id preenchido. */
export async function listProductsByVariation(variationId: string) {
  // 1. Pega todos os ids de seções desta variação.
  const { data: secs, error: secErr } = await supabaseAny
    .from("catalog_sections")
    .select("id")
    .eq("variation_id", variationId);
  if (secErr) throw secErr;
  const sectionIds = ((secs ?? []) as { id: string }[]).map((s) => s.id);

  // 2. Busca produtos. Tenta primeiro com a coluna is_mirror; se a coluna
  //    ainda não existir no banco (migration não rodada), refaz sem ela.
  const baseCols =
    "id, title, slug, product_type, cover_image_url, thumbnail_url, section_id, variation_id, is_published, is_locked, order_index";

  async function runQuery(includeMirror: boolean) {
    const cols = includeMirror ? `${baseCols}, is_mirror` : baseCols;
    let q = supabaseAny
      .from("catalog_products")
      .select(cols)
      .order("order_index", { ascending: true });
    if (sectionIds.length > 0) {
      const inList = sectionIds.join(",");
      q = q.or(
        `variation_id.eq.${variationId},section_id.in.(${inList})`,
      );
    } else {
      q = q.eq("variation_id", variationId);
    }
    return q;
  }

  let { data, error } = await runQuery(true);
  if (error) {
    // Provável: coluna is_mirror não existe ainda. Tenta sem.
    const retry = await runQuery(false);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    product_type: "drawing" | "course" | "ebook" | "download";
    cover_image_url: string | null;
    thumbnail_url: string | null;
    section_id: string | null;
    variation_id: string | null;
    is_published: boolean;
    is_locked: boolean;
    is_mirror: boolean | null;
  }>;
}
