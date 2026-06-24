-- Espelhamento de produtos entre áreas de membros.
--
-- Cada produto pode ser uma "cópia leve" de outro: aponta para o produto
-- original via source_product_id e herda o conteúdo (story_id, aulas, ebook),
-- mas mantém metadados, capa, oferta, plano e publicação independentes.
--
-- Regras:
--  • is_mirror = true  → linha é um espelho.
--  • content_source = 'mirror' → leitura de conteúdo deve resolver pelo source.
--  • inherited_cover = true   → atualizar capa do source propaga para o espelho
--                               (ainda não auto-aplicado; flag para uso futuro).
--  • mirror_type informa se veio de espelhamento individual ou de seção.

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS is_mirror boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_product_id uuid NULL
    REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mirror_type text NULL
    CHECK (mirror_type IN ('product', 'section')),
  ADD COLUMN IF NOT EXISTS content_source text NOT NULL DEFAULT 'own'
    CHECK (content_source IN ('own', 'mirror')),
  ADD COLUMN IF NOT EXISTS inherited_cover boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_catalog_products_source ON public.catalog_products(source_product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_is_mirror ON public.catalog_products(is_mirror);

-- Não permite que um produto seja espelho de si mesmo.
ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_no_self_mirror;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_no_self_mirror
    CHECK (source_product_id IS NULL OR source_product_id <> id);
