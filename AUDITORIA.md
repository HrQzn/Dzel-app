# Auditoria Técnica — Dzel (Divisão de Zeladoria / COGESPA)

Documento vivo de auditoria de engenharia. Registra o que foi analisado, os
problemas encontrados (por prioridade), o que já foi corrigido nesta rodada e o
backlog priorizado (roadmap) do que ainda pode evoluir.

**Data da auditoria:** 2026-07-07
**Escopo:** SPA estática (`index.html` + `assets/js/*` + `assets/styles.css`) sobre
Supabase (Postgres 17 + Auth + RLS + Realtime). Sincronização opcional com Google
Sheets via Apps Script. Sem etapa de build.

---

## 1. Arquitetura (como o sistema funciona)

- **Front-end:** SPA de página única, sem framework. JS modularizado em 10 arquivos
  carregados em ordem por `<script>` (sem bundler). Estado global em variáveis
  (`demandas`, `visitantes`, …) e `currentUserData`.
- **Dados/Back-end:** Supabase. O cliente usa a *publishable key* (anon) — correto,
  pois a segurança real está nas políticas RLS. Paginação automática (`fetchAll`,
  1000 linhas/página).
- **Auth/Autorização:** Supabase Auth (e-mail/senha). Papéis e permissões por módulo
  em `public.profiles` (fonte de verdade, protegida por RLS). Funções administrativas
  em RPCs `SECURITY DEFINER` (`admin_*`).
- **Realtime:** canal `postgres_changes` recarrega tabelas ao vivo.
- **Módulos:** Dashboard/SLA, Demandas (Geral + abas técnicas Predial/Ar/Limpeza),
  Recepção, Garagem, Eventos, Crachás, Ocorrências, Auditoria, Usuários, Importação.
- **Documentos:** O.S. e Registro de Ocorrência em HTML (impressão) e PDF (jsPDF puro,
  layout coordenado), replicando os DOCX de referência. Relatório consolidado em PDF.

---

## 2. Segurança

### 🔴 CRÍTICO — Escalada de privilégio via `user_metadata` *(CORRIGIDO)*
- **Problema:** `is_admin`/`permissoes` moravam em `auth.users.raw_user_meta_data`,
  que o próprio usuário edita via `supabase.auth.updateUser({data})`. O trigger
  `sincronizar_permissoes()` copiava esse metadata para `public.profiles` a cada
  UPDATE, e as funções `admin_*` validavam contra o metadata. O front confiava no
  metadata para montar o menu de admin.
- **Impacto:** qualquer usuário autenticado se tornava **admin total** com uma linha
  no console: `await sb.auth.updateUser({data:{is_admin:true}})` → trigger promove em
  `profiles` → passa a poder criar/excluir usuários e ler/alterar tudo. Confirmado com
  teste atômico (`profiles.is_admin` foi de `false` → `true`).
- **Correção (migração `001`):**
  - `profiles` passa a ser a **única fonte de verdade** de autorização.
  - Trigger deixa de propagar `is_admin`/`permissoes` no UPDATE (só na criação, feita
    por função validada). Um `auth.updateUser` de usuário comum não eleva mais nada.
  - As 4 funções `admin_*` validam contra `profiles.is_admin`.
  - `admin_update_user_meta` grava a autorização diretamente em `profiles`.
  - Front (`verificarSessao`) passa a ler `is_admin`/`permissoes` de `profiles`
    (fail-closed: sem perfil confiável → sem privilégios).
- **Verificação:** teste atômico pós-correção manteve `is_admin=false`; 16 usuários /
  4 admins intactos; teste E2E de defesa em profundidade (metadata adulterado é
  ignorado, profiles é a fonte de verdade, fail-closed).

### 🟠 ALTO — Importação em massa sem restrição de papel *(CORRIGIDO na rodada anterior)*
- Botão e modal de importação agora são exclusivos de administradores (oculto na UI +
  bloqueio em `abrirModalImport`).

### 🟡 MÉDIO — Exposição de perfis a qualquer autenticado (LGPD) *(CORRIGIDO)*
- **Problema:** a policy `Ler Perfis` permitia que qualquer usuário logado lesse
  e-mail, `is_admin` e `permissoes` de **todos** os colegas.
- **Correção (migração `002`):** cada usuário lê apenas o próprio perfil
  (`id = auth.uid()`). A tela de administração usa `admin_get_users()`
  (`SECURITY DEFINER`), então não é afetada. Cascata de RLS validada em transação de
  teste (usuário comum passou a ver 1 perfil, mas continua vendo demandas/crachás).

### 🟡 MÉDIO — XSS armazenado na importação *(CORRIGIDO na rodada anterior)*
- Conteúdo da planilha passou a ser escapado (`esc`) na pré-visualização e no mapeamento.

### 🟢 BAIXO / Recomendações (não aplicadas — exigem painel ou decisão)
- **Proteção contra senhas vazadas (HaveIBeenPwned) desabilitada** no Supabase Auth.
  Recomendação: habilitar em Auth → Policies (config do painel, não via SQL).
- **RPCs `admin_*` executáveis por `authenticated`** (advisor WARN): é **intencional e
  seguro** — a UI de admin as chama e cada uma valida `is_admin` internamente. Não
  revogar o `EXECUTE` (quebraria a tela de usuários).
- **`GOOGLE_SCRIPT_URL` e a anon key** ficam no código-fonte: esperado para SPA. A anon
  key só dá o acesso que a RLS permite; o endpoint do Apps Script é *write-only*.
