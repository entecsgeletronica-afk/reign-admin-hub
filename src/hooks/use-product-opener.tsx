// Centralized "open product" rule used everywhere a learner clicks a card.
//
// The rule (per PRD):
//  • If the product is `is_locked` AND the user does NOT have access →
//    show the "Conteúdo bloqueado" modal (with optional "Ver oferta" CTA).
//  • Else if the product has an `external_url` → open it in a NEW tab
//    (`target="_blank"` + `rel="noopener noreferrer"`), so the learner
//    never leaves the member area.
//  • Else → navigate to the internal `/produto/$slug` page.
//
// Returns:
//  - `openProduct(product, { hasAccess })` to be called from any card
//  - `lockedDialog` JSX you must render once at the page root.

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { LockedContentDialog, type LockedProductInfo } from "@/components/app/LockedContentDialog";
import { useActiveVariation } from "@/integrations/variations/variation-context";
import type { CatalogProductRow } from "@/services/catalog-db";

interface OpenOptions {
  /** Pass `true` if the current user is entitled to this product. */
  hasAccess: boolean;
}

export function useProductOpener() {
  const navigate = useNavigate();
  const variation = useActiveVariation();
  const [lockedProduct, setLockedProduct] = React.useState<LockedProductInfo | null>(
    null,
  );

  const openProduct = React.useCallback(
    (product: CatalogProductRow, opts: OpenOptions) => {
      const blocked = product.is_locked && !opts.hasAccess;

      if (blocked) {
        setLockedProduct({
          title: product.title,
          externalUrl: product.external_url ?? null,
          fallbackSalesUrl: variation.sales_page_url ?? null,
        });
        return;
      }

      // Liberado.
      if (product.external_url && product.external_url.trim()) {
        window.open(product.external_url, "_blank", "noopener,noreferrer");
        return;
      }

      navigate({ to: "/produto/$slug", params: { slug: product.slug } });
    },
    [navigate, variation.sales_page_url],
  );

  const lockedDialog = (
    <LockedContentDialog
      open={lockedProduct !== null}
      onOpenChange={(o) => {
        if (!o) setLockedProduct(null);
      }}
      product={lockedProduct}
    />
  );

  return { openProduct, lockedDialog };
}
