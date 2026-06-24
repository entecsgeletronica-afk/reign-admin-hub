import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Play, Heart, Lock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProductBySlug } from "@/services/catalog-db";
import {
  getStoryBySlug,
  getUserStoryPageStatus,
  type UserPageStatus,
} from "@/services/story-pages";
import { resolveProductCover } from "@/lib/catalog-covers";
import { useAuth } from "@/integrations/supabase/auth-context";
import { useEntitlements } from "@/hooks/use-entitlements";
import { AppHeader } from "@/components/app/AppHeader";
import { cn } from "@/lib/utils";
import { humanTitle } from "@/lib/display-text";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/app/RouteBoundary";
import { CourseView } from "@/components/app/CourseView";
import { EbookView } from "@/components/app/EbookView";

export const Route = createFileRoute("/produto/$slug")({
  component: ProductDetailPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} title="Não foi possível abrir esta história" />
  ),
  notFoundComponent: () => (
    <RouteNotFoundBoundary
      title="História não encontrada"
      description="Este produto pode ter sido removido ou está indisponível."
    />
  ),
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Prefetch story data so the editor opens instantly.
  // Also warm-cache the page's lineart image (the heaviest asset the editor needs).
  const prefetchedImagesRef = React.useRef<Set<string>>(new Set());
  const prefetchStory = React.useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ["story", slug],
      queryFn: () => getStoryBySlug(slug),
      staleTime: 5 * 60_000,
    });
  }, [queryClient, slug]);

  const prefetchPageImage = React.useCallback((url: string | null) => {
    if (!url || prefetchedImagesRef.current.has(url)) return;
    prefetchedImagesRef.current.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }, []);

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ["catalog", "product", slug],
    queryFn: () => getProductBySlug(slug),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const { data: story, isLoading: loadingStory } = useQuery({
    queryKey: ["story", slug],
    queryFn: () => getStoryBySlug(slug),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const { data: pageStatus } = useQuery({
    queryKey: ["story-progress", slug, userId],
    queryFn: () =>
      userId
        ? getUserStoryPageStatus(userId, slug)
        : Promise.resolve(new Map<number, UserPageStatus["status"]>()),
    enabled: !!story,
    staleTime: 60_000,
  });

  const { data: entitlements } = useEntitlements(userId ?? undefined);
  const hasAccess = product
    ? !product.is_locked || (entitlements?.accessibleIds.has(product.id) ?? false)
    : true;

  const loading = loadingProduct || loadingStory;
  const cover = product ? resolveProductCover(product) : null;
  const pages = story?.pages ?? [];

  // Progress + next page
  const completedCount = React.useMemo(() => {
    if (!pageStatus) return 0;
    let n = 0;
    for (const v of pageStatus.values()) if (v === "completed") n += 1;
    return n;
  }, [pageStatus]);

  const totalPages = pages.length;
  const percent = totalPages > 0 ? Math.round((completedCount / totalPages) * 100) : 0;

  // "AQUI": next not-completed page (or first one if none done yet)
  const nextPageNumber = React.useMemo(() => {
    if (totalPages === 0) return null;
    for (const p of pages) {
      const s = pageStatus?.get(p.page_number);
      if (s !== "completed") return p.page_number;
    }
    return null; // all done
  }, [pages, pageStatus, totalPages]);

  const ageLabel = formatAge(story);
  const description =
    story?.description ?? story?.short_description ?? product?.description ?? null;
  const subtitle = story?.subtitle ?? product?.subtitle ?? null;

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      {loading ? (
        <div className="py-24 text-center text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : !product && !story ? (
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground">
          História não encontrada.
        </div>
      ) : product?.product_type === "course" ? (
        <CourseView product={product} hasAccess={hasAccess} />
      ) : product?.product_type === "ebook" ? (
        <EbookView product={product} hasAccess={hasAccess} />
      ) : (
        <>
          {/* HERO — full width cinematográfico */}
          <section className="relative isolate w-full overflow-hidden min-h-screen flex items-end">
            <div
              className="absolute inset-0 -z-10 bg-cover bg-center"
              style={{
                backgroundImage: cover ? `url(${cover})` : undefined,
              }}
              aria-hidden
            />
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-transparent"
              aria-hidden
            />
            <div
              className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-b from-transparent via-background/60 to-background"
              aria-hidden
            />

            <div className="relative w-full px-4 pb-20 pt-24 sm:px-8 sm:pb-24 lg:px-16 lg:pb-32 lg:pt-40">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated/70 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>

              <div className="mt-8 max-w-3xl space-y-5">
                <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                  {product?.title ?? story?.title}
                </h1>
                {subtitle && (
                  <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                    {subtitle}
                  </p>
                )}

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.18em]">
                  {ageLabel && (
                    <span className="text-muted-foreground">{ageLabel}</span>
                  )}
                  {totalPages > 0 && (
                    <>
                      <span className="text-border">•</span>
                      <span className="text-muted-foreground">
                        {totalPages} páginas
                      </span>
                    </>
                  )}
                  <span className="text-border">•</span>
                  <span className="text-gold">{percent}% concluído</span>
                </div>

                {description && (
                  <p className="max-w-[640px] text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-3">
                  {!hasAccess ? (
                    product?.external_url ? (
                      <a
                        href={product.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl bg-gold px-7 py-4 text-base font-semibold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
                      >
                        <Lock className="h-5 w-5" />
                        Adquirir acesso
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated/80 px-6 py-4 text-base font-semibold text-muted-foreground backdrop-blur">
                        <Lock className="h-5 w-5" />
                        Conteúdo bloqueado
                      </div>
                    )
                  ) : (
                    nextPageNumber !== null && (
                      <Link
                        to="/pintar/$slug/$page"
                        params={{ slug, page: String(nextPageNumber) }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gold px-7 py-4 text-base font-semibold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        {completedCount === 0 ? "Começar a colorir" : "Continue colorindo"}
                      </Link>
                    )
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-elevated/80 px-6 py-4 text-base font-semibold text-foreground backdrop-blur transition hover:bg-accent"
                  >
                    <Heart className="h-5 w-5" />
                    Adicionar aos favoritos
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Pages grid — full width */}
          <section className="w-full px-4 pb-20 pt-12 sm:px-8 lg:px-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
                  Escolha uma cena
                </h2>
                <p className="mt-1 text-base text-muted-foreground">
                  Toque em qualquer página para começar a colorir
                </p>
              </div>
              {totalPages > 0 && (
                <div className="text-right">
                  <div className="text-4xl font-bold text-gold leading-none sm:text-5xl">
                    {completedCount}
                    <span className="text-lg font-medium text-muted-foreground">
                      /{totalPages}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Coloridas
                  </div>
                </div>
              )}
            </div>

            {totalPages === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center text-sm text-muted-foreground">
                As páginas desta história ainda não foram cadastradas.
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:gap-4">
                {pages.map((p) => {
                  const status = pageStatus?.get(p.page_number) ?? "not_started";
                  const isNext = p.page_number === nextPageNumber;
                  const isDone = status === "completed";
                  const imgSrc =
                    p.image_preview_url ||
                    p.image_lineart_url ||
                    p.image_colored_sample_url ||
                    null;

                  const lineart = p.image_lineart_url;
                  const handlePrefetch = () => {
                    prefetchStory();
                    prefetchPageImage(lineart);
                  };
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!hasAccess}
                      onMouseEnter={hasAccess ? handlePrefetch : undefined}
                      onTouchStart={hasAccess ? handlePrefetch : undefined}
                      onFocus={hasAccess ? handlePrefetch : undefined}
                      onClick={() => {
                        if (!hasAccess) return;
                        navigate({
                          to: "/pintar/$slug/$page",
                          params: { slug, page: String(p.page_number) },
                        });
                      }}
                      className={cn(
                        "group relative flex aspect-square flex-col overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition-all duration-150",
                        hasAccess && "hover:-translate-y-1 hover:shadow-xl active:scale-[0.96] active:shadow-md",
                        !hasAccess && "cursor-not-allowed opacity-70",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                        isNext && hasAccess ? "border-gold ring-2 ring-gold/40" : "border-border",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-2 top-2 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                          isDone
                            ? "bg-success text-success-foreground"
                            : isNext
                              ? "bg-gold text-gold-foreground"
                              : "bg-foreground/10 text-foreground/70 backdrop-blur",
                        )}
                      >
                        {p.page_number}
                      </span>
                      {!hasAccess ? (
                        <span className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-full bg-black/75 p-1.5 text-white shadow ring-1 ring-white/20 backdrop-blur">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : isNext ? (
                        <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-attention px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-attention-foreground shadow">
                          <span aria-hidden>↪</span> Aqui
                        </span>
                      ) : null}
                      <div className="relative h-full w-full bg-white">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={humanTitle(p.title, `Página ${p.page_number}`)}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.03] group-active:scale-95"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                            sem imagem
                          </div>
                        )}
                        {/* Overlay label */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-3 py-2 text-xs">
                          <div className={cn("font-semibold", isNext ? "text-gold" : "text-white")}>
                            {isNext ? "Continuar" : humanTitle(p.title, `Página ${p.page_number}`)}
                          </div>
                        </div>

                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function formatAge(story: { age_range?: string | null; age_min?: number | null; age_max?: number | null } | null | undefined): string | null {
  if (!story) return null;
  if (story.age_range && story.age_range.trim()) return `${story.age_range} anos`;
  if (story.age_min != null && story.age_max != null) {
    return `${story.age_min}-${story.age_max} anos`;
  }
  if (story.age_min != null) return `${story.age_min}+ anos`;
  return null;
}
