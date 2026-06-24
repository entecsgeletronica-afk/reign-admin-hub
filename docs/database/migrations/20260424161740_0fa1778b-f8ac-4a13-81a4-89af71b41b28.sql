DO $$
DECLARE
  v_story_id uuid := '9aec65c1-8a39-456e-ad96-daabef303ada';
  i int;
  v_num text;
  v_url text;
  v_existing uuid;
BEGIN
  FOR i IN 1..30 LOOP
    v_num := lpad(i::text, 2, '0');
    v_url := '/lineart/jesus-acalma-a-tempestade/page-' || v_num || '.png';

    SELECT id INTO v_existing
      FROM public.stories_pages
     WHERE story_id = v_story_id AND page_number = i
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             is_active = true,
             updated_at = now()
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    END IF;
  END LOOP;
END $$;