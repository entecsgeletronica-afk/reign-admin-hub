-- 1) Revoke SELECT on sensitive columns from non-service roles
REVOKE SELECT (token) ON public.commercial_offers FROM authenticated, anon;
REVOKE SELECT (signing_secret) ON public.webhook_integrations FROM authenticated, anon;

-- 2) Fix profiles SELECT policy to use has_role (which handles super_admin inheritance)
DROP POLICY IF EXISTS "Admins see all profiles" ON public.profiles;
CREATE POLICY "Admins see all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);