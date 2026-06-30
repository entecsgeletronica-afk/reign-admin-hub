UPDATE auth.users
SET encrypted_password = crypt('540691Ev', gen_salt('bf')),
    updated_at = now(),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'entecsgeletronica@gmail.com';