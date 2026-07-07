# Migrações de banco — Dzel

Migrações SQL versionadas do projeto Supabase **Dzel_Cogespa**
(`cmdmjprdsxglfjvohcyp`). Cada migração em `migrations/` tem um par em `rollback/`.

Como não há CLI do Supabase neste ambiente, as migrações foram aplicadas via
painel/API e ficam aqui como **fonte da verdade versionada** do schema de
autorização. Aplique em ordem numérica; para reverter, rode o rollback de mesmo número.

| # | Arquivo | O que faz | Reversível |
|---|---------|-----------|:---:|
| 001 | `migrations/001_fix_privilege_escalation.sql` | Torna `public.profiles` a única fonte de verdade de autorização; corrige a escalada de privilégio via `user_metadata`. | ✅ |
| 002 | `migrations/002_restrict_profiles_read.sql` | LGPD: cada usuário lê apenas o próprio perfil. | ✅ |

## ⚠️ Sobre os rollbacks

Os arquivos em `rollback/` restauram o estado **anterior** — o que significa
**reintroduzir as falhas de segurança** que as migrações corrigiram. Use apenas
em recuperação emergencial, se uma migração causar regressão de autenticação.

## Detalhes por migração

### 001 — Correção de escalada de privilégio (CRÍTICO)
Antes: `is_admin`/`permissoes` vinham de `auth.users.raw_user_meta_data` (editável
pelo próprio usuário via `auth.updateUser`) e o trigger `sincronizar_permissoes()` os
copiava para `profiles` em todo UPDATE. Qualquer usuário logado podia virar admin.

Depois: `profiles` é a fonte de verdade; o trigger só propaga dados sensíveis na
criação (feita por função validada); as funções `admin_*` validam contra
`profiles.is_admin`; `admin_update_user_meta` grava a autorização direto em `profiles`.

### 002 — Restrição de leitura de perfis (LGPD)
Antes: a policy `Ler Perfis` deixava qualquer autenticado ler todos os perfis.
Depois: policy `Ler Proprio Perfil` limita a leitura a `id = auth.uid()`. A tela de
administração continua funcionando via `admin_get_users()` (`SECURITY DEFINER`).
