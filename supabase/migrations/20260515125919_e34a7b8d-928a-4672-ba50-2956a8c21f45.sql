CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Normalize internal Auth fields for the manually-created user
UPDATE auth.users
SET
  encrypted_password = crypt('Colorir123', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  updated_at = now()
WHERE lower(email) = lower('suporte@gmail.com');

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  updated_at = now()
WHERE lower(email) IN (lower('ailton.com@gmail.com'), lower('aillton.com@gmail.com'));

-- 2) Ensure email identity exists
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.id::text,
  now(), now(), now()
FROM auth.users u
WHERE lower(u.email) = lower('suporte@gmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- 3) Make sure roles + admin_profiles are set
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, role_value::public.app_role
FROM auth.users u
CROSS JOIN (VALUES ('admin'), ('super_admin')) AS r(role_value)
WHERE lower(u.email) = lower('suporte@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.admin_profiles (id, email, name, role, is_active)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'name', 'Suporte'), 'super_admin', true
FROM auth.users u
WHERE lower(u.email) = lower('suporte@gmail.com')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = 'super_admin',
    is_active = true,
    updated_at = now();

-- 4) Fix recursive RLS on user_roles by using SECURITY DEFINER helper
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 5) Keep auto-promote trigger consistent and safe
CREATE OR REPLACE FUNCTION public.handle_new_user_admin_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF lower(NEW.email) IN (
    lower('aillton.com@gmail.com'),
    lower('ailton.com@gmail.com'),
    lower('suporte@gmail.com')
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES
      (NEW.id, 'admin'::public.app_role),
      (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.admin_profiles (id, email, name, role, is_active)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', 'Admin'), 'super_admin', true)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'super_admin',
        is_active = true,
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;