-- Ensure the user profile has a name to avoid UI issues
UPDATE public.profiles 
SET full_name = 'Ailton Admin', display_name = 'Ailton'
WHERE email = 'ailton.com@gmail.com';

-- Ensure the user_roles are correctly typed as 'app_role' enum
DELETE FROM public.user_roles WHERE user_id = 'e3a64a62-f964-4208-a0d0-87ed54f69538';
INSERT INTO public.user_roles (user_id, role) VALUES ('e3a64a62-f964-4208-a0d0-87ed54f69538', 'admin'::app_role);
INSERT INTO public.user_roles (user_id, role) VALUES ('e3a64a62-f964-4208-a0d0-87ed54f69538', 'super_admin'::app_role);
