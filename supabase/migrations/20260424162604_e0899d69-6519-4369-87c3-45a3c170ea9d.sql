
WITH s AS (SELECT 'eb899ab3-ec42-4177-a30a-d7b323d3ea79'::uuid AS id),
nums AS (SELECT generate_series(1, 30) AS n)
INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
SELECT s.id, n, 'Página ' || n,
       '/lineart/o-filho-prodigo/page-' || lpad(n::text, 2, '0') || '.png',
       true
FROM s, nums
ON CONFLICT (story_id, page_number) DO UPDATE
  SET image_lineart_url = EXCLUDED.image_lineart_url,
      is_active = true,
      updated_at = now();
