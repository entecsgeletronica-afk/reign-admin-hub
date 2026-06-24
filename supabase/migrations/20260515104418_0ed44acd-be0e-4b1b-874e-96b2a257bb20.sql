-- Ensure ailton.com@gmail.com is an admin in user_roles table
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'ailton.com@gmail.com';

    IF target_user_id IS NOT NULL THEN
        -- Clean up existing roles for this user and set as admin
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin');
    END IF;
END $$;