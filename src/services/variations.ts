import { supabase } from "@/integrations/supabase/client";

/**
 * Service layer for "Áreas de Membros" (variations).
 * Multi-tenant leve: all rows share the default account_id for now.
 * When real accounts arrive, swap `DEFAULT_ACCOUNT_ID` for the active one.
 */
export const DEFAULT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";
export const MAX_VARIATIONS_PER_ACCOUNT = Infinity;

/**
 * Slugs de áreas que NÃO podem ser excluídas (área principal do produto).
 * Edição continua permitida — apenas o delete é bloqueado.
 */
export const PROTECTED_VARIATION_SLUGS = ["reino-das-cores-kids"] as const;

export function isProtectedVariation(slug: string): boolean {
  return (PROTECTED_VARIATION_SLUGS as readonly string[]).includes(slug);
}

export type VariationStatus = "active" | "draft" | "paused";
export type VariationPrimaryType = "mixed" | "drawing" | "course" | "download";
export type DomainMode = "subdomain" | "custom" | "path";
export type LoginLayoutMode = "split-right" | "split-left" | "top" | "centered";
export type LoginBackgroundMode = "solid" | "gradient" | "image";
export type ThemeMode = "light" | "dark" | "auto";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type AccessType =
  | "public"
  | "restricted_purchase"
  | "restricted_offer"
  | "restricted_manual";
export type NoAccessBehavior = "show_locked" | "hide" | "show_sales_page";

export type Microcopy = Partial<{
  welcome: string;
  continue: string;
  locked: string;
  completion: string;
  congrats: string;
  support: string;
  signin_button: string;
}>;

export type Variation = {
  id: string;
  account_id: string;
  title: string;
  slug: string;
  description: string | null;
  short_label: string | null;
  primary_type: VariationPrimaryType;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  default_locale: string;
  status: VariationStatus;
  order_index: number;
  created_at: string;
  updated_at: string;

  // Subdomain / domain fields
  subdomain_key: string | null;
  root_domain: string | null;
  domain_mode: DomainMode;

  // Branding extras
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
  favicon_url: string | null;
  sidebar_color: string | null;
  card_color: string | null;

  // Languages enabled for this area
  enabled_languages: string[];

  // Login screen settings
  login_image_url: string | null;
  login_title: string | null;
  login_subtitle: string | null;
  login_email_placeholder: string | null;
  login_password_placeholder: string | null;
  login_submit_label: string | null;
  login_helper_text: string | null;
  login_footer_text: string | null;
  login_layout_mode: LoginLayoutMode;
  login_background_mode: LoginBackgroundMode;

  // Phase 2: per-area configuration
  is_primary: boolean;
  date_format: DateFormat;
  theme_mode: ThemeMode;
  muted_text_color: string | null;
  support_email: string | null;
  app_name: string | null;
  logo_alt: string | null;
  access_type: AccessType;
  no_access_behavior: NoAccessBehavior;
  sales_page_url: string | null;
  microcopy_json: Microcopy;
};

export type VariationInput = {
  title: string;
  slug: string;
  description?: string | null;
  short_label?: string | null;
  primary_type?: VariationPrimaryType;
  logo_url?: string | null;
  hero_image_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  default_locale?: string;
  status?: VariationStatus;
  order_index?: number;
  subdomain_key?: string | null;
  root_domain?: string | null;
  domain_mode?: DomainMode;
  is_primary?: boolean;
  app_name?: string | null;
  logo_alt?: string | null;
  support_email?: string | null;
};

export type LoginSettingsInput = Partial<{
  background_color: string | null;
  surface_color: string | null;
  text_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
  favicon_url: string | null;
  logo_url: string | null;
  login_image_url: string | null;
  login_title: string | null;
  login_subtitle: string | null;
  login_email_placeholder: string | null;
  login_password_placeholder: string | null;
  login_submit_label: string | null;
  login_helper_text: string | null;
  login_footer_text: string | null;
  login_layout_mode: LoginLayoutMode;
  login_background_mode: LoginBackgroundMode;
  primary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
  card_color: string | null;
  default_locale: string;
  enabled_languages: string[];
  // Phase 2
  date_format: DateFormat;
  theme_mode: ThemeMode;
  muted_text_color: string | null;
  support_email: string | null;
  app_name: string | null;
  logo_alt: string | null;
  access_type: AccessType;
  no_access_behavior: NoAccessBehavior;
  sales_page_url: string | null;
  microcopy_json: Microcopy;
}>;

export async function listVariations(): Promise<Variation[]> {
  const { data, error } = await supabase
    .from("member_area_variations")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Variation[];
}

/**
 * Devolve os IDs das variações (áreas de membros) onde o usuário tem
 * pelo menos um produto com entitlement ativo.
 *
 * Usado no boot da área de membros para auto-selecionar a área certa quando
 * o aluno foi liberado para uma variação específica (ex.: "Area de teste
 * Eric") em vez de cair na variação padrão (primeira da lista).
 *
 * A ordem é importante: a área com liberação mais recente vem primeiro.
 * Assim, quando o mesmo e-mail foi usado em testes antigos, o login do aluno
 * abre a área recém-liberada em vez de ficar preso na área salva no navegador.
 */
