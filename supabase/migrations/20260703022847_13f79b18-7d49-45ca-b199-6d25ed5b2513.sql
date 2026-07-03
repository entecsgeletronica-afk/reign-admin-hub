-- Create story_categories, stories, stories_pages required by drawings mini-app

CREATE TABLE IF NOT EXISTS public.story_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  emoji text,
  color text,
  icon_url text,
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_categories TO authenticated;
GRANT ALL ON public.story_categories TO service_role;
ALTER TABLE public.story_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active story categories" ON public.story_categories
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage story categories" ON public.story_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_story_categories_updated BEFORE UPDATE ON public.story_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  description text,
  short_description text,
  cover_image_url text,
  thumbnail_url text,
  testament text,
  age_range text,
  age_min integer,
  age_max integer,
  difficulty_level integer,
  estimated_minutes integer,
  category_id uuid REFERENCES public.story_categories(id) ON DELETE SET NULL,
  loved integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stories_active ON public.stories(is_active);
CREATE INDEX IF NOT EXISTS idx_stories_category ON public.stories(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active stories" ON public.stories
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage stories" ON public.stories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.stories_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  title text,
  image_lineart_url text,
  image_preview_url text,
  image_colored_sample_url text,
  svg_markup text,
  recommended_zoom numeric,
  mobile_focus_x numeric,
  mobile_focus_y numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_stories_pages_story ON public.stories_pages(story_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories_pages TO authenticated;
GRANT ALL ON public.stories_pages TO service_role;
ALTER TABLE public.stories_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active story pages" ON public.stories_pages
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage story pages" ON public.stories_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER trg_stories_pages_updated BEFORE UPDATE ON public.stories_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
