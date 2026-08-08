# Auditoria Técnica — Dzel (Divisão de Zeladoria / COGESPA)

Documento vivo de auditoria de engenharia. Registra o que foi analisado, os
problemas encontrados (por prioridade), o que já foi corrigido nesta rodada e o
backlog priorizado (roadmap) do que ainda pode evoluir.

**Última auditoria:** 2026-08-08 (rodada 2) · anterior: 2026-07-07 (rodada 1)
**Escopo:** SPA estática (`index.html` + `assets/js/*` + `assets/styles.css`) sobre
Supabase (Postgres 17 + Auth + RLS + Realtime). Sincronização opcional com Google
Sheets via Apps Script. Sem etapa de build.

---

## 0. Rodada 2026-08-08 — revisão completa de código

Revisão linha a linha dos 11 módulos JS, do `index.html` e do CSS, seguida da
correção e de uma suíte de QA automatizada (Playwright + Supabase simulado) com
**81 verificações**. As 13 verificações ligadas aos defeitos abaixo **falham no
código anterior e passam no corrigido**; as 53 que já passavam continuam passando
(sem regressão). A suíte cobre boot, as 12 abas, CRUD dos 6 módulos, permissões,
paginação/filtros, impressão de O.S./R.O., XSS, responsividade e acessibilidade.

### 🔴 Defeitos funcionais corrigidos

| # | Problema | Efeito para o usuário | Correção |
|---|----------|----------------------|----------|
| 1 | Cards de cada aba eram recalculados em `atualizarTodosKPIs()` usando o **filtro de mês do Dashboard** | Após qualquer gravação ou evento de realtime, os números no topo de uma aba passavam a contradizer a tabela logo abaixo (ex.: card "Total 1", tabela com 4 linhas) | Cada card voltou a pertencer ao renderizador da própria aba, que respeita os filtros daquela tela. `atualizarTodosKPIs()` passou a delegar (e a função encolheu de ~100 para ~20 linhas) |
| 2 | `exportarExcel('frota')` consultava `pode('frota', …)`, mas o módulo de permissão chama-se `veiculos` | Usuário não-admin **com** a permissão "Exportar" de Frota/Veículos recebia "Você não tem permissão" | De-para `frota → veiculos` em `_MODULO_PERMISSAO` |
| 3 | Crachá "Entregue" tinha `data_entrega` reescrita com "agora" a cada save | Reabrir um crachá só para corrigir um ramal apagava a data real de entrega | Preserva a data já registrada; grava apenas na primeira vez |
| 4 | Reabrir uma demanda concluída (Geral) mantinha o `data_fim` antigo | O.S. impressa e planilha exportada mostravam data de encerramento em demanda **ainda aberta** | Limpa a conclusão ao sair de "Concluído" (mesmo comportamento já usado nas abas técnicas) |
| 5 | Round-trip de datas usava `getTimezoneOffset()` (fuso da máquina) na leitura e BRT fixo na gravação | Em celular/PC configurado fora de Brasília a hora aparecia deslocada na edição e era **regravada deslocada** (testado em `Europe/Lisbon`: 10:00 virava 14:00 e voltava ao banco como 17:00Z) | Novo `DateUtils.isoParaInputBRT()`, inverso exato de `toDatabaseISO()`. 5 ocorrências trocadas |
| 6 | Falha de rede em `fetchAll` devolvia lista vazia | Tela esvaziava e exibia "Nenhum registro encontrado", como se os dados tivessem sumido | `fetchAll` devolve `null` em erro; `carregarDados` preserva o que está em memória e avisa por toast |
| 7 | `admin_get_users` com erro era ignorado | Aba Usuários ficava presa em "Carregando usuários…" para sempre | Mensagem na tabela + toast com o motivo |
| 8 | `showToast()` era chamado em 3 pontos da geração do PDF do Dashboard, mas **nunca fora definido** | "Gerando PDF…", "PDF gerado" e a mensagem de erro nunca apareciam | Função e estilos implementados |
| 9 | `iniciarRealtime()` sem proteção contra reentrância | Um segundo canal duplicaria todos os eventos e as recargas | Guarda de canal único |
| 10 | `imprimirDashboard()` acessava `Chart.instances` sem verificar | Com o CDN do Chart.js bloqueado, o botão Imprimir quebrava com `ReferenceError` | Acesso protegido; imprime sem redimensionar |
| 11 | `logout()` não tratava falha do `signOut` | Sem rede, o clique em "Sair" não fazia nada | `try/catch` + reload garantido |
| 12 | Log de auditoria de edição de demanda era gravado **antes** do `update` | Auditoria registrava alterações que podiam ter falhado | Log e sync do Sheets movidos para depois da confirmação |
| 13 | Tabelas trocavam o skeleton por "Nenhum registro" antes da 1ª carga terminar | Piscada sugerindo base vazia | Skeleton mantido até `carregarDados()` concluir |