export async function listVariationIdsForUser(userId: string): Promise<string[]> {
  // 1) Pega todos os product_ids ativos do usuário, ordenados pela liberação
  // mais recente. Também ignora acessos expirados.
  const { data: ents, error: entsErr } = await supabase
    .from("user_product_entitlements")
    .select("product_id, granted_at, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("granted_at", { ascending: false });
  if (entsErr) {
    console.warn("[variations] listVariationIdsForUser ents error:", entsErr.message);
    return [];
  }
  const now = Date.now();
  const productIds = Array.from(
    new Set(
      ((ents ?? []) as { product_id: string; expires_at: string | null }[])
        .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
        .map((r) => r.product_id),
    ),
  );
  if (productIds.length === 0) return [];

  // 2) Busca variation_id desses produtos. Quando produtos antigos ainda não
  // têm variation_id, resolvemos pela seção.
  const { data: prods, error: prodsErr } = await supabase
    .from("catalog_products")
    .select("id, variation_id, section_id")
    .in("id", productIds);
  if (prodsErr) {
    console.warn("[variations] listVariationIdsForUser prods error:", prodsErr.message);
    return [];
  }
  const productRows = (prods ?? []) as {
    id: string;
    variation_id: string | null;
    section_id: string | null;
  }[];
  const sectionIds = Array.from(
    new Set(
      productRows.filter((p) => !p.variation_id && p.section_id).map((p) => p.section_id as string),
    ),
  );
  const sectionVariation = new Map<string, string>();
  if (sectionIds.length > 0) {
    const { data: secs, error: secsErr } = await supabase
      .from("catalog_sections")
      .select("id, variation_id")
      .in("id", sectionIds);
    if (!secsErr) {
      for (const s of (secs ?? []) as { id: string; variation_id: string | null }[]) {
        if (s.variation_id) sectionVariation.set(s.id, s.variation_id);
      }
    }
  }

  const variationByProduct = new Map<string, string>();
  for (const p of productRows) {
    const variationId =
      p.variation_id ?? (p.section_id ? sectionVariation.get(p.section_id) : null);
    if (variationId) variationByProduct.set(p.id, variationId);
  }

  const ids = new Set<string>();
  for (const productId of productIds) {
    const variationId = variationByProduct.get(productId);
    if (variationId) ids.add(variationId);
  }
  return Array.from(ids);
}

export async function createVariation(input: VariationInput): Promise<Variation> {
  const subdomain = (input.subdomain_key ?? subdomainize(input.slug || input.title)).trim();
  const { data, error } = await supabase
    .from("member_area_variations")
    .insert({
      account_id: DEFAULT_ACCOUNT_ID,
      title: input.title,
      slug: input.slug,
      description: input.description ?? null,
      short_label: input.short_label ?? null,
      primary_type: input.primary_type ?? "mixed",
      logo_url: input.logo_url ?? null,
      hero_image_url: input.hero_image_url ?? null,
      primary_color: input.primary_color ?? null,
      secondary_color: input.secondary_color ?? null,
      accent_color: input.accent_color ?? null,
      default_locale: input.default_locale ?? "pt-BR",
      status: input.status ?? "draft",
      order_index: input.order_index ?? 0,
      subdomain_key: subdomain || null,
      root_domain: input.root_domain ?? null,
      domain_mode: input.domain_mode ?? "subdomain",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as Variation;
}

export async function updateVariation(
  id: string,
  input: Partial<VariationInput>,
): Promise<Variation> {
  const patch = { ...input };
  if (typeof input.subdomain_key === "string") {
    patch.subdomain_key = subdomainize(input.subdomain_key) || null;
  }
  const { data, error } = await supabase
    .from("member_area_variations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as Variation;
}

export async function updateLoginSettings(
  id: string,
  input: LoginSettingsInput,
): Promise<Variation> {
  const { data, error } = await supabase
    .from("member_area_variations")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Variation;
}

export async function deleteVariation(id: string): Promise<void> {
  // Defense-in-depth: bloqueia exclusão de áreas protegidas mesmo se chamado direto.
  const { data: existing, error: fetchError } = await supabase
    .from("member_area_variations")
    .select("slug")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;
  if (existing && isProtectedVariation(existing.slug)) {
    throw new Error(
      "Esta área é protegida e não pode ser excluída (produto principal de desenhos).",
    );
  }

  const { error } = await supabase.from("member_area_variations").delete().eq("id", id);
  if (error) throw error;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Converte um nome ou slug em um identificador de subdomínio válido:
 * apenas letras minúsculas e números (sem hífens, sem acentos, sem espaços).
 * Ex.: "Desafio 24 Dias" -> "desafio24dias"
 *      "reino-das-cores-kids" -> "reinodascoreskids"
 */
export function subdomainize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Constrói o preview da URL completa da área de membros.
 * Quando não há root_domain configurado, retorna um placeholder.
 */
export function buildFullDomainPreview(
  subdomainKey: string | null | undefined,
  rootDomain: string | null | undefined,
): string {
  const sub = (subdomainKey ?? "").trim();
  const root = (rootDomain ?? "").trim();
  if (!sub) return "[subdominio].[seu-dominio].com";
  if (!root) return `app.${sub}.[seu-dominio].com`;
  return `app.${sub}.${root}`;
}
