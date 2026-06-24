// Home/catálogo da área de membros.
//
// É a tela principal que abre quando:
//  • Um aluno logado entra na área (clica logo, faz login, etc.)
//  • Um admin clica em "Ver como admin" ou "Ver como aluno" no painel.
//
// Comportamento por modo:
//  • ?as=admin → bypass de validação de compra (mostra todos os produtos
//    como liberados — visualização total para o dono do painel).
//  • ?as=user OU sem ?as= (aluno real) → respeita is_locked + entitlements.
//    Produtos não comprados aparecem com cadeado.
//
// Importante: NÃO redireciona para /perfil. Esta é a "home" da área.

import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { HomeSkeleton } from "@/components/app/HomeSkeleton";
import { ProductCard } from "@/components/app/ProductCard";
import {
  useCatalogProductById,
  useCatalogProducts,
  useCatalogSections,
  useHomeSettings,
  useRecentProductIds,
  useUserFavoriteIds,
} from "@/hooks/use-catalog-db";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useAuth } from "@/integrations/supabase/auth-context";
import { useVariations } from "@/integrations/variations/variation-context";
import { resolveProductCover } from "@/lib/catalog-covers";
import { cn } from "@/lib/utils";
import type { CatalogProductRow } from "@/services/catalog-db";
import { listVariationIdsForUser } from "@/services/variations";

const STUDENT_VARIATION_STORAGE_KEY = "rdc:student:active-variation";

type HomeSearch = {
  variation?: string;
  as?: "admin" | "user";
  preview?: string;
};

export const Route = createFileRoute("/home")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const out: HomeSearch = {};
    if (typeof search.variation === "string") out.variation = search.variation;
    if (search.as === "admin" || search.as === "user") out.as = search.as;
    if (typeof search.preview === "string") out.preview = search.preview;
    return out;
  },
  head: () => ({
    meta: [{ title: "Área de membros" }],
  }),
  component: HomePage,
});

