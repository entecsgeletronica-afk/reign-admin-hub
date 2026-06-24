// "Desbloquear Mais Histórias" — shows products the user does NOT own yet.
// Cards are darkened with a prominent lock icon and a CTA that opens the
// product's external_url (or product detail page as fallback).

import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Sparkles, Search } from "lucide-react";
import { useAuth } from "@/integrations/supabase/auth-context";
import {
  computeLockedProducts,
  useAllProducts,
  useUserEntitlements,
} from "@/services/purchases";
import { useCatalogSections } from "@/hooks/use-catalog-db";
import { resolveProductCover } from "@/lib/catalog-covers";
import { cn } from "@/lib/utils";
import type { CatalogProductRow } from "@/services/catalog-db";

export const Route = createFileRoute("/perfil/explorar")({
  head: () => ({
    meta: [
      { title: "Desbloquear mais histórias — Reino das Cores" },
      {
        name: "description",
        content:
          "Continue expandindo sua biblioteca com novas aventuras bíblicas.",
      },
    ],
  }),
  component: ExplorarPage,
});

function ExplorarPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: entitlements = [], isLoading: entLoading } =
    useUserEntitlements(userId);
  const { data: products = [], isLoading: prodLoading } = useAllProducts();
  const { data: sections = [] } = useCatalogSections();

  const locked = React.useMemo(
    () => computeLockedProducts(products, entitlements),
    [products, entitlements],
  );

  const [sectionId, setSectionId] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    let list = locked;
    if (sectionId !== "all") {
      list = list.filter((p) => p.section_id === sectionId);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [locked, sectionId, search]);

  const isLoading = entLoading || prodLoading;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full bg-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">
          <Sparkles className="h-3.5 w-3.5" />
          Conteúdo premium disponível
        </div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          Desbloquear mais histórias
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Continue expandindo sua biblioteca com novas aventuras bíblicas.
        </p>
      </header>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar histórias…"
            className="w-full rounded-xl border border-border bg-surface-elevated py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={sectionId === "all"}
            onClick={() => setSectionId("all")}
          >
            Todas
          </Chip>
          {sections.map((s) => (
            <Chip
              key={s.id}
              active={sectionId === s.id}
              onClick={() => setSectionId(s.id)}
            >
              {s.title}
            </Chip>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="aspect-[2/3] animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Tudo desbloqueado por aqui
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Você já tem acesso a todas as histórias disponíveis nesta categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <LockedCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-gold text-gold-foreground"
          : "border border-border bg-surface-elevated text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LockedCard({ product }: { product: CatalogProductRow }) {
  const cover = resolveProductCover(product);

  function handleClick() {
    if (product.external_url) {
      window.open(product.external_url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface text-left transition-transform hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-label={`${product.title} — desbloquear`}
    >
      {cover ? (
        <img
          src={cover}
          alt={product.title}
          className="h-full w-full object-cover brightness-[0.45] saturate-75 transition group-hover:brightness-50"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-surface-elevated to-surface" />
      )}

      {/* Dark overlay refinement */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />

      {/* Lock badge — top right, prominent */}
      <div className="absolute right-2.5 top-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-gold shadow-lg ring-1 ring-gold/40 backdrop-blur">
        <Lock className="h-5 w-5" />
      </div>

      {product.badge_text && (
        <div className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground shadow">
          {product.badge_text}
        </div>
      )}

      {/* Title + CTA */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="line-clamp-2 text-sm font-bold text-white drop-shadow">
          {product.title}
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gold-foreground shadow-lg">
          <Sparkles className="h-3 w-3" />
          Desbloquear agora
        </div>
      </div>
    </button>
  );
}
