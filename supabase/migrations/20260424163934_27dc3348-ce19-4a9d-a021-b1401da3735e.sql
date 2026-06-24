INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT
  '6facbbcb-8cf0-4fce-9bb0-9068d18cd05f'::uuid,
  gs,
  'Página ' || gs,
  '/lineart/a-ovelha-perdida/page-' || lpad(gs::text, 2, '0') || '.png',
  true
FROM generate_series(1, 30) AS gs
ON CONFLICT DO NOTHING;

UPDATE public.stories_pages
SET image_lineart_url = '/lineart/a-ovelha-perdida/page-' || lpad(page_number::text, 2, '0') || '.png',
    is_active = true,
    updated_at = now()
WHERE story_id = '6facbbcb-8cf0-4fce-9bb0-9068d18cd05f'
  AND page_number BETWEEN 1 AND 30;