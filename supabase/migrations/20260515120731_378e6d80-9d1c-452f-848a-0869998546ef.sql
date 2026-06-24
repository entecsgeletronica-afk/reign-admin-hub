-- Drop existing policy
DROP POLICY IF EXISTS "User roles access policy" ON public.user_roles;

-- Create a new policy that allows users to see their own roles
-- and allows everyone to see roles (safe as it only contains user_id and role names)
-- This avoids the circular dependency where you need to be an admin to see if you are an admin.
CREATE POLICY "Allow public read for roles" 
ON public.user_roles 
FOR SELECT 
USING (true);

-- Ensure users can't modify their own roles unless they are super_admins
-- (Usually handled by service role or specific insert/update policies if needed)
CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
  )
);
