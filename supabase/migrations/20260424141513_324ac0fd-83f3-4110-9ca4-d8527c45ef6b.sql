DO $$
DECLARE
  v_story_id uuid := '35de27c4-679a-4f2c-8ce6-8243d9db2f66';
  v_slug text := 'moises-e-o-mar-vermelho';
  i int;
  v_url text;
  v_existing uuid;
BEGIN
  FOR i IN 1..30 LOOP
    v_url := '/lineart/' || v_slug || '/page-' || lpad(i::text, 2, '0') || '.png';

    SELECT id INTO v_existing
      FROM public.stories_pages
     WHERE story_id = v_story_id AND page_number = i
     LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.stories_pages (story_id, page_number, title, image_lineart_url, is_active)
      VALUES (v_story_id, i, 'Página ' || i, v_url, true);
    ELSE
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             title = COALESCE(title, 'Página ' || i),
             is_active = true,
             updated_at = now()
       WHERE id = v_existing;
    END IF;
  END LOOP;
END $$;