### 🟡 Organização, desempenho e UX

- **Código morto removido:** bloco `#area-impressao` (102 linhas de HTML de um
  fallback de impressão substituído pela janela gerada em `gerarHTMLOS()`, cujos
  13 ids nunca eram lidos), os ~31 linhas de CSS `.os-*` e as regras
  `body.printing-os` (classe nunca aplicada), o `<select id="novo-user-role">`
  oculto, e as variáveis `currentUserRole`, `totalManutencao` e a função
  `_atualizarKPIsAbas()`. Saldo: **-350 linhas**.
- **Desempenho:** cada gravação disparava `carregarDados()` **e** uma recarga do
  realtime — dois downloads completos de todas as tabelas. O realtime passou a
  descartar o evento quando a recarga local começou depois de ele chegar
  (comparação com o **início** da carga, não com o fim, para nunca perder a
  alteração feita por outro usuário durante uma recarga em andamento).
  Os renderizadores das abas agora só reconstroem o HTML da tabela visível.
- **UX:** avisos de sucesso viraram toasts não bloqueantes (erros, exclusões e
  bloqueios de permissão continuam em `alert`, por exigirem atenção); modais
  fecham com **ESC**; o modal de O.S. passou a fechar no clique fora, como os
  demais; tabela de usuários vazia mostra mensagem.
- **Acessibilidade:** `aria-label` nos 27 botões só-ícone (+ `aria-hidden` nos
  ícones decorativos); login com `type="email"`, `inputmode` e `autocapitalize`;
  toasts com `role="status"`/`aria-live`.
- **Robustez:** `pode()` é fail-closed quando não há perfil carregado; o regex de
  diacríticos da importação genérica usava os caracteres combinantes literais
  (invisíveis e sujeitos a corrupção por editor) — trocado pela forma escapada
  `/[\u0300-\u036f]/`, idêntica à já usada na importação de demandas.

### ⚪ Observado e mantido de propósito

- **`fetchAll('visitantes')` traz as fotos em base64** (~30–80 KB por registro) em
  toda recarga. É o maior custo de rede do app hoje. Corrigir bem exige mover a
  foto para o Storage ou buscá-la sob demanda — mudança de modelo de dados, fora
  do escopo de uma correção. Fica no roadmap.
- **Cálculo de SLA assume o navegador no fuso de Brasília** (`horasUteis` usa
  `getDay()`/`setHours` locais). Correto no uso real da DZEL; mexer nisso alteraria
  números históricos de SLA sem necessidade.
- **"Esqueceu a senha?"** continua orientando a procurar o administrador — é a
  regra de negócio atual (contas criadas e geridas pelas RPCs `admin_*`).

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
- **Corrigido na rodada 2:** `aria-label` nos botões de ação só-ícone, `type="email"`
  no login, toasts não bloqueantes para avisos de sucesso, fechamento de modais por ESC
  e estado vazio explícito nas tabelas.
