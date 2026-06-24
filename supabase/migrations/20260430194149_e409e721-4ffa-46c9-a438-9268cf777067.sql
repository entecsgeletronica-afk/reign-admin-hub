-- Define ailton.com@gmail.com como seed admin (promovido a admin no signup)
INSERT INTO public.app_settings_kv (key, value_json, description)
VALUES (
  'seed_admin_email',
  to_jsonb('ailton.com@gmail.com'::text),
  'E-mail promovido automaticamente a admin no signup (bootstrap).'
)
ON CONFLICT (key) DO UPDATE
  SET value_json = EXCLUDED.value_json,
      description = EXCLUDED.description,
      updated_at = now();

-- Caso o usuário já exista no auth.users, promove imediatamente
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
  FROM auth.users u
 WHERE lower(u.email) = lower('ailton.com@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;