- **`onclick`/estilos inline** por toda a UI dificultam adotar uma CSP estrita no futuro.

---

## 3. Banco de Dados

- **RLS:** habilitado em todas as tabelas de negócio; políticas por permissão
  (ver/editar/excluir) já bem desenhadas e usando subquery em `profiles`.
- **Índices:** PKs indexadas. Advisor de performance **sem apontamentos** na escala
  atual (demandas ~1,5k linhas). Sugestão futura: índice em `demandas(data)` e
  `demandas(status)` se o volume crescer bastante e forem usados filtros no servidor.
- **Tipagem:** `eventos.publico` e `crachas.data_solicitacao/entrega` são `text`
  (deveriam ser `int`/`date`). Baixa prioridade — o front já faz coerção defensiva.
- **`update_supabase_to_prevent_pause`:** tabela de keep-alive com RLS e sem policy
  (bloqueia acesso via API) — comportamento correto, INFO ignorável.

---

## 4. UX / UI / Acessibilidade

- **Pontos fortes:** design system com variáveis CSS, responsivo (breakpoints 900/600/400),
  `:focus-visible` global, `prefers-reduced-motion`, skeleton loaders, paginação
  client-side, tabelas com scroll horizontal próprio.
- **Oportunidades (backlog):** botões de ação só-ícone sem `aria-label`; `input` de
  e-mail do login como `type="text"`; contraste de alguns textos `--text-muted` sobre
  branco fica no limite de AA. São de baixo risco e ficam para a sprint de UX.

---

## 5. Performance

- `fetchAll` carrega todas as linhas de cada tabela permitida no boot. Funcional na
  escala atual; a paginação é **client-side**. Se o volume crescer muito, migrar filtros
  para o servidor (range + índices). Lazy-load de SheetJS/jsPDF já implementado.

---

## 6. Geração de O.S. / PDF

- Layout coordenado (jsPDF) e HTML de impressão replicam fielmente os DOCX de
  referência (cabeçalho com brasão, seções numeradas, checkboxes de equipe/local,
  termo de encerramento, assinaturas, rodapé). Dados escapados. Estratégia dupla
  desktop (popup) / mobile (overlay com scroll).
- **Corrigido:** o rodapé do **Relatório Consolidado (PDF)** lia `sessionStorage`
  (`dzel_user`, nunca gravado) e sempre saía "por Sistema". Agora usa o usuário logado
  (`currentUserData`).

---

## 7. Regras de Negócio / Robustez

- **Corrigido:** `calcularTempoDecorrido` quebrava (`TypeError`) se uma demanda tivesse
  `data` nula (coluna é *nullable*; comum em registros importados/legados), derrubando a
  renderização da aba inteira. Agora retorna `--` com segurança.
- **Corrigido na rodada anterior:** filtros de visitantes/frota/eventos/crachás/
  ocorrências tolerantes a campos nulos; categoria `TELEFONIA` reconhecida em
  `getCategoriaDemanda`; `syncSheets` da edição geral envia o `id`.

---

## 8. QA — Testes executados

Ambiente de teste com Chromium/Playwright e servidor local (bibliotecas de CDN servidas
por cópias locais, pois o egress bloqueia CDNs — não afeta o código):

1. **Importação + categorização** (54 checagens): boot sem erros, bloqueio de não-admin,
   `.xlsx` real, auto-mapeamento, categorização das 4 categorias, data serial sem shift
   de fuso, linha inválida/duplicada, HTML escapado, aplicação em massa e ajuste por linha.
2. **Boot admin/comum:** abas, permissões e visibilidade do botão de importação.
3. **Autorização (defesa em profundidade):** metadata adulterado ignorado, `profiles`
   como fonte de verdade, fail-closed.
4. **Banco (atômico, com rollback):** prova do vetor antes da correção e fechamento
   depois; cascata de RLS da restrição de perfis.

---

## 9. Roadmap (backlog priorizado)

**Sprint 1 — Correções críticas** ✅ concluída nesta rodada
- Escalada de privilégio (migração 001) · LGPD perfis (migração 002) · robustez de
  data nula · rodapé do PDF.

**Sprint 2 — Melhorias importantes**
- Habilitar proteção de senha vazada no Auth · avaliar mover `role`/`permissoes` para
  `app_metadata` · testes automatizados versionados no repo (CI).

**Sprint 3 — UX**
- `aria-label` nos botões só-ícone · `type="email"` no login · revisão de contraste AA ·
  toasts consistentes no lugar de `alert()`.

**Sprint 4 — Performance/Escala**
- Filtros/paginação server-side + índices em `demandas(data,status)` quando o volume
  justificar.

**Sprint 5 — Novas funcionalidades**
- Tipar `eventos.publico`/`crachas.data_*` · histórico/anexos na O.S. · exportação
  consolidada multi-módulo.

---

## 10. Migrações de banco

Versionadas em `db/migrations/` com rollback correspondente em `db/rollback/`:

| # | Migração | Rollback |
|---|----------|----------|
| 001 | `001_fix_privilege_escalation.sql` | `001_..._ROLLBACK.sql` |
| 002 | `002_restrict_profiles_read.sql` | `002_..._ROLLBACK.sql` |

Aplicadas ao projeto Supabase `Dzel_Cogespa` (`cmdmjprdsxglfjvohcyp`). Reversíveis; os
rollbacks reintroduzem o comportamento anterior (⚠️ inclusive as falhas de segurança) e
existem apenas para recuperação emergencial.
