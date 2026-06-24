ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_override text;

COMMENT ON COLUMN public.profiles.language_override IS
  'User-selected app language (pt-BR/en-US/es-ES). Overrides app_settings.default_language when set.';