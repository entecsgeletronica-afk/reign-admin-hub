CREATE OR REPLACE FUNCTION public.handle_new_user_admin_check()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.email = 'aillton.com@gmail.com' OR NEW.email = 'ailton.com@gmail.com' OR NEW.email = 'suporte@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Also ensure they are in admin_profiles
    INSERT INTO public.admin_profiles (id, email, name, role, is_active)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'Admin'), 'super_admin', true)
    ON CONFLICT (id) DO UPDATE 
    SET role = 'super_admin', is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
