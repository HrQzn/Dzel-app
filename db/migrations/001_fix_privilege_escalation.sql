-- ════════════════════════════════════════════════════════════════════════
-- Migração 001 — Correção CRÍTICA de escalada de privilégio
-- ════════════════════════════════════════════════════════════════════════
-- Problema: is_admin/permissoes moravam em auth.users.raw_user_meta_data,
-- que o PRÓPRIO usuário pode editar via supabase.auth.updateUser({data}).
-- O trigger sincronizar_permissoes() copiava esse metadata para public.profiles
-- a cada UPDATE, e as funções admin_* validavam contra o metadata. Resultado:
-- qualquer usuário autenticado conseguia se tornar admin total
-- (auth.updateUser({data:{is_admin:true}}) → profiles.is_admin=true → RLS/admin_*).
--
-- Correção: public.profiles passa a ser a ÚNICA fonte de verdade de
-- autorização. O trigger deixa de propagar is_admin/permissoes no UPDATE
-- (só na criação, feita pela função admin validada). As funções admin_*
-- passam a validar contra profiles.is_admin. admin_update_user_meta grava
-- a autorização diretamente em profiles.
-- Reversível: db/rollback/001_fix_privilege_escalation_ROLLBACK.sql
-- ════════════════════════════════════════════════════════════════════════

-- 1) Trigger: no UPDATE não sincroniza mais is_admin/permissoes (impede
--    auto-elevação via auth.updateUser). Na criação (INSERT) mantém a
--    derivação do metadata, pois só ocorre via admin_create_user validado.
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profiles (id, email, nome, is_admin, permissoes)
    VALUES (
      new.id,
      new.email,
      new.raw_user_meta_data->>'nome',
      COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, false),
      COALESCE((new.raw_user_meta_data->>'permissoes')::jsonb, '{}'::jsonb)
    )
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      is_admin = EXCLUDED.is_admin,
      permissoes = EXCLUDED.permissoes;
  ELSE
    -- UPDATE: sincroniza apenas dados NÃO sensíveis (nome/email).
    -- is_admin e permissoes são geridos exclusivamente pelas funções admin_*.
    UPDATE public.profiles
       SET nome  = COALESCE(new.raw_user_meta_data->>'nome', nome),
           email = new.email
     WHERE id = new.id;
    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, email, nome, is_admin, permissoes)
      VALUES (new.id, new.email, new.raw_user_meta_data->>'nome', false, '{}'::jsonb);
    END IF;
  END IF;
  RETURN new;
END;
$function$;

-- 2) admin_get_users: valida contra profiles.is_admin (fonte de verdade)
CREATE OR REPLACE FUNCTION public.admin_get_users()
 RETURNS TABLE(usr_id uuid, usr_email character varying, usr_meta jsonb, usr_last_login timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::varchar, u.raw_user_meta_data, u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
END;
$function$;

-- 3) admin_delete_user: valida contra profiles.is_admin
CREATE OR REPLACE FUNCTION public.admin_delete_user(user_id_input uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem excluir usuários.';
  END IF;
  IF user_id_input = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir o próprio usuário.';
  END IF;
  DELETE FROM auth.users WHERE id = user_id_input;
END;
$function$;

-- 4) admin_update_user_meta: valida contra profiles e grava a autorização
--    diretamente em profiles (o trigger de UPDATE não propaga mais).
CREATE OR REPLACE FUNCTION public.admin_update_user_meta(user_id_input uuid, nome_input text, role_input text, is_admin_input boolean, permissoes_input jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
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

  -- Fonte de verdade de autorização (o trigger de UPDATE não propaga isto).
  update public.profiles
     set nome = nome_input,
         is_admin = is_admin_input,
         permissoes = permissoes_input
   where id = user_id_input;
end;
$function$;

-- 5) admin_create_user: valida contra profiles.is_admin
CREATE OR REPLACE FUNCTION public.admin_create_user(email_input text, pass_input text, nome_input text, is_admin_input boolean, permissoes_input jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
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
