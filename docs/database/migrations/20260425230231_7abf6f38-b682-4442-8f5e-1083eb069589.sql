-- 2) Função auxiliar: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  );
$$;

-- 3) Tabela de configurações protegidas
CREATE TABLE IF NOT EXISTS public.protected_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  is_protected boolean NOT NULL DEFAULT true,
  editable_by_role text NOT NULL DEFAULT 'super_admin',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.protected_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view protected settings" ON public.protected_settings;
CREATE POLICY "Anyone can view protected settings"
  ON public.protected_settings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Super admins manage protected settings" ON public.protected_settings;
CREATE POLICY "Super admins manage protected settings"
  ON public.protected_settings
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_protected_settings_updated_at ON public.protected_settings;
CREATE TRIGGER trg_protected_settings_updated_at
  BEFORE UPDATE ON public.protected_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Tabela de auditoria de segurança
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  resource text,
  status text NOT NULL DEFAULT 'blocked',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view audit logs" ON public.security_audit_logs;
CREATE POLICY "Super admins view audit logs"
  ON public.security_audit_logs
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);

-- 5) Conceder super_admin ao e-mail autorizado, se já existir
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = lower('ericvinicius1@hotmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- 6) Sementes de configurações institucionais protegidas
INSERT INTO public.protected_settings (key, value, description) VALUES
  ('sidebar_footer_enabled', 'true', 'Exibe rodapé institucional no menu lateral'),
  ('sidebar_footer_text', 'Feito com amor em Salvador', 'Texto principal do rodapé do menu'),
  ('sidebar_footer_copyright', '© comunidade InfoApps', 'Linha de copyright'),
  ('community_url', 'https://www.comunidadeinfoapps.com.br', 'Site oficial da comunidade'),
  ('community_label', 'www.comunidadeinfoapps.com.br', 'Texto exibido para o link da comunidade'),
  ('perfectpay_referral_url', 'https://app.perfectpay.com.br/refer/REFPPU15CH55ZP', 'Link de afiliado para a Perfect Pay'),
  ('tool_url_replic', 'https://replic.com.br', 'URL oficial Replic'),
  ('tool_url_funnelx', 'https://funnelx.com.br/', 'URL oficial FunnelX'),
  ('tool_url_hostvsl', 'https://www.hostvsl.com.br', 'URL oficial Host VSL'),
  ('tool_url_adsniper', 'https://www.adsniper.com.br/', 'URL oficial AdSniper')
ON CONFLICT (key) DO NOTHING;

-- 7) Garantir trigger handle_seed_admin que conceda super_admin (já existe outro para admin via app_settings_kv).
--    Aqui adicionamos um trigger leve para sempre que o usuário ericvinicius1@hotmail.com for criado, vire super_admin.
CREATE OR REPLACE FUNCTION public.handle_seed_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = lower('ericvinicius1@hotmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_super_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seed_super_admin();
