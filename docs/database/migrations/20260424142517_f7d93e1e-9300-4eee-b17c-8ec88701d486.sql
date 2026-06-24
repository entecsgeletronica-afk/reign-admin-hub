DO $$
DECLARE
  v_story_id uuid := 'fe828154-7ef7-4708-9d12-e6b0dab8bfa9';
  i int;
  v_url text;
BEGIN
  FOR i IN 1..30 LOOP
    v_url := '/lineart/daniel-na-cova-dos-leoes/page-' || lpad(i::text, 2, '0') || '.png';
    IF EXISTS (SELECT 1 FROM public.stories_pages WHERE story_id = v_story_id AND page_number = i) THEN
      UPDATE public.stories_pages
        SET image_lineart_url = v_url,
            title = 'Página ' || i,
            is_active = true,
            updated_at = now()
        WHERE story_id = v_story_id AND page_number = i;
    ELSE
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    END IF;
  END LOOP;
END $$;