import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useProductOpener } from "@/hooks/use-product-opener";
import { Heart } from "lucide-react";
import {
  useCatalogProducts,
  useUserFavoriteIds,
} from "@/hooks/use-catalog-db";
import { useAuth } from "@/integrations/supabase/auth-context";
import { type CatalogProductRow } from "@/services/catalog-db";
import { AppHeader } from "@/components/app/AppHeader";
import { ProductCard } from "@/components/app/ProductCard";
import { useCatalogProgress } from "@/hooks/use-catalog-progress";
import { useEntitlements } from "@/hooks/use-entitlements";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Favoritos — Reino das Cores" },
      {
        name: "description",
        content: "Suas histórias favoritas, sempre à mão.",
      },
    ],
  }),
  component: FavoritosPage,
});

function FavoritosPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const userId = session?.user?.id;
  const { data: products = [] } = useCatalogProducts();
  const { data: favIds } = useUserFavoriteIds(userId);

  const favorites = React.useMemo(() => {
    if (!favIds) return [];
    return products.filter((p) => favIds.has(p.id));
  }, [products, favIds]);

  const slugs = React.useMemo(() => favorites.map((p) => p.slug), [favorites]);
  const { data: progressMap } = useCatalogProgress(slugs, userId);
  const { data: entitlements } = useEntitlements(userId);
  const accessibleIds = entitlements?.accessibleIds ?? new Set<string>();

  const { openProduct: openProductRaw, lockedDialog } = useProductOpener();
  const open = React.useCallback(
    (p: CatalogProductRow) =>
      openProductRaw(p, { hasAccess: accessibleIds.has(p.id) }),
    [openProductRaw, accessibleIds],
  );

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Favoritos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas histórias salvas aparecem aqui
          </p>
        </header>

        {!session && (
          <EmptyState
            title="Entre para guardar favoritos"
            description="Faça login para favoritar histórias e acessá-las rapidamente."
            actionLabel="Fazer login"
            onAction={() => navigate({ to: "/login" })}
          />
        )}

        {session && favorites.length === 0 && (
          <EmptyState
            title="Nenhum favorito ainda"
            description="Toque no coração de uma história para guardar aqui e acessar rapidinho."
            actionLabel="Explorar histórias"
            onAction={() => navigate({ to: "/buscar" })}
          />
        )}

        {favorites.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 xl:gap-4">
            {favorites.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isFavorite={true}
                userId={userId}
                onClick={() => open(p)}
                progressPercent={progressMap?.get(p.slug)?.percent ?? 0}
                hasAccess={accessibleIds.has(p.id)}
              />
            ))}
          </div>
        )}
      </div>
      {lockedDialog}
    </main>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
        <Heart className="h-7 w-7 text-rose-400" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-sm transition-transform hover:-translate-y-0.5"
      >
        {actionLabel}
      </button>
      <div className="mt-3 text-xs text-muted-foreground">
        ou{" "}
        <Link to="/" className="text-gold underline-offset-2 hover:underline">
          voltar ao início
        </Link>
      </div>
    </div>
  );
}
