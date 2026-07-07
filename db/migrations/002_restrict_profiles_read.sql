-- ════════════════════════════════════════════════════════════════════════
-- Migração 002 — LGPD: restringe leitura de public.profiles ao próprio usuário
-- ════════════════════════════════════════════════════════════════════════
-- Problema: a policy "Ler Perfis" permitia que QUALQUER usuário autenticado
-- lesse TODOS os perfis (e-mail, is_admin, permissões de todos os colegas) —
-- exposição desnecessária de dados pessoais (LGPD).
--
-- Correção: cada usuário passa a ler apenas o próprio perfil. A listagem de
-- usuários da tela de administração NÃO é afetada, pois usa a função
-- admin_get_users() (SECURITY DEFINER, que ignora RLS). As políticas de RLS
-- de outras tabelas que consultam profiles filtram sempre por id = auth.uid(),
-- portanto continuam funcionando (validado com teste de RLS em cascata).
-- Reversível: db/rollback/002_restrict_profiles_read_ROLLBACK.sql
-- ════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Ler Perfis" ON public.profiles;

CREATE POLICY "Ler Proprio Perfil" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
