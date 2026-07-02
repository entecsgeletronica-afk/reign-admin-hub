
-- Public read for "public" buckets
DROP POLICY IF EXISTS "public_read_public_buckets" ON storage.objects;
CREATE POLICY "public_read_public_buckets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN (
    'branding','catalog-covers','story-covers',
    'story-pages-lineart','story-pages-preview','story-pages-samples',
    'avatars','email-assets'
  ));

-- Authenticated users can upload/update/delete into public content buckets
DROP POLICY IF EXISTS "authenticated_write_public_buckets" ON storage.objects;
CREATE POLICY "authenticated_write_public_buckets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN (
    'branding','catalog-covers','story-covers',
    'story-pages-lineart','story-pages-preview','story-pages-samples',
    'avatars','email-assets'
  ));

DROP POLICY IF EXISTS "authenticated_update_public_buckets" ON storage.objects;
CREATE POLICY "authenticated_update_public_buckets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN (
    'branding','catalog-covers','story-covers',
    'story-pages-lineart','story-pages-preview','story-pages-samples',
    'avatars','email-assets'
  ))
  WITH CHECK (bucket_id IN (
    'branding','catalog-covers','story-covers',
    'story-pages-lineart','story-pages-preview','story-pages-samples',
    'avatars','email-assets'
  ));

DROP POLICY IF EXISTS "authenticated_delete_public_buckets" ON storage.objects;
CREATE POLICY "authenticated_delete_public_buckets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN (
    'branding','catalog-covers','story-covers',
    'story-pages-lineart','story-pages-preview','story-pages-samples',
    'avatars','email-assets'
  ));

-- Private buckets: owner access to their own folder (first path segment = user id)
DROP POLICY IF EXISTS "user_owns_private_object_select" ON storage.objects;
CREATE POLICY "user_owns_private_object_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('user-artworks','ebook-files')
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "user_owns_private_object_write" ON storage.objects;
CREATE POLICY "user_owns_private_object_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('user-artworks','ebook-files')
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "user_owns_private_object_update" ON storage.objects;
CREATE POLICY "user_owns_private_object_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('user-artworks','ebook-files')
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "user_owns_private_object_delete" ON storage.objects;
CREATE POLICY "user_owns_private_object_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('user-artworks','ebook-files')
    AND (auth.uid()::text = (storage.foldername(name))[1]
         OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );
