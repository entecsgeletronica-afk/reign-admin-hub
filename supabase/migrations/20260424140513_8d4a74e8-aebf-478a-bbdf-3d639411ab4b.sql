DO $$
DECLARE
  v_story_id uuid;
  v_slug text;
  v_stories text[] := ARRAY['davi-e-golias', 'jonas-e-a-baleia'];
  i int;
  v_url text;
BEGIN
  FOREACH v_slug IN ARRAY v_stories LOOP
    SELECT id INTO v_story_id FROM public.stories WHERE slug = v_slug LIMIT 1;
    IF v_story_id IS NULL THEN
      RAISE NOTICE 'Story % not found, skipping', v_slug;
      CONTINUE;
    END IF;

    FOR i IN 1..30 LOOP
      v_url := '/lineart/' || v_slug || '/page-' || lpad(i::text, 2, '0') || '.png';

      INSERT INTO public.stories_pages (story_id, page_number, image_lineart_url, image_preview_url, is_active)
      VALUES (v_story_id, i, v_url, v_url, true)
      ON CONFLICT DO NOTHING;

      -- Garante atualização caso já exista (sem unique constraint conhecida, fazemos update manual)
      UPDATE public.stories_pages
         SET image_lineart_url = v_url,
             image_preview_url = COALESCE(image_preview_url, v_url),
             is_active = true,
             updated_at = now()
       WHERE story_id = v_story_id AND page_number = i;
    END LOOP;
  END LOOP;
END $$;