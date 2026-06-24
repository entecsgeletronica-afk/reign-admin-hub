import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveProductCover } from "@/lib/catalog-covers";
import { toggleFavorite, type CatalogProductRow } from "@/services/catalog-db";

interface Props {
  product: CatalogProductRow;
  isFavorite: boolean;
  userId: string | undefined;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  /** Progresso 0..100 do quanto a criança já coloriu desta história. */
  progressPercent?: number;
  /**
   * Whether the current user owns/has access to this product.
   * If undefined we fall back to "no access" for locked products.
   */
  hasAccess?: boolean;
}

export function ProductCard({
  product,
  isFavorite,
  userId,
  onClick,
  size = "md",
  progressPercent = 0,
  hasAccess = false,
}: Props) {
  const qc = useQueryClient();
  // "Locked" in the UI = product is gated AND user has no entitlement.
  // Owned products show no lock icon even if the catalog flags them locked.
  const locked = product.is_locked && !hasAccess;
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));

  const favMutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) return;
      await toggleFavorite(userId, product.id, next);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog", "favorites", userId] });
    },
  });

  const cover = resolveProductCover(product);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-border bg-surface text-left",
        "transition-transform hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
      )}
      aria-label={`${product.title} — abrir`}
    >
      {cover ? (
        <img
          src={cover}
          alt={product.title}
          className={cn(
            "h-full w-full object-cover transition",
            locked && "brightness-[0.5] saturate-75",
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-elevated to-surface text-xs text-muted-foreground">
          sem capa
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {userId && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            favMutation.mutate(!isFavorite);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              favMutation.mutate(!isFavorite);
            }
          }}
          className="absolute left-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow ring-1 ring-white/10 backdrop-blur transition hover:bg-black/80"
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart
            className={cn("h-4 w-4", isFavorite ? "fill-rose-500 text-rose-500" : "")}
          />
        </span>
      )}

      {locked && (
        <div className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-white shadow-lg ring-1 ring-white/20 backdrop-blur">
          <Lock className="h-4 w-4" />
        </div>
      )}

      {product.badge_text && (
        <div className="absolute left-12 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold-foreground shadow">
          {product.badge_text}
        </div>
      )}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 p-3 pb-4",
          size === "lg" && "p-4 pb-5",
          size === "sm" && "p-2 pb-3",
        )}
      >
        <div
          className={cn(
            "line-clamp-2 font-semibold text-white drop-shadow",
            size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {product.title}
        </div>
      </div>

      {/* Barra de progresso fina dourada — sempre visível no rodapé */}
      <div
        className="absolute inset-x-0 bottom-0 h-1 bg-white/15"
        aria-hidden="true"
      >
        <div
          className="h-full bg-gold transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="sr-only">
        {pct === 0 ? "Ainda não iniciado" : `${pct}% colorido`}
      </span>
    </button>
  );
}
