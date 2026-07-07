-- ROLLBACK da migração 002_restrict_profiles_read
-- Restaura a policy original (qualquer autenticado lê todos os perfis).
-- ⚠️ Reintroduz a exposição de dados pessoais (LGPD).

DROP POLICY IF EXISTS "Ler Proprio Perfil" ON public.profiles;

CREATE POLICY "Ler Perfis" ON public.profiles
  FOR SELECT TO public
  USING ((SELECT auth.role()) = 'authenticated'::text);
