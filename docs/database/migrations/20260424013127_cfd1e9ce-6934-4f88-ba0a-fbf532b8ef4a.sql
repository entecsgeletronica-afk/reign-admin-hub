-- =====================================================
-- CATALOG SECTIONS
-- =====================================================
CREATE TABLE public.catalog_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  subtitle text,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active catalog sections"
  ON public.catalog_sections FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage catalog sections"
  ON public.catalog_sections FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_catalog_sections_updated_at
  BEFORE UPDATE ON public.catalog_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- CATALOG PRODUCTS
-- =====================================================
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES public.catalog_sections(id) ON DELETE SET NULL,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_products_section ON public.catalog_products(section_id);
CREATE INDEX idx_catalog_products_published ON public.catalog_products(is_published);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published catalog products"
  ON public.catalog_products FOR SELECT
  USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage catalog products"
  ON public.catalog_products FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_catalog_products_updated_at
  BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- HOME SETTINGS (singleton)
-- =====================================================
CREATE TABLE public.home_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  featured_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  continue_fallback_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  hero_label text DEFAULT 'EM DESTAQUE',
  hero_title text,
  hero_subtitle text,
  hero_button_label text DEFAULT 'Colorir agora',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view home settings"
  ON public.home_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage home settings"
  ON public.home_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_home_settings_updated_at
  BEFORE UPDATE ON public.home_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- USER RECENT PRODUCTS
-- =====================================================
CREATE TABLE public.user_recent_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  progress_percent integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_user_recent_products_user ON public.user_recent_products(user_id, last_opened_at DESC);

ALTER TABLE public.user_recent_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recent products"
  ON public.user_recent_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recent products"
  ON public.user_recent_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own recent products"
  ON public.user_recent_products FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recent products"
  ON public.user_recent_products FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all recent products"
  ON public.user_recent_products FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CATALOG USER FAVORITES
-- =====================================================
CREATE TABLE public.catalog_user_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_catalog_user_favorites_user ON public.catalog_user_favorites(user_id);

ALTER TABLE public.catalog_user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own catalog favorites"
  ON public.catalog_user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own catalog favorites"
  ON public.catalog_user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own catalog favorites"
  ON public.catalog_user_favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all catalog favorites"
  ON public.catalog_user_favorites FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- STORAGE BUCKET FOR CATALOG COVERS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-covers', 'catalog-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view catalog covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-covers');

CREATE POLICY "Admins can upload catalog covers"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update catalog covers"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete catalog covers"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-covers' AND has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- SEED DATA
-- =====================================================
INSERT INTO public.catalog_sections (title, slug, subtitle, order_index) VALUES
  ('Antigo Testamento', 'antigo-testamento', 'Aventuras de fé e coragem', 0),
  ('Novo Testamento', 'novo-testamento', 'A vida e os ensinamentos de Jesus', 1),
  ('Parábolas', 'parabolas', 'Lições que Jesus ensinou', 2);

-- Antigo Testamento
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('Arca de Noé', 'arca-de-noe', 0),
  ('Davi e Golias', 'davi-e-golias', 1),
  ('Jonas e a Baleia', 'jonas-e-a-baleia', 2),
  ('Moisés e o Mar Vermelho', 'moises-e-o-mar-vermelho', 3),
  ('Daniel na Cova dos Leões', 'daniel-na-cova-dos-leoes', 4),
  ('A Criação do Mundo', 'a-criacao-do-mundo', 5),
  ('Ester, Rainha Corajosa', 'ester-rainha-corajosa', 6)
) AS p(title, slug, order_index)
WHERE s.slug = 'antigo-testamento';

-- Novo Testamento
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('O Nascimento de Jesus', 'o-nascimento-de-jesus', 0),
  ('Jesus e as Crianças', 'jesus-e-as-criancas', 1),
  ('A Multiplicação dos Pães', 'a-multiplicacao-dos-paes', 2),
  ('O Bom Samaritano', 'o-bom-samaritano', 3),
  ('Jesus Acalma a Tempestade', 'jesus-acalma-a-tempestade', 4)
) AS p(title, slug, order_index)
WHERE s.slug = 'novo-testamento';

-- Parábolas
INSERT INTO public.catalog_products (section_id, title, slug, order_index)
SELECT s.id, p.title, p.slug, p.order_index
FROM public.catalog_sections s
CROSS JOIN (VALUES
  ('O Filho Pródigo', 'o-filho-prodigo', 0),
  ('A Ovelha Perdida', 'a-ovelha-perdida', 1)
) AS p(title, slug, order_index)
WHERE s.slug = 'parabolas';

-- Mark Arca de Noé as featured
UPDATE public.catalog_products SET is_featured = true WHERE slug = 'arca-de-noe';

-- Home settings singleton
INSERT INTO public.home_settings (
  featured_product_id,
  continue_fallback_product_id,
  hero_label,
  hero_title,
  hero_subtitle,
  hero_button_label
)
SELECT
  (SELECT id FROM public.catalog_products WHERE slug = 'arca-de-noe'),
  (SELECT id FROM public.catalog_products WHERE slug = 'davi-e-golias'),
  'EM DESTAQUE',
  'Embarque na maior aventura da Bíblia',
  'Colore a Arca de Noé com todos os seus animais favoritos.',
  'Colorir agora';