-- ROLLBACK da migração 001_fix_privilege_escalation
-- Restaura as definições ORIGINAIS (estado anterior à correção).
-- ⚠️ ATENÇÃO: aplicar este rollback REINTRODUZ a vulnerabilidade de
-- escalada de privilégio (qualquer usuário logado consegue virar admin
-- via auth.updateUser). Use apenas se a correção causar regressão de auth.

-- Trigger original (sincronizava is_admin/permissoes também no UPDATE)
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nome, is_admin, permissoes)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nome',
    (new.raw_user_meta_data->>'is_admin')::boolean,
    (new.raw_user_meta_data->>'permissoes')::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    is_admin = EXCLUDED.is_admin,
    permissoes = EXCLUDED.permissoes;
  RETURN new;
END;
$function$;

-- admin_get_users original (validava via raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.admin_get_users()
 RETURNS TABLE(usr_id uuid, usr_email character varying, usr_meta jsonb, usr_last_login timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND (raw_user_meta_data->>'is_admin')::boolean = true) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::varchar, u.raw_user_meta_data, u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;

-- admin_delete_user original (validava via raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND (raw_user_meta_data->>'is_admin')::boolean = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem excluir usuários.';
  END IF;
  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário.';
  END IF;
  DELETE FROM auth.users WHERE id = user_id_input;
END;
$function$;

-- admin_update_user_meta original (validava via raw_user_meta_data, sem gravar profiles)
CREATE OR REPLACE FUNCTION public.admin_update_user_meta(user_id_input uuid, nome_input text, role_input text, is_admin_input boolean, permissoes_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
begin
  if not exists (select 1 from auth.users where id = auth.uid() and (raw_user_meta_data->>'is_admin')::boolean = true) then
    raise exception 'Acesso negado: Apenas administradores podem editar usuários.';
  end if;
  update auth.users
  set raw_user_meta_data = json_build_object(
        'nome', nome_input,
        'role', role_input,
        'is_admin', is_admin_input,
        'permissoes', permissoes_input
    )::jsonb,
    updated_at = now()
  where id = user_id_input;
end;
$function$;

-- admin_create_user original (validava via raw_user_meta_data)
CREATE OR REPLACE FUNCTION public.admin_create_user(email_input text, pass_input text, nome_input text, is_admin_input boolean, permissoes_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
declare
  new_id uuid;
begin
  if not exists (select 1 from auth.users where id = auth.uid() and (raw_user_meta_data->>'is_admin')::boolean = true) then
    raise exception 'Acesso negado: Apenas administradores podem criar usuários.';
  end if;
  new_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    email_input, crypt(pass_input, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('nome', nome_input, 'is_admin', is_admin_input, 'permissoes', permissoes_input)::jsonb,
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), new_id,
    format('{"sub":"%s","email":"%s"}', new_id::text, email_input)::jsonb,
    'email', email_input, now(), now(), now()
  );
  return new_id;
end;
$function$;
