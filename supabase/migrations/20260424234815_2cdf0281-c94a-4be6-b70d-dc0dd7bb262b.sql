-- Estender member_area_variations com campos de subdomínio, branding extra e login
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS subdomain_key text,
  ADD COLUMN IF NOT EXISTS root_domain text,
  ADD COLUMN IF NOT EXISTS domain_mode text NOT NULL DEFAULT 'subdomain',
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS surface_color text,
  ADD COLUMN IF NOT EXISTS text_color text,
  ADD COLUMN IF NOT EXISTS button_color text,
  ADD COLUMN IF NOT EXISTS button_text_color text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS login_image_url text,
  ADD COLUMN IF NOT EXISTS login_title text,
  ADD COLUMN IF NOT EXISTS login_subtitle text,
  ADD COLUMN IF NOT EXISTS login_email_placeholder text,
  ADD COLUMN IF NOT EXISTS login_password_placeholder text,
  ADD COLUMN IF NOT EXISTS login_submit_label text,
  ADD COLUMN IF NOT EXISTS login_helper_text text,
  ADD COLUMN IF NOT EXISTS login_footer_text text,
  ADD COLUMN IF NOT EXISTS login_layout_mode text NOT NULL DEFAULT 'split-right',
  ADD COLUMN IF NOT EXISTS login_background_mode text NOT NULL DEFAULT 'solid';

-- Backfill: subdomain_key derivado do slug existente (sem hífens)
UPDATE public.member_area_variations
SET subdomain_key = regexp_replace(lower(slug), '[^a-z0-9]', '', 'g')
WHERE subdomain_key IS NULL;

-- Garantir unicidade de subdomain_key por conta
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_account_subdomain_idx
  ON public.member_area_variations (account_id, subdomain_key);

-- Tabela de domínios para futura conexão na Vercel (wildcard, custom domains, etc.)
CREATE TABLE IF NOT EXISTS public.member_area_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_area_id uuid NOT NULL REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  root_domain text NOT NULL,
  subdomain_key text NOT NULL,
  full_domain text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (full_domain)
);

CREATE INDEX IF NOT EXISTS member_area_domains_area_idx
  ON public.member_area_domains (member_area_id);

ALTER TABLE public.member_area_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage member area domains"
  ON public.member_area_domains
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view member area domains"
  ON public.member_area_domains
  FOR SELECT
  USING (true);

CREATE TRIGGER trg_member_area_domains_updated_at
  BEFORE UPDATE ON public.member_area_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();