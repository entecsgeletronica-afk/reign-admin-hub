-- Backfill: garantir que toda história tenha 30 páginas (1..30)
-- Usa o padrão de URL existente: /stories/{slug}/page-NN.jpg
-- Apenas insere páginas que faltam (não sobrescreve as existentes)

INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, image_preview_url, is_active)
SELECT
  s.id,
  n.page_number,
  'Página ' || n.page_number,
  '/stories/' || s.slug || '/page-' || LPAD(n.page_number::text, 2, '0') || '.jpg',
  '/stories/' || s.slug || '/page-' || LPAD(n.page_number::text, 2, '0') || '.jpg',
  true
FROM public.stories s
CROSS JOIN generate_series(1, 30) AS n(page_number)
WHERE s.slug IN ('o-nascimento-de-jesus', 'a-casa-na-rocha', 'o-semeador')
  AND NOT EXISTS (
    SELECT 1 FROM public.stories_pages p
    WHERE p.story_id = s.id AND p.page_number = n.page_number
  );