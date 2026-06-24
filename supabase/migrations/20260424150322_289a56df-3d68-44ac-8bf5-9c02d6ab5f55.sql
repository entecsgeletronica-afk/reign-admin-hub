DO $$
DECLARE
  s RECORD;
  i INT;
  num TEXT;
BEGIN
  FOR s IN
    SELECT id, slug FROM public.stories
    WHERE slug IN ('a-criacao-do-mundo', 'ester-rainha-corajosa')
  LOOP
    FOR i IN 1..30 LOOP
      num := LPAD(i::text, 2, '0');
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (
        s.id,
        i,
        'Página ' || i,
        '/lineart/' || s.slug || '/page-' || num || '.png',
        true
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;