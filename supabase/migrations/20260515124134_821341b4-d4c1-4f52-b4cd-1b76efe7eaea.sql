DO $$
BEGIN
  -- Update password for support user to 'Colorir123' explicitly
  UPDATE auth.users 
  SET encrypted_password = crypt('Colorir123', gen_salt('bf')),
      email_confirmed_at = now(),
      updated_at = now()
  WHERE email = 'suporte@gmail.com';

  -- Ensure identity is correctly linked
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities 
    WHERE email = 'suporte@gmail.com'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    SELECT 
      id,
      id,
      format('{"sub":"%s","email":"%s"}', id, email)::jsonb,
      'email',
      id,
      now(),
      now(),
      now()
    FROM auth.users
    WHERE email = 'suporte@gmail.com';
  END IF;
END $$;
