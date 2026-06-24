-- Insert the user into admin_profiles
INSERT INTO public.admin_profiles (id, email, name, role, is_active)
SELECT id, email, 'Suporte', 'super_admin', true
FROM auth.users
WHERE email = 'suporte@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin', is_active = true;
