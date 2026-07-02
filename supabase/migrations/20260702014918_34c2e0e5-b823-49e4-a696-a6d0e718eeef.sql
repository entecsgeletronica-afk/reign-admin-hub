
-- CATALOG SECTIONS
CREATE TABLE IF NOT EXISTS public.catalog_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_sections TO authenticated;
GRANT ALL ON public.catalog_sections TO service_role;
ALTER TABLE public.catalog_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active catalog sections" ON public.catalog_sections
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage catalog sections" ON public.catalog_sections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_catalog_sections_updated_at
  BEFORE UPDATE ON public.catalog_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS catalog_sections_variation_id_idx ON public.catalog_sections(variation_id);

-- CATALOG PRODUCTS
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES public.catalog_sections(id) ON DELETE SET NULL,
  variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  story_id uuid,
  product_type text NOT NULL DEFAULT 'drawing',
  ebook_mode text,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  cover_image_url text,
  thumbnail_url text,
  hero_image_url text,
  is_featured boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  external_url text,
  badge_text text,
  order_index integer NOT NULL DEFAULT 0,
  is_mirror boolean NOT NULL DEFAULT false,
  source_product_id uuid,
  mirror_type text,
  content_source text NOT NULL DEFAULT 'own',
  inherited_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_products TO authenticated;
GRANT ALL ON public.catalog_products TO service_role;
CREATE INDEX IF NOT EXISTS idx_catalog_products_section ON public.catalog_products(section_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_variation ON public.catalog_products(variation_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_published ON public.catalog_products(is_published);
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published catalog products" ON public.catalog_products
  FOR SELECT USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage catalog products" ON public.catalog_products
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- HOME SETTINGS
CREATE TABLE IF NOT EXISTS public.home_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE CASCADE,
  featured_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  continue_fallback_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  hero_label text DEFAULT 'EM DESTAQUE',
  hero_title text,
  hero_subtitle text,
  hero_button_label text DEFAULT 'Colorir agora',
  hero_image_url text,
  hero_overlay_opacity numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_settings TO authenticated;
GRANT ALL ON public.home_settings TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS home_settings_variation_id_unique
  ON public.home_settings (variation_id) WHERE variation_id IS NOT NULL;
ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view home settings" ON public.home_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins manage home settings" ON public.home_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- USER RECENT PRODUCTS
CREATE TABLE IF NOT EXISTS public.user_recent_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  progress_percent integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_recent_products TO authenticated;
GRANT ALL ON public.user_recent_products TO service_role;
CREATE INDEX IF NOT EXISTS idx_user_recent_products_user ON public.user_recent_products(user_id, last_opened_at DESC);
ALTER TABLE public.user_recent_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recent products" ON public.user_recent_products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recent products" ON public.user_recent_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recent products" ON public.user_recent_products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own recent products" ON public.user_recent_products
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all recent products" ON public.user_recent_products
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- CATALOG USER FAVORITES
CREATE TABLE IF NOT EXISTS public.catalog_user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_user_favorites TO authenticated;
GRANT ALL ON public.catalog_user_favorites TO service_role;
CREATE INDEX IF NOT EXISTS idx_catalog_user_favorites_user ON public.catalog_user_favorites(user_id);
ALTER TABLE public.catalog_user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own catalog favorites" ON public.catalog_user_favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own catalog favorites" ON public.catalog_user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own catalog favorites" ON public.catalog_user_favorites
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all catalog favorites" ON public.catalog_user_favorites
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
