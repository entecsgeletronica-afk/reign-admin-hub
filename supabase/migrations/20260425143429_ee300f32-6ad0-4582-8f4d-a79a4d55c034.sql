-- Phase 2: add per-area configuration fields
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_format text NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS theme_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS muted_text_color text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS app_name text,
  ADD COLUMN IF NOT EXISTS logo_alt text,
  ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'restricted_purchase',
  ADD COLUMN IF NOT EXISTS no_access_behavior text NOT NULL DEFAULT 'show_locked',
  ADD COLUMN IF NOT EXISTS sales_page_url text,
  ADD COLUMN IF NOT EXISTS microcopy_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Ensure only one primary per account
CREATE UNIQUE INDEX IF NOT EXISTS member_area_variations_one_primary_per_account
  ON public.member_area_variations (account_id)
  WHERE is_primary = true;

-- Trigger: when one area becomes primary, clear the others within the same account
CREATE OR REPLACE FUNCTION public.enforce_single_primary_member_area()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.member_area_variations
       SET is_primary = false
     WHERE account_id = NEW.account_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_member_area ON public.member_area_variations;
CREATE TRIGGER trg_enforce_single_primary_member_area
BEFORE INSERT OR UPDATE OF is_primary ON public.member_area_variations
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.enforce_single_primary_member_area();

-- Mark "reino-das-cores-kids" (or first area) as primary if no primary exists yet
DO $$
DECLARE
  v_account_id uuid;
  v_first_id uuid;
  v_kids_id uuid;
BEGIN
  FOR v_account_id IN
    SELECT DISTINCT account_id FROM public.member_area_variations
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.member_area_variations
       WHERE account_id = v_account_id AND is_primary = true
    ) THEN
      SELECT id INTO v_kids_id
        FROM public.member_area_variations
       WHERE account_id = v_account_id AND slug = 'reino-das-cores-kids'
       LIMIT 1;

      IF v_kids_id IS NOT NULL THEN
        UPDATE public.member_area_variations
           SET is_primary = true
         WHERE id = v_kids_id;
      ELSE
        SELECT id INTO v_first_id
          FROM public.member_area_variations
         WHERE account_id = v_account_id
         ORDER BY order_index ASC, created_at ASC
         LIMIT 1;
        IF v_first_id IS NOT NULL THEN
          UPDATE public.member_area_variations
             SET is_primary = true
           WHERE id = v_first_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;