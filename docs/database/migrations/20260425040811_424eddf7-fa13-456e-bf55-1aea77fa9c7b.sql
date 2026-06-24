-- Add enabled_languages array to member_area_variations
ALTER TABLE public.member_area_variations
  ADD COLUMN IF NOT EXISTS enabled_languages text[] NOT NULL DEFAULT ARRAY['pt-BR','en-US','es-ES']::text[],
  ADD COLUMN IF NOT EXISTS sidebar_color text,
  ADD COLUMN IF NOT EXISTS card_color text;

-- Backfill sidebar_color/card_color with existing surface_color when null
UPDATE public.member_area_variations
   SET sidebar_color = COALESCE(sidebar_color, surface_color, background_color),
       card_color    = COALESCE(card_color, surface_color, background_color)
 WHERE sidebar_color IS NULL OR card_color IS NULL;