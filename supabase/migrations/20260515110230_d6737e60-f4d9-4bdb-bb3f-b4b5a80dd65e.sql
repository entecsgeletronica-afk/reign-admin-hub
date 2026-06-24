-- Elevate ailton.com@gmail.com to super_admin in user_roles table
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'ailton.com@gmail.com';

    IF target_user_id IS NOT NULL THEN
        -- Remove any existing roles to ensure a clean state
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        
        -- Insert the super_admin role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'super_admin');
    END IF;
END $$;