function HomePage() {
  const { variation: variationParam, as: viewAs } = Route.useSearch();
  const { session, loading: authLoading, isAdmin } = useAuth();
  const { activeId, setActive, variations } = useVariations();
  const navigate = useNavigate();

  // Sincroniza variação ativa com a query string.
  React.useEffect(() => {
    if (variationParam && variationParam !== activeId) {
      setActive(variationParam);
    }
  }, [variationParam, activeId, setActive]);

  // Aluno não-logado vai pro login. Admin em preview já está logado.
  React.useEffect(() => {
    if (authLoading) return;
    if (!session) {
      const qs = typeof window !== "undefined" ? window.location.search : "";
      window.location.replace(`/login${qs}`);
    }
  }, [authLoading, session]);

  const userId = session?.user?.id;

  // Auto-seleciona a área de membros do aluno com base nos entitlements
  // ativos. Sem isso, o aluno cairia sempre na primeira variação da conta —
  // mesmo que tenha sido liberado para outra (ex.: admin libera "Area de
  // teste Eric" mas o aluno via "Reino das Cores Kids" porque era a 1ª da
  // lista). Não roda para admin (escolhe área no painel) nem quando há
  // ?variation=... explícito (preview/link direto).
  const skipAutoSelect = isAdmin || !!variationParam || !userId;
  const { data: userVariationIds = [], isLoading: userVariationsLoading } = useQuery({
    queryKey: ["user", "variation-ids", userId ?? "anon"],
    queryFn: () => listVariationIdsForUser(userId as string),
    enabled: !skipAutoSelect,
    staleTime: 0,
  });
  const allowedVariationId = React.useMemo(() => {
    if (skipAutoSelect) return variationParam ?? activeId ?? null;
    if (userVariationIds.length === 0) return null;
    // Sempre prioriza a liberação ativa mais recente do aluno. Isso evita
    // que uma área antiga salva no navegador continue aparecendo após o admin
    // liberar o mesmo e-mail em outra área de membros.
    return userVariationIds[0];
  }, [skipAutoSelect, variationParam, activeId, userVariationIds]);
  React.useEffect(() => {
    if (skipAutoSelect) return;
    if (variations.length === 0) return;
    if (userVariationIds.length === 0) return;
    const firstAllowed = variations.find((v) => v.id === allowedVariationId);
    if (firstAllowed && firstAllowed.id !== activeId) {
      setActive(firstAllowed.id);
      try {
        window.localStorage.setItem(STUDENT_VARIATION_STORAGE_KEY, firstAllowed.id);
      } catch {
        // ignore
      }
    }
  }, [skipAutoSelect, variations, userVariationIds, allowedVariationId, activeId, setActive]);

  const variationId = variationParam ?? allowedVariationId ?? activeId ?? null;

  const { data: products = [], isLoading: pLoading } = useCatalogProducts({
    variationId,
  });
  const { data: sections = [], isLoading: sLoading } = useCatalogSections({
    variationId,
  });
  const { data: home } = useHomeSettings(variationId);
  const { data: favIds } = useUserFavoriteIds(userId);
  const { data: ent } = useEntitlements(userId);
  const { data: recentIds = [] } = useRecentProductIds(userId, 12);

  // Lista de produtos para "Continue colorindo": preserva ordem dos recentes
  // e, quando o usuário ainda não abriu nada, cai no fallback configurado.
  const continueProducts = React.useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const fromRecent = recentIds
      .map((id) => byId.get(id))
      .filter((p): p is CatalogProductRow => !!p && p.is_published);
    if (fromRecent.length > 0) return fromRecent.slice(0, 12);
    if (home?.continue_fallback_product_id) {
      const fb = byId.get(home.continue_fallback_product_id);
      if (fb && fb.is_published) return [fb];
    }
    return [];
  }, [recentIds, products, home?.continue_fallback_product_id]);

  // Modo admin (preview): força acesso total ignorando entitlements.
  // Modo user (preview ou aluno real): respeita entitlements + is_locked.
  const adminPreview = viewAs === "admin";
  const accessibleIds = ent?.accessibleIds ?? new Set<string>();

  function open(p: CatalogProductRow) {
    const hasAccess = adminPreview || accessibleIds.has(p.id) || !p.is_locked;
    if (!hasAccess && p.external_url) {
      window.open(p.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!hasAccess) {
      navigate({ to: "/produto/$slug", params: { slug: p.slug } });
      return;
    }
    navigate({ to: "/produto/$slug", params: { slug: p.slug } });
  }

  const featuredFromList = React.useMemo(() => {
    if (!home?.featured_product_id) return null;
    return products.find((p) => p.id === home.featured_product_id) ?? null;
  }, [home, products]);

  // Se o featured não está no array (ex.: despublicado, em outra variação,
  // ou ainda não chegou na query), busca direto pelo id para garantir que
  // a imagem do hero apareça igual ao preview do admin.
  const needsFetchFeatured = !!home?.featured_product_id && !featuredFromList;
  const { data: featuredFetched } = useCatalogProductById(
    needsFetchFeatured ? home?.featured_product_id : null,
  );
  const featured = featuredFromList ?? featuredFetched ?? null;

  const productsBySection = React.useMemo(() => {
    const map = new Map<string, CatalogProductRow[]>();
    for (const p of products) {
      if (!p.is_published) continue;
      const key = p.section_id ?? "_none";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order_index - b.order_index);
    }
    return map;
  }, [products]);

  if (authLoading || (!session && !authLoading)) {
    return <HomeSkeleton />;
  }

  if (!skipAutoSelect && userVariationsLoading) {
    return <HomeSkeleton />;
  }

  if (!skipAutoSelect && allowedVariationId && activeId !== allowedVariationId) {
    return <HomeSkeleton />;
  }

  if (pLoading || sLoading) {
    return (
      <main className="min-h-screen bg-background">
        <AppHeader />
        <HomeSkeleton />
      </main>
    );
  }

  const heroTitle = home?.hero_title ?? "Bem-vindo à área de membros";
  const heroSubtitle =
    home?.hero_subtitle ?? "Explore o catálogo completo de conteúdos disponíveis.";
  const heroLabel = home?.hero_label ?? null;
  const heroBtn = home?.hero_button_label ?? "Começar agora";
  // Fallback igual ao preview do admin: hero customizado → banner do produto
  // em destaque → capa do produto em destaque. Garante que a home nunca
  // fica vazia quando há um produto em destaque configurado.
  const heroImage =
    home?.hero_image_url || featured?.hero_image_url || resolveProductCover(featured) || null;

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero */}
      <section className="relative isolate w-full overflow-hidden border-b border-border bg-background">
        {heroImage && (
          <>
            {/* Imagem do banner — opacidade controlada pelo admin
                (100% = totalmente visível, 0% = invisível). */}
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover"
              style={{ opacity: home?.hero_overlay_opacity ?? 1 }}
            />
            {/* Overlay escuro fixo para garantir leitura do texto. */}
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/25"
              aria-hidden
            />
          </>
        )}
        {!heroImage && (
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-br from-surface-elevated/40 via-background to-background"
            aria-hidden
          />
        )}
        <div className="relative w-full px-4 pt-16 pb-12 sm:px-8 sm:pt-20 sm:pb-16 lg:px-16 lg:pt-24 lg:pb-20">
          <div className="max-w-3xl space-y-4">
            {heroLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                {heroLabel}
              </span>
            )}
            <h1
              className={cn(
                "text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl",
                heroImage ? "text-white drop-shadow" : "text-foreground",
              )}
            >
              {heroTitle}
            </h1>
            <p
              className={cn(
                "max-w-xl text-base sm:text-lg",
                heroImage ? "text-white/85" : "text-muted-foreground",
              )}
            >
              {heroSubtitle}
            </p>
            {featured && (
              <button
                type="button"
                onClick={() => open(featured)}
                className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gold px-6 text-sm font-bold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                {heroBtn}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Seções com produtos */}
      <div className="w-full space-y-12 px-4 py-10 sm:px-8 lg:px-16">
        {/* Continue colorindo: produtos abertos recentemente pelo usuário,
            com fallback para o produto configurado no admin. */}
        {continueProducts.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Continue colorindo</h2>
            </div>
            <ProductGrid
              products={continueProducts}
              userId={userId}
              favIds={favIds}
              accessibleIds={accessibleIds}
              adminPreview={adminPreview}
              onOpen={open}
            />
          </section>
        )}

        {sections.length === 0 && productsBySection.size === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-bold text-foreground">Nenhum produto cadastrado ainda</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Cadastre seções e produtos no painel para vê-los aqui.
            </p>
          </div>
        )}

        {sections.map((sec) => {
          const items = productsBySection.get(sec.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={sec.id}>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">{sec.title}</h2>
                {sec.subtitle && <p className="text-sm text-muted-foreground">{sec.subtitle}</p>}
              </div>
              <ProductGrid
                products={items}
                userId={userId}
                favIds={favIds}
                accessibleIds={accessibleIds}
                adminPreview={adminPreview}
                onOpen={open}
              />
            </section>
          );
        })}

        {/* Produtos sem seção */}
        {(productsBySection.get("_none")?.length ?? 0) > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-bold text-foreground sm:text-2xl">Outros produtos</h2>
            </div>
            <ProductGrid
              products={productsBySection.get("_none") ?? []}
              userId={userId}
              favIds={favIds}
              accessibleIds={accessibleIds}
              adminPreview={adminPreview}
              onOpen={open}
            />
          </section>
        )}
      </div>
    </main>
  );
}

function ProductGrid({
  products,
  userId,
  favIds,
  accessibleIds,
  adminPreview,
  onOpen,
}: {
  products: CatalogProductRow[];
  userId: string | undefined;
  favIds: Set<string> | undefined;
  accessibleIds: Set<string>;
  adminPreview: boolean;
  onOpen: (p: CatalogProductRow) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4">
      {products.map((p) => {
        // Em modo admin: tudo liberado.
        // Em modo user: respeita is_locked + entitlements.
        const hasAccess = adminPreview || !p.is_locked || accessibleIds.has(p.id);
        return (
          <ProductCard
            key={p.id}
            product={p}
            isFavorite={favIds?.has(p.id) ?? false}
            userId={userId}
            hasAccess={hasAccess}
            onClick={() => onOpen(p)}
          />
        );
      })}
    </div>
  );
}
