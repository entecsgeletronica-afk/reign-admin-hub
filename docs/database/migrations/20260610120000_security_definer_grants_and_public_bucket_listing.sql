-- ============================================================
-- Security fixes (apply via Supabase SQL editor or migration runner)
-- ============================================================
--
-- Addresses Supabase linter findings:
--   * 0028_anon_security_definer_function_executable
--   * 0029_authenticated_security_definer_function_executable (best-effort:
--     authenticated must keep EXECUTE because these functions are referenced
--     by RLS policies; Postgres requires the calling role to have EXECUTE)
--   * 0025_public_bucket_allows_listing (catalog-covers)
--
-- ============================================================

-- 1) Restrict SECURITY DEFINER helpers exposed via PostgREST.
--    Revoke from PUBLIC/anon so anonymous users cannot probe them via RPC.
--    Keep EXECUTE for `authenticated` because RLS policies depend on them.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_product_access(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_product_access(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.user_has_product_access(uuid, uuid) TO authenticated, service_role;

-- 2) Stop the public `catalog-covers` bucket from being listable.
--    The previous SELECT policy `USING (bucket_id = 'catalog-covers')` let
--    anyone enumerate every object in the bucket. Public buckets serve files
--    via /storage/v1/object/public/... which bypasses RLS, so cover images
--    still load on the site without this policy.
DROP POLICY IF EXISTS "Anyone can view catalog covers" ON storage.objects;
