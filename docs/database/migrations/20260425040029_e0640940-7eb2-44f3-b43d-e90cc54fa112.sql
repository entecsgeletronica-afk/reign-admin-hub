-- Scope home_settings per member-area variation
ALTER TABLE public.home_settings
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.member_area_variations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS home_settings_variation_id_unique
  ON public.home_settings (variation_id)
  WHERE variation_id IS NOT NULL;

-- Backfill: attach the existing single global row to the first (oldest) variation
-- so the historical hero stays attached to that area only.
UPDATE public.home_settings hs
SET variation_id = (
  SELECT id FROM public.member_area_variations
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE hs.variation_id IS NULL
  AND EXISTS (SELECT 1 FROM public.member_area_variations);

-- Create one empty home_settings row for every other variation that doesn't have one yet
INSERT INTO public.home_settings (variation_id)
SELECT v.id
FROM public.member_area_variations v
WHERE NOT EXISTS (
  SELECT 1 FROM public.home_settings h WHERE h.variation_id = v.id
);