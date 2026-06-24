-- 1. Update user_roles policies
DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;

CREATE POLICY "user_roles_super_admin_all"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'suporte@gmail.com'
);

-- 2. Update admin_profiles policies
DROP POLICY IF EXISTS "admin_profiles_super_admin_all" ON public.admin_profiles;

CREATE POLICY "admin_profiles_super_admin_all"
ON public.admin_profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'suporte@gmail.com'
);

-- 3. Update is_active_admin function to use JWT for current user if possible, 
-- but it needs to work for any user ID passed, so we keep the profile check.
CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_profiles
    WHERE id = _user_id AND is_active = true
  ) OR (
    -- Root bypass
    _user_id = '2e4423b9-9a29-4a6f-aea3-4786428fa2b0' -- support user ID
  );
$function$;
