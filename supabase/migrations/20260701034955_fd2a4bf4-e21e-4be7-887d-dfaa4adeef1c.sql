
-- Ensure updated_at helper exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.member_area_variations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  short_label text,
  primary_type text NOT NULL DEFAULT 'mixed',
  logo_url text,
  hero_image_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  default_locale text NOT NULL DEFAULT 'pt-BR',
  status text NOT NULL DEFAULT 'draft',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  subdomain_key text,
  root_domain text,
  domain_mode text NOT NULL DEFAULT 'subdomain',
  background_color text,
  surface_color text,
  text_color text,
  button_color text,
  button_text_color text,
  favicon_url text,
  sidebar_color text,
  card_color text,
  enabled_languages text[] NOT NULL DEFAULT ARRAY['pt-BR']::text[],
  login_image_url text,
  login_title text,
  login_subtitle text,
  login_email_placeholder text,
  login_password_placeholder text,
  login_submit_label text,
  login_helper_text text,
  login_footer_text text,
  login_layout_mode text NOT NULL DEFAULT 'split-right',
  login_background_mode text NOT NULL DEFAULT 'solid',
  is_primary boolean NOT NULL DEFAULT false,
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  theme_mode text NOT NULL DEFAULT 'auto',
  muted_text_color text,
  support_email text,
  app_name text,
  logo_alt text,
  access_type text NOT NULL DEFAULT 'restricted_purchase',
  no_access_behavior text NOT NULL DEFAULT 'show_locked',
  sales_page_url text,
  microcopy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT member_area_variations_slug_account_unique UNIQUE (account_id, slug),
  CONSTRAINT member_area_variations_status_check CHECK (status IN ('active','draft','paused')),
  CONSTRAINT member_area_variations_primary_type_check CHECK (primary_type IN ('mixed','drawing','course','download'))
);

CREATE INDEX IF NOT EXISTS idx_member_area_variations_account ON public.member_area_variations(account_id);
CREATE INDEX IF NOT EXISTS idx_member_area_variations_status ON public.member_area_variations(status);
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_account_subdomain_idx
  ON public.member_area_variations (account_id, subdomain_key);
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_one_primary_per_account
  ON public.member_area_variations (account_id) WHERE is_primary = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_area_variations TO authenticated;
GRANT SELECT ON public.member_area_variations TO anon;
GRANT ALL ON public.member_area_variations TO service_role;

ALTER TABLE public.member_area_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active variations" ON public.member_area_variations;
CREATE POLICY "Anyone can view active variations" ON public.member_area_variations
  FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage member area variations" ON public.member_area_variations;
CREATE POLICY "Admins manage member area variations" ON public.member_area_variations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_member_area_variations_updated_at ON public.member_area_variations;
CREATE TRIGGER update_member_area_variations_updated_at
  BEFORE UPDATE ON public.member_area_variations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_member_area_variation_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE current_count integer;
BEGIN
  SELECT count(*) INTO current_count FROM public.member_area_variations WHERE account_id = NEW.account_id;
  IF current_count >= 5 THEN RAISE EXCEPTION 'Limite de 5 variações por conta atingido.'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS enforce_variation_limit_before_insert ON public.member_area_variations;
CREATE TRIGGER enforce_variation_limit_before_insert
  BEFORE INSERT ON public.member_area_variations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_area_variation_limit();

CREATE OR REPLACE FUNCTION public.enforce_single_primary_member_area()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.member_area_variations SET is_primary = false
     WHERE account_id = NEW.account_id AND id <> NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_member_area ON public.member_area_variations;
CREATE TRIGGER trg_enforce_single_primary_member_area
  BEFORE INSERT OR UPDATE OF is_primary ON public.member_area_variations
  FOR EACH ROW WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.enforce_single_primary_member_area();

-- Domains table
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
CREATE INDEX IF NOT EXISTS member_area_domains_area_idx ON public.member_area_domains (member_area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_area_domains TO authenticated;
GRANT SELECT ON public.member_area_domains TO anon;
GRANT ALL ON public.member_area_domains TO service_role;

ALTER TABLE public.member_area_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage member area domains" ON public.member_area_domains;
CREATE POLICY "Admins manage member area domains" ON public.member_area_domains
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can view member area domains" ON public.member_area_domains;
CREATE POLICY "Anyone can view member area domains" ON public.member_area_domains
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_member_area_domains_updated_at ON public.member_area_domains;
CREATE TRIGGER trg_member_area_domains_updated_at
  BEFORE UPDATE ON public.member_area_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default area
INSERT INTO public.member_area_variations (id, title, slug, short_label, primary_type, status, order_index, accent_color, is_primary, subdomain_key)
VALUES ('11111111-1111-1111-1111-111111111111','Reino das Cores Kids','reino-das-cores-kids','Kids','drawing','active',0,'#D4AF37',true,'reinodascoreskids')
ON CONFLICT (id) DO NOTHING;
