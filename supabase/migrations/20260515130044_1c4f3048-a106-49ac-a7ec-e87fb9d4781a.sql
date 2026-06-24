DROP POLICY IF EXISTS "Allow public read for roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

REVOKE ALL ON FUNCTION public.handle_new_user_admin_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_admin_check() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user_admin_check() FROM authenticated;