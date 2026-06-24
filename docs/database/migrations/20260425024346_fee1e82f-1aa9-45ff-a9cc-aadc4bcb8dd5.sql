-- 1) Adiciona coluna variation_id em catalog_sections
ALTER TABLE public.catalog_sections
  ADD COLUMN IF NOT EXISTS variation_id uuid
    REFERENCES public.member_area_variations(id) ON DELETE CASCADE;

-- 2) Vincula seções existentes à variação "Reino das Cores Kids"
UPDATE public.catalog_sections
   SET variation_id = '11111111-1111-1111-1111-111111111111'
 WHERE slug IN ('antigo-testamento', 'novo-testamento', 'parabolas-de-jesus');

-- 3) Remove produto e seção "dscsac"
DELETE FROM public.catalog_products
 WHERE section_id = '76752456-5779-415a-a0a9-e056bd04033b';

DELETE FROM public.catalog_sections
 WHERE id = '76752456-5779-415a-a0a9-e056bd04033b';

-- 4) Índice para filtros por variação
CREATE INDEX IF NOT EXISTS catalog_sections_variation_id_idx
  ON public.catalog_sections(variation_id);