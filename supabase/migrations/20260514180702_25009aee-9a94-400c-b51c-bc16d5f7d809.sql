
-- 1) Webhook integrations: keep signing_secret server-only.
REVOKE SELECT (signing_secret) ON public.webhook_integrations FROM anon, authenticated;

-- 2) Story pages: gate read access by product entitlement (admins keep full access).
DROP POLICY IF EXISTS "Anyone can read active story pages" ON public.stories_pages;

CREATE POLICY "Entitled users read active story pages"
  ON public.stories_pages
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.catalog_products cp
        WHERE cp.story_id = stories_pages.story_id
          AND public.user_has_product_access(auth.uid(), cp.id)
      )
    )
  );
