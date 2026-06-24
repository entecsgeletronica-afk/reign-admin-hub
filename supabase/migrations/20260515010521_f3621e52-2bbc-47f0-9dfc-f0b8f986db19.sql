-- Drop existing policy to recreate with direct check
DROP POLICY IF EXISTS "Profiles access policy" ON public.profiles;

-- Create a simplified policy that ensures admins can definitely see everything
CREATE POLICY "Admins see all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) 
  OR 
  (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  ))
);

-- Force enable RLS just in case it was toggled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
