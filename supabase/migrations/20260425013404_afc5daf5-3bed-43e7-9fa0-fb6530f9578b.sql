-- 1) Cria as 3 seções de histórias para a área "Reino das Cores Kids"
--    (escopo é global em catalog_sections, mas só serão usadas pelos produtos
--    da variação 11111111-1111-1111-1111-111111111111).
INSERT INTO public.catalog_sections (id, title, slug, subtitle, description, is_active, order_index)
VALUES
  (gen_random_uuid(), 'Antigo Testamento', 'antigo-testamento',
   'Histórias do Antigo Testamento',
   'Coleção de histórias bíblicas do Antigo Testamento para colorir.',
   true, 0),
  (gen_random_uuid(), 'Novo Testamento', 'novo-testamento',
   'Histórias do Novo Testamento',
   'Coleção de histórias bíblicas do Novo Testamento para colorir.',
   true, 1),
  (gen_random_uuid(), 'Parábolas de Jesus', 'parabolas-de-jesus',
   'As parábolas que Jesus contou',
   'Parábolas ensinadas por Jesus, transformadas em desenhos para colorir.',
   true, 2)
ON CONFLICT (slug) DO NOTHING;

-- 2) Vincula os 14 produtos de colorir (variation Reino das Cores Kids) às seções
WITH s AS (
  SELECT
    (SELECT id FROM public.catalog_sections WHERE slug = 'antigo-testamento')   AS antigo,
    (SELECT id FROM public.catalog_sections WHERE slug = 'novo-testamento')     AS novo,
    (SELECT id FROM public.catalog_sections WHERE slug = 'parabolas-de-jesus')  AS parabolas
)
UPDATE public.catalog_products p
SET section_id = CASE
  WHEN p.slug IN (
    'arca-de-noe','davi-e-golias','moises-e-o-mar-vermelho',
    'daniel-na-cova-dos-leoes','a-criacao-do-mundo',
    'ester-rainha-corajosa','jonas-e-a-baleia'
  ) THEN (SELECT antigo FROM s)
  WHEN p.slug IN (
    'o-nascimento-de-jesus','jesus-e-as-criancas',
    'jesus-acalma-a-tempestade','a-multiplicacao-dos-paes'
  ) THEN (SELECT novo FROM s)
  WHEN p.slug IN (
    'o-filho-prodigo','a-ovelha-perdida','o-bom-samaritano'
  ) THEN (SELECT parabolas FROM s)
  ELSE p.section_id
END,
updated_at = now()
WHERE p.variation_id = '11111111-1111-1111-1111-111111111111'
  AND p.product_type = 'drawing';

-- 3) Remove as seções de teste vazias (dscsac, v2) — só se não estiverem
--    sendo usadas por nenhum produto, garantindo zero impacto em outras áreas.
DELETE FROM public.catalog_sections
WHERE slug IN ('dscsac','v2')
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_products WHERE section_id = catalog_sections.id
  );