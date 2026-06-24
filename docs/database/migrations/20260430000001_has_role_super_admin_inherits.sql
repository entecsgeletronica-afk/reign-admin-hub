-- super_admin herda automaticamente todos os direitos de admin.
--
-- Antes: has_role(uid, 'admin') retornava false para usuários que tinham
-- apenas a role 'super_admin' em user_roles, fazendo TODAS as policies
-- "Admins manage X" rejeitarem operações (ex.: criar entitlement manual,
-- editar catálogo, etc.).
--
-- Agora: ao perguntar por 'admin', a função também aceita quem tem
-- 'super_admin'. Perguntas explícitas por 'super_admin' continuam exigindo
-- exatamente 'super_admin'.
--
-- SECURITY DEFINER + search_path fixo continuam preservados.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin'::public.app_role AND role = 'super_admin'::public.app_role)
      )
  );
$$;
