-- ============================================================
-- 1) Coluna ebook_mode em catalog_products
-- ============================================================
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ebook_mode text;

-- Permite drawing/course/ebook/download
ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_product_type_check;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_product_type_check
  CHECK (product_type IN ('drawing','course','ebook','download'));

-- ebook_mode só aceita single_pdf | modules quando preenchido
ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_ebook_mode_check;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_ebook_mode_check
  CHECK (ebook_mode IS NULL OR ebook_mode IN ('single_pdf','modules'));

-- ============================================================
-- 2) ebook_modules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ebook_modules_status_check CHECK (status IN ('draft','published'))
);
CREATE INDEX IF NOT EXISTS ebook_modules_product_idx
  ON public.ebook_modules(product_id, sort_order);

ALTER TABLE public.ebook_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ebook modules" ON public.ebook_modules;
CREATE POLICY "Admins manage ebook modules"
  ON public.ebook_modules
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view accessible ebook modules" ON public.ebook_modules;
CREATE POLICY "Users view accessible ebook modules"
  ON public.ebook_modules
  FOR SELECT
  USING (
    status = 'published'
    AND public.user_has_product_access(auth.uid(), product_id)
  );

CREATE TRIGGER ebook_modules_set_updated_at
  BEFORE UPDATE ON public.ebook_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) ebook_files
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.ebook_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,           -- path within the private bucket
  file_name text,
  file_size bigint,
  total_pages integer,
  allow_download boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ebook_files_status_check CHECK (status IN ('draft','published'))
);
CREATE INDEX IF NOT EXISTS ebook_files_product_idx
  ON public.ebook_files(product_id, sort_order);
CREATE INDEX IF NOT EXISTS ebook_files_module_idx
  ON public.ebook_files(module_id, sort_order);

ALTER TABLE public.ebook_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ebook files" ON public.ebook_files;
CREATE POLICY "Admins manage ebook files"
  ON public.ebook_files
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view accessible ebook files" ON public.ebook_files;
CREATE POLICY "Users view accessible ebook files"
  ON public.ebook_files
  FOR SELECT
  USING (
    status = 'published'
    AND public.user_has_product_access(auth.uid(), product_id)
  );

CREATE TRIGGER ebook_files_set_updated_at
  BEFORE UPDATE ON public.ebook_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) ebook_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ebook_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  ebook_file_id uuid NOT NULL REFERENCES public.ebook_files(id) ON DELETE CASCADE,
  last_page integer NOT NULL DEFAULT 1,
  total_pages integer,
  progress_percentage integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ebook_file_id)
);
CREATE INDEX IF NOT EXISTS ebook_progress_user_product_idx
  ON public.ebook_progress(user_id, product_id, last_opened_at DESC);

ALTER TABLE public.ebook_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users view own ebook progress"
  ON public.ebook_progress
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users insert own ebook progress"
  ON public.ebook_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own ebook progress" ON public.ebook_progress;
CREATE POLICY "Users update own ebook progress"
  ON public.ebook_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all ebook progress" ON public.ebook_progress;
CREATE POLICY "Admins view all ebook progress"
  ON public.ebook_progress
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER ebook_progress_set_updated_at
  BEFORE UPDATE ON public.ebook_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5) Bucket privado para PDFs
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ebook-files', 'ebook-files', false)
ON CONFLICT (id) DO NOTHING;

-- Admin pode tudo
DROP POLICY IF EXISTS "Admins manage ebook-files objects" ON storage.objects;
CREATE POLICY "Admins manage ebook-files objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'ebook-files'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'ebook-files'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Alunos com acesso ao produto podem LER o objeto correspondente.
-- O front nunca expõe o file_path direto: o leitor recebe uma URL assinada
-- gerada via service role no servidor. Mesmo assim, esta policy garante
-- que se algum cliente autenticado tentar baixar um path de um produto que
-- não tem entitlement, o storage retorna 403.
DROP POLICY IF EXISTS "Users read entitled ebook-files objects" ON storage.objects;
CREATE POLICY "Users read entitled ebook-files objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ebook-files'
    AND EXISTS (
      SELECT 1
      FROM public.ebook_files ef
      WHERE ef.file_path = storage.objects.name
        AND ef.status = 'published'
        AND public.user_has_product_access(auth.uid(), ef.product_id)
    )
  );