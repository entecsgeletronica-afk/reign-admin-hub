// Helpers de espelhamento usados pelos viewers (curso, e-book, desenho).
//
// Regra: o conteúdo (aulas, PDFs, páginas de história) é resolvido pelo
// produto ORIGINAL (source_product_id) quando o produto atual é um espelho
// com content_source = "mirror". Já entitlements, progresso de visualização
// (user_recent_products) e analytics continuam usando o id do espelho — para
// manter a separação de progresso e liberação por área.

import type { CatalogProductRow } from "@/services/catalog-db";

/** ID a ser usado para CARREGAR conteúdo (aulas/PDFs/páginas). */
export function getContentProductId(product: CatalogProductRow): string {
  if (product.is_mirror && product.content_source === "mirror" && product.source_product_id) {
    return product.source_product_id;
  }
  return product.id;
}

/** Indica se o produto atual é um espelho leve (UI badges/avisos). */
export function isMirrorProduct(product: CatalogProductRow): boolean {
  return Boolean(product.is_mirror);
}
