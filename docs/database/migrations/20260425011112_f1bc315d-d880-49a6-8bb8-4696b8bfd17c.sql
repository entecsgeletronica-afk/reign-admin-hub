-- =====================================================
-- COURSE MODULES
-- =====================================================
CREATE TABLE public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_product ON public.course_modules(product_id, order_index);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course modules"
  ON public.course_modules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view course modules"
  ON public.course_modules
  FOR SELECT
  USING (true);

CREATE TRIGGER update_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COURSE LESSONS
-- =====================================================
CREATE TABLE public.course_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'youtube',
  video_url TEXT,
  embed_code TEXT,
  body_text TEXT,
  complementary_url TEXT,
  complementary_label TEXT,
  pdf_url TEXT,
  pdf_label TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_lessons_module ON public.course_lessons(module_id, order_index);

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course lessons"
  ON public.course_lessons
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view published course lessons"
  ON public.course_lessons
  FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COURSE LESSON PROGRESS
-- =====================================================
CREATE TABLE public.course_lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX idx_course_lesson_progress_user ON public.course_lesson_progress(user_id);
CREATE INDEX idx_course_lesson_progress_lesson ON public.course_lesson_progress(lesson_id);

ALTER TABLE public.course_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all lesson progress"
  ON public.course_lesson_progress
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users view own lesson progress"
  ON public.course_lesson_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lesson progress"
  ON public.course_lesson_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own lesson progress"
  ON public.course_lesson_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own lesson progress"
  ON public.course_lesson_progress
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_course_lesson_progress_updated_at
  BEFORE UPDATE ON public.course_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();