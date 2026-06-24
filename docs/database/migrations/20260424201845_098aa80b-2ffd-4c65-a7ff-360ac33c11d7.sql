
-- Add story_id linking drawing products to a story (which holds pages)
ALTER TABLE public.catalog_products
ADD COLUMN story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_products_story ON public.catalog_products(story_id);

-- Storage policies for the existing story-pages-lineart bucket so admins
-- can upload page artwork directly from the admin panel (browser).
-- The bucket is already public for read access, so we only add admin write/update/delete policies.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins upload story page artwork'
  ) THEN
    CREATE POLICY "Admins upload story page artwork"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins update story page artwork'
  ) THEN
    CREATE POLICY "Admins update story page artwork"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    WITH CHECK (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins delete story page artwork'
  ) THEN
    CREATE POLICY "Admins delete story page artwork"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id IN ('story-pages-lineart', 'story-pages-preview', 'story-pages-samples', 'story-covers')
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
    );
  END IF;
END $$;
