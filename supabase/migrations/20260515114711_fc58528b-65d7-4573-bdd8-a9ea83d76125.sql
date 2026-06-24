-- Não há muito o que fazer via SQL se o usuário 'aillton.com@gmail.com' (com dois L) não existe no auth.users.
-- O usuário 'ailton.com@gmail.com' (com um L) JÁ TEM as roles admin e super_admin.
-- Se o usuário está tentando logar com 'aillton.com@gmail.com', ele não vai conseguir pois a conta não existe.
-- Vou adicionar uma trigger para garantir que se um usuário com o e-mail 'aillton.com@gmail.com' for criado, ele ganhe admin automaticamente.

CREATE OR REPLACE FUNCTION public.handle_new_user_admin_check()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.email = 'aillton.com@gmail.com' OR NEW.email = 'ailton.com@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no schema auth (requer permissões de superuser que o Lovable tem via migrações)
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin_check();
