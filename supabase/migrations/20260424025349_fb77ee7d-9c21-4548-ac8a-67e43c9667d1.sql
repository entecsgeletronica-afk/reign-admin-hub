-- Align story slug with catalog product slug
UPDATE public.stories
   SET slug = 'arca-de-noe',
       updated_at = now()
 WHERE id = 'c0d683b5-e7c4-4f7e-9e9c-ec068c064715';

-- Update page asset URLs to the aligned folder
UPDATE public.stories_pages
   SET image_lineart_url = REPLACE(image_lineart_url,
                                   '/stories/noe-e-a-arca/',
                                   '/stories/arca-de-noe/'),
       updated_at = now()
 WHERE story_id = 'c0d683b5-e7c4-4f7e-9e9c-ec068c064715'
   AND image_lineart_url LIKE '/stories/noe-e-a-arca/%';