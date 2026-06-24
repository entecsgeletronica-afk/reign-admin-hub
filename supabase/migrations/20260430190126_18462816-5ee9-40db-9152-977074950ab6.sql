
-- 1. profiles: add legacy columns expected by app code
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS child_name text,
  ADD COLUMN IF NOT EXISTS purchase_email text;

-- backfill user_id = id for existing + future rows
UPDATE public.profiles SET user_id = id WHERE user_id IS NULL;

CREATE OR REPLACE FUNCTION public.profiles_sync_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_user_id_trg ON public.profiles;
CREATE TRIGGER profiles_sync_user_id_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_sync_user_id();

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);

-- 2. app_settings (singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text,
  sender_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings"
ON public.app_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. sales log
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  status text NOT NULL,
  event_type text,
  external_sale_id text,
  customer_email text,
  user_id uuid,
  plan_id uuid,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_user_id_idx ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS sales_status_idx ON public.sales(status);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view sales" ON public.sales;
CREATE POLICY "Admins view sales"
ON public.sales
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
