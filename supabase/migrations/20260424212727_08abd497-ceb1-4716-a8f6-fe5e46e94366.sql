ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;