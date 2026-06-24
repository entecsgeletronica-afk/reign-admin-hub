// Fallback de capas iniciais para os produtos do catálogo (Fase 1).
// Mapeamos slug → asset bundlado pelo Vite, usado quando o produto
// ainda não tem `cover_image_url` definido pelo admin no banco.

import arcaDeNoe from "@/assets/catalog/arca-de-noe.png";
import bomSamaritano from "@/assets/catalog/bom-samaritano.png";
import criacaoDoMundo from "@/assets/catalog/criacao-do-mundo.png";
import danielLeoes from "@/assets/catalog/daniel-leoes.png";
import daviEGolias from "@/assets/catalog/davi-e-golias.png";
import esterRainha from "@/assets/catalog/ester-rainha.png";
import filhoProdigo from "@/assets/catalog/filho-prodigo.png";
import jesusCriancas from "@/assets/catalog/jesus-criancas.png";
import jesusTempestade from "@/assets/catalog/jesus-tempestade.png";
import jonasBaleia from "@/assets/catalog/jonas-baleia.png";
import moisesMarVermelho from "@/assets/catalog/moises-mar-vermelho.png";
import multiplicacaoPaes from "@/assets/catalog/multiplicacao-paes.png";
import nascimentoJesus from "@/assets/catalog/nascimento-jesus.png";
import ovelhaPerdida from "@/assets/catalog/ovelha-perdida.png";

const SEED_COVERS: Record<string, string> = {
  "arca-de-noe": arcaDeNoe,
  "o-bom-samaritano": bomSamaritano,
  "a-criacao-do-mundo": criacaoDoMundo,
  "daniel-na-cova-dos-leoes": danielLeoes,
  "davi-e-golias": daviEGolias,
  "ester-rainha-corajosa": esterRainha,
  "o-filho-prodigo": filhoProdigo,
  "jesus-e-as-criancas": jesusCriancas,
  "jesus-acalma-a-tempestade": jesusTempestade,
  "jonas-e-a-baleia": jonasBaleia,
  "moises-e-o-mar-vermelho": moisesMarVermelho,
  "a-multiplicacao-dos-paes": multiplicacaoPaes,
  "o-nascimento-de-jesus": nascimentoJesus,
  "a-ovelha-perdida": ovelhaPerdida,
};

/**
 * Resolve a URL da capa de um produto do catálogo.
 * Ordem de prioridade:
 *  1. cover_image_url (definido pelo admin no banco)
 *  2. thumbnail_url (capa secundária; usada por produtos antigos)
 *  3. asset bundlado pelo Vite via SEED_COVERS[slug]
 *  4. null (renderiza placeholder "sem capa")
 *
 * Caminhos legados começando com /catalog/ são ignorados porque não são
 * servidos pelo preview autenticado.
 */
export function resolveProductCover(
  product:
    | {
        slug: string;
        cover_image_url?: string | null;
        thumbnail_url?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!product) return null;
  const isUsable = (u?: string | null) => {
    const v = u?.trim();
    return !!v && !v.startsWith("/catalog/");
  };
  if (isUsable(product.cover_image_url)) return product.cover_image_url!.trim();
  if (isUsable(product.thumbnail_url)) return product.thumbnail_url!.trim();
  return SEED_COVERS[product.slug] ?? null;
}
