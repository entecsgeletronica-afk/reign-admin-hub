-- Seed admin bootstrap
-- 1) Store the seed admin email in app_settings_kv (idempotent upsert)
INSERT INTO public.app_settings_kv (key, value_json, description)
VALUES (
  'seed_admin_email',
  to_jsonb('ericvinicius1987@gmail.com'::text),
  'E-mail promovido automaticamente a admin no signup (bootstrap).'
)
ON CONFLICT (key) DO UPDATE
  SET value_json = EXCLUDED.value_json,
      description = EXCLUDED.description,
      updated_at = now();

-- 2) Trigger function: on new auth user, if email matches the seed,
--    grant the admin role and ensure a profile exists.
CREATE OR REPLACE FUNCTION public.handle_seed_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seed_email text;
BEGIN
  SELECT (value_json #>> '{}')
    INTO seed_email
    FROM public.app_settings_kv
   WHERE key = 'seed_admin_email'
   LIMIT 1;

  IF seed_email IS NULL OR seed_email = '' THEN
    RETURN NEW;
  END IF;

  IF lower(NEW.email) = lower(seed_email) THEN
    -- Ensure profile row exists (handle_new_user_profile already does this,
    -- but we keep it idempotent in case the order of triggers changes).
    INSERT INTO public.profiles (user_id, display_name, purchase_email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'Administrador'),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Grant admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Attach trigger to auth.users (Supabase-supported pattern)
DROP TRIGGER IF EXISTS on_auth_user_created_seed_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_seed_admin();

-- 4) Promote immediately if the seed user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
  JOIN public.app_settings_kv s ON s.key = 'seed_admin_email'
 WHERE lower(u.email) = lower(s.value_json #>> '{}')
ON CONFLICT (user_id, role) DO NOTHING;