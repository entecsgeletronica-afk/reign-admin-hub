ALTER TABLE public.home_settings
ADD COLUMN IF NOT EXISTS hero_overlay_opacity numeric NOT NULL DEFAULT 0.7
CHECK (hero_overlay_opacity >= 0 AND hero_overlay_opacity <= 1);