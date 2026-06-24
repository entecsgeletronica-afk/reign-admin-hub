import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useProductOpener } from "@/hooks/use-product-opener";
import { Search, LayoutGrid, Grid3x3, Grid2x2 } from "lucide-react";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar — Reino das Cores" },
      {
        name: "description",
        content: "Encontre uma história pelo nome, personagem ou tema bíblico.",
      },
    ],
  }),
  component: BuscarPage,
});

type GridSize = "sm" | "md" | "lg";

function BuscarPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { openProduct: openProductRaw, lockedDialog } = useProductOpener();
  const { data: products = [] } = useCatalogProducts();
  const { data: favIds } = useUserFavoriteIds(userId);
  const slugs = React.useMemo(() => products.map((p) => p.slug), [products]);
  const { data: progressMap } = useCatalogProgress(slugs, userId);
  const { data: entitlements } = useEntitlements(userId);
  const accessibleIds = entitlements?.accessibleIds ?? new Set<string>();

  const [query, setQuery] = React.useState("");
  const [size, setSize] = React.useState<GridSize>("md");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        p.title.toLowerCase().includes(q) ||
        (p.subtitle ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  const open = React.useCallback(
    (p: CatalogProductRow) =>
      openProductRaw(p, { hasAccess: accessibleIds.has(p.id) }),
    [openProductRaw, accessibleIds],
  );

  const gridClass =
    size === "sm"
      ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2"
      : size === "lg"
        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 gap-3";

  return (
    <main className="min-h-screen bg-background">
      <AppHeader />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Buscar histórias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontre uma história pelo nome, personagem ou tema bíblico
          </p>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Noé, Jesus, baleia..."
            className="w-full rounded-2xl border border-border bg-surface py-4 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {filtered.length} histórias disponíveis
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            <SizeButton
              active={size === "sm"}
              onClick={() => setSize("sm")}
              label="Compacto"
            >
              <LayoutGrid className="h-4 w-4" />
            </SizeButton>
            <SizeButton
              active={size === "md"}
              onClick={() => setSize("md")}
              label="Médio"
            >
              <Grid3x3 className="h-4 w-4" />
            </SizeButton>
            <SizeButton
              active={size === "lg"}
              onClick={() => setSize("lg")}
              label="Grande"
            >
              <Grid2x2 className="h-4 w-4" />
            </SizeButton>
          </div>
        </div>

        <div className={cn("mt-5 grid", gridClass)}>
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isFavorite={favIds?.has(p.id) ?? false}
              userId={userId}
              onClick={() => open(p)}
              size={size}
              progressPercent={progressMap?.get(p.slug)?.percent ?? 0}
              hasAccess={accessibleIds.has(p.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface px-4 py-16 text-center text-sm text-muted-foreground">
            Nenhuma história encontrada para “{query}”.
          </div>
        )}
      </div>
      {lockedDialog}
    </main>
  );
}

function SizeButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
        active
          ? "bg-gold text-gold-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