- **Oportunidades (backlog):** contraste de alguns textos `--text-muted` sobre branco
  fica no limite de AA; `onclick`/estilos inline dificultam uma CSP estrita.

---

## 5. Performance

- `fetchAll` carrega todas as linhas de cada tabela permitida no boot. Funcional na
  escala atual; a paginação é **client-side**. Se o volume crescer muito, migrar filtros
  para o servidor (range + índices). Lazy-load de SheetJS/jsPDF já implementado.
- **Rodada 2:** eliminado o download duplicado por gravação (recarga local + eco do
  realtime) e o rebuild de tabelas de abas não visíveis.
- **Maior custo restante:** `visitantes` é buscada com `select('*')`, trazendo as fotos
  em base64 a cada recarga. Mover a foto para o Supabase Storage é o próximo ganho real.

---

## 6. Geração de O.S. / PDF

- Layout coordenado (jsPDF) e HTML de impressão replicam fielmente os DOCX de
  referência (cabeçalho com brasão, seções numeradas, checkboxes de equipe/local,
  termo de encerramento, assinaturas, rodapé). Dados escapados. Estratégia dupla
  desktop (popup) / mobile (overlay com scroll).
- **Corrigido (bug):** `gerarHTMLOS` fazia `d.data.split('-')` sem proteção — uma O.S.
  de registro importado/legado com data nula abria a janela de impressão **em branco**.
  Agora é tolerante a data nula (igual à versão PDF, que já era protegida).
- **Seção 4 "Termo de Encerramento" — preenchimento físico (decisão de 2026-08-08):**
  "Início do atendimento" e "Término do atendimento" saem **sempre em branco**
  (`___/___/20___ ÀS ___:___`), no HTML e no PDF, para serem preenchidos à mão pela
  equipe que executou o serviço. O preenchimento automático a partir de
  `data_inicio_atendimento`/`data_fim`, introduzido na rodada de julho, foi removido.
  Os dois campos continuam sendo registrados pelo sistema e usados normalmente no KPI
  "Tempo de 1ª Resposta", no cálculo de SLA e nas colunas da planilha exportada —
  a mudança vale apenas para o documento impresso.
- **Corrigido:** o rodapé do **Relatório Consolidado (PDF)** lia `sessionStorage`
  (`dzel_user`, nunca gravado) e sempre saía "por Sistema". Agora usa o usuário logado
  (`currentUserData`).
- **Layout alinhado ao modelo oficial (HTML + PDF):** checkboxes desenhados como
  quadrados (marcado = verde com "check" branco) em vez de `[ ]`/`[X]` — no HTML via
  CSS, no PDF via vetores, sem depender de glifo (confiável no Microsoft Print to PDF e
  no celular). Assinatura central passou a "GESTOR / FISCAL (DZEL)". O logo da
  contratada (épura/igm) foi **mantido** no cabeçalho, ao lado do "O.S Nº" em vermelho.
- **Preenchimento total da folha A4:** a O.S. passou a ter altura fixa igual à área
  útil do A4 (277mm), com a seção de descrição/materiais absorvendo o espaço restante —
  as assinaturas ficam no rodapé da página e não sobra vão em branco embaixo, tanto ao
  abrir na tela quanto ao imprimir. No PDF, a caixa de descrição é calculada para o
  mesmo efeito.

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

**Sprint 3 — UX** ✅ concluída na rodada 2 (exceto contraste)
- `aria-label` nos botões só-ícone ✅ · `type="email"` no login ✅ · toasts no lugar de
  `alert()` nos avisos de sucesso ✅ · ESC fecha modais ✅ · revisão de contraste AA (pendente).

**Sprint 4 — Performance/Escala**
- Fotos de visitantes no Storage em vez de base64 na linha · filtros/paginação
  server-side + índices em `demandas(data,status)` quando o volume justificar.

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
