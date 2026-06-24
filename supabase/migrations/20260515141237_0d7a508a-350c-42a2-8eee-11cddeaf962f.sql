-- 1. Redefine app_role if needed (it already exists, but ensure it has the roles)
-- DO NOT DROP TYPE app_role; -- It might be in use.

-- 2. Break recursion in user_roles
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read for roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles select self" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles select super_admin" ON public.user_roles;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can see their own roles
CREATE POLICY "user_roles_select_self"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Hardcoded super admin can see and manage everything
-- This breaks recursion because it doesn't call a function that queries the same table.
CREATE POLICY "user_roles_super_admin_all"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'suporte@gmail.com'
);

-- 3. Break recursion in admin_profiles
ALTER TABLE public.admin_profiles DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_profiles select self" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles select admin" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles insert bootstrap or admin" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles update admin" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles delete admin" ON public.admin_profiles;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can see their own profile
CREATE POLICY "admin_profiles_select_self"
ON public.admin_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy: Hardcoded super admin can see and manage everything
CREATE POLICY "admin_profiles_super_admin_all"
ON public.admin_profiles
FOR ALL
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'suporte@gmail.com'
);

-- 4. Update helper functions to be non-recursive where possible
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Direct check in user_roles is safe here because SECURITY DEFINER bypasses RLS
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  );
$function$;

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
    -- Also allow the root super admin even if not in admin_profiles yet
    (SELECT email FROM auth.users WHERE id = _user_id) = 'suporte@gmail.com'
  );
$function$;
