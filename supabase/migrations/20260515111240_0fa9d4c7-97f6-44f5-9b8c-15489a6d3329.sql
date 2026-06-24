-- Add 'admin' role in addition to 'super_admin' to ensure all frontend checks pass
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'ailton.com@gmail.com';

    IF target_user_id IS NOT NULL THEN
        -- Check if 'admin' role already exists, if not, insert it
        IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin') THEN
            INSERT INTO public.user_roles (user_id, role)
            VALUES (target_user_id, 'admin');
        END IF;
        
        -- Also ensure 'super_admin' exists (it should, but just to be sure)
        IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'super_admin') THEN
            INSERT INTO public.user_roles (user_id, role)
            VALUES (target_user_id, 'super_admin');
        END IF;
    END IF;
END $$;