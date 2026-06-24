-- Default account id for single-tenant phase (multi-tenant leve)
-- This UUID is fixed so all current data belongs to the same logical "account".
-- Phase later: introduce real `accounts` table and migrate this column.

CREATE TABLE public.member_area_variations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  short_label text,
  primary_type text NOT NULL DEFAULT 'mixed', -- mixed | drawing | course | download
  logo_url text,
  hero_image_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  default_locale text NOT NULL DEFAULT 'pt-BR',
  status text NOT NULL DEFAULT 'draft', -- active | draft | paused
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT member_area_variations_slug_account_unique UNIQUE (account_id, slug),
  CONSTRAINT member_area_variations_status_check CHECK (status IN ('active', 'draft', 'paused')),
  CONSTRAINT member_area_variations_primary_type_check CHECK (primary_type IN ('mixed', 'drawing', 'course', 'download'))
);

CREATE INDEX idx_member_area_variations_account ON public.member_area_variations(account_id);
CREATE INDEX idx_member_area_variations_status ON public.member_area_variations(status);

-- Enable RLS
ALTER TABLE public.member_area_variations ENABLE ROW LEVEL SECURITY;

-- Anyone can view active variations (needed for public student area)
CREATE POLICY "Anyone can view active variations"
ON public.member_area_variations
FOR SELECT
USING (status = 'active' OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage everything
CREATE POLICY "Admins manage member area variations"
ON public.member_area_variations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamps
CREATE TRIGGER update_member_area_variations_updated_at
BEFORE UPDATE ON public.member_area_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce maximum of 5 variations per account
CREATE OR REPLACE FUNCTION public.enforce_member_area_variation_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT count(*) INTO current_count
  FROM public.member_area_variations
  WHERE account_id = NEW.account_id;

  IF current_count >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 variações por conta atingido.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_variation_limit_before_insert
BEFORE INSERT ON public.member_area_variations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_member_area_variation_limit();

-- Seed the initial variation matching the current mocked one in the UI
INSERT INTO public.member_area_variations (
  id, title, slug, short_label, primary_type, status, order_index, accent_color
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Reino das Cores Kids',
  'reino-das-cores-kids',
  'Kids',
  'drawing',
  'active',
  0,
  '#D4AF37'
);