INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT s.id, n, 'Página ' || n,
       '/lineart/' || s.slug || '/page-' || lpad(n::text, 2, '0') || '.png',
       true
FROM (VALUES
  ('6ed8f50c-278f-414c-a805-e249f1b8c3a0'::uuid, 'o-bom-samaritano'),
  ('5a72ccda-1fcc-4b72-8981-a5435cc965b8'::uuid, 'jesus-e-as-criancas'),
  ('92ef2f37-b4c3-4333-a1d7-c976623cc6dd'::uuid, 'a-multiplicacao-dos-paes')
) AS s(id, slug)
CROSS JOIN generate_series(1, 30) AS n
ON CONFLICT DO NOTHING;

-- Garante que páginas existentes recebam o caminho correto
UPDATE public.stories_pages sp
SET image_lineart_url = '/lineart/' || s.slug || '/page-' || lpad(sp.page_number::text, 2, '0') || '.png',
    is_active = true,
    title = COALESCE(sp.title, 'Página ' || sp.page_number)
FROM public.stories s
WHERE sp.story_id = s.id
  AND s.slug IN ('o-bom-samaritano','jesus-e-as-criancas','a-multiplicacao-dos-paes')
  AND (sp.image_lineart_url IS NULL OR sp.image_lineart_url = '' OR sp.image_lineart_url NOT LIKE '/lineart/%');