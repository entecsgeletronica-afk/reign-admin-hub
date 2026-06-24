-- Cleanup duplicate or conflicting policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;

-- Single clear SELECT policy for profiles
CREATE POLICY "Profiles access policy" 
ON public.profiles 
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- Ensure user_roles has consistent policies
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "User roles access policy"
ON public.user_roles
FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);

-- Fix subscriptions access
DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;

CREATE POLICY "Subscriptions access policy"
ON public.subscriptions
FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
);
