
DO $$
DECLARE
  _new_user_id uuid;
BEGIN
  _new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, 
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, aud, role,
    confirmation_token, recovery_token
  ) VALUES (
    _new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'dreampay@gmail.com',
    crypt('qtw246twy', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"DreamPay Admin"}'::jsonb,
    'authenticated', 'authenticated', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    _new_user_id, _new_user_id, 'dreampay@gmail.com', 'email',
    jsonb_build_object('sub', _new_user_id::text, 'email', 'dreampay@gmail.com'),
    now(), now(), now()
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_new_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
