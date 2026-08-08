        const supabaseUrl = 'https://cmdmjprdsxglfjvohcyp.supabase.co';
        const supabaseKey = 'sb_publishable_2kT53IwbI5_A3ag5zu_CFg_3fhWCcAr';
        const sb = supabase.createClient(supabaseUrl, supabaseKey, {
            auth: { storage: sessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
        });

        // Escapa texto vindo do banco antes de injetar em innerHTML (proteção contra XSS armazenado).
        function esc(v) {
            if (v == null) return '';
            return String(v)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
        // Escapa valor usado dentro de string JS entre aspas simples num atributo (ex.: onclick="f('VALOR')").
        function escJs(v) {
            if (v == null) return '';
            return String(v)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        // ════════════════════════════════════════════════════════════════
        // fetchAll — busca TODOS os registros com paginação automática
        // O Supabase/PostgREST retorna no máximo 1000 rows por request.
        // Esta função faz múltiplas chamadas com .range() até trazer tudo.
        //
        // Falha de rede/RLS devolve `null` (e NÃO uma lista vazia): quem chama
        // precisa distinguir "a tabela está vazia" de "não consegui carregar",
        // senão um erro transitório apagaria a tela e pareceria perda de dados.
        // ════════════════════════════════════════════════════════════════
        async function fetchAll(tabela, orderCol = 'id', ascending = false) {
            const PAGE = 1000;
            let allData = [];
            let from = 0;
            while (true) {
                let data, error;
                try {
                    ({ data, error } = await sb
                        .from(tabela)
                        .select('*')
                        .order(orderCol, { ascending })
                        .range(from, from + PAGE - 1));
                } catch (e) { error = e; }
                if (error) { console.error(`fetchAll(${tabela}):`, error); return null; }
                if (!data || data.length === 0) break;
                allData = allData.concat(data);
                if (data.length < PAGE) break; // última página
                from += PAGE;
            }
            return allData;
        }

        // ════════════════════════════════════════════════════════════════
        // TOAST — aviso não bloqueante (para mensagens que não exigem decisão
        // do usuário). Já era chamado pela geração de PDF do Dashboard, mas a
        // função nunca fora definida: os avisos "Gerando PDF…" / "PDF gerado"
        // e o erro simplesmente não apareciam.
        // ════════════════════════════════════════════════════════════════
        const _TOAST_ICONES = { success: 'fa-circle-check', error: 'fa-circle-exclamation',
                                warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        function showToast(mensagem, tipo = 'info', ms = 3200) {
            let box = document.getElementById('toast-container');
            if (!box) {
                box = document.createElement('div');
                box.id = 'toast-container';
                box.className = 'toast-container no-print';
                box.setAttribute('role', 'status');
                box.setAttribute('aria-live', 'polite');
                document.body.appendChild(box);
            }
            const t = document.createElement('div');
            t.className = 'toast toast-' + (_TOAST_ICONES[tipo] ? tipo : 'info');
            t.innerHTML = `<i class="fas ${_TOAST_ICONES[tipo] || _TOAST_ICONES.info}"></i><span>${esc(mensagem)}</span>`;
            box.appendChild(t);
            const sair = () => {
                if (t.dataset.saindo) return;
                t.dataset.saindo = '1';
                t.classList.add('toast-out');
                setTimeout(() => t.remove(), 250);
            };
            t.addEventListener('click', sair);
            setTimeout(sair, ms);
        }
        window.showToast = showToast;

        // ================================================================
        // SINCRONIZAÇÃO COM GOOGLE SHEETS
        // Cole aqui a URL gerada ao implantar o Apps Script
        // ================================================================
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBN33NHgwpMSK9Re9YjzWHNeTdwswmH7cuzkY4aM_wKniL5v-qscTNh0N9KQkBijMq/exec'; // ← COLE SUA URL AQUI

        /**
         * Envia um registro para o Google Sheets via Apps Script.
         * @param {string} modulo  - 'demandas' | 'visitantes' | 'frota' | 'eventos' | 'crachas' | 'ocorrencias'
         * @param {string} operacao - 'upsert' | 'insert' | 'delete'
         * @param {object} dado    - objeto com os dados do registro
         */
        async function syncSheets(modulo, operacao, dado) {
            if (!GOOGLE_SCRIPT_URL) return;
            try {
                // Usa no-cors + FormData para contornar bloqueio CORS do Apps Script
                const form = new FormData();
                form.append('payload', JSON.stringify({ modulo, operacao, dado }));
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',   // ignora erro de CORS — resposta não é lida mas o POST chega
                    body: form
                });
            } catch(e) {
                console.warn('Sync Sheets falhou (não crítico):', e.message);
            }
        }

        // Chart.register será chamado quando Chart.js estiver disponível (defer)
        let _chartReady = false;
        function ensureChartReady() {
            if (!_chartReady && typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
                Chart.register(ChartDataLabels);
                _chartReady = true;
            }
        }
        let chartVolume = null;
        let chartGaragem = null;
        let chartTendencia = null;
        let chartPrioridade = null;

        // ════════════════════════════════════════════════════════════════
        // LAZY-LOAD — carrega SheetJS (~500KB) e jsPDF (~300KB) sob demanda
        // Economiza ~800KB no carregamento inicial
        // ════════════════════════════════════════════════════════════════
        function lazyLoad(url) {
            return new Promise((resolve, reject) => {
                if (document.querySelector(`script[src="${url}"]`)) return resolve();
                const s = document.createElement('script');
                s.src = url; s.onload = resolve; s.onerror = reject;
                document.head.appendChild(s);
            });
        }
        async function ensureXLSX() {
            if (typeof XLSX === 'undefined') {
                await lazyLoad('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
            }
        }
        async function ensureJsPDF() {
            if (typeof window.jspdf === 'undefined') {
                await lazyLoad('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            }
        }

        // ════════════════════════════════════════════════════════════════
        // DEBOUNCE — evita re-render a cada tecla (melhora INP)
        // ════════════════════════════════════════════════════════════════
        function debounce(fn, ms) {
            let t; return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
        }

        // ════════════════════════════════════════════════════════════════
        // PAGINAÇÃO CLIENT-SIDE (50/pág) + SKELETON LOADERS
        // Renderiza apenas a "fatia" visível de cada tabela em vez de injetar
        // milhares de <tr> de uma vez (fim dos travamentos com muitos registros).
        // Filtros e contadores continuam operando sobre a lista completa —
        // apenas o DOM é paginado.
        // ════════════════════════════════════════════════════════════════
        const PAGE_SIZE = 50;
        const _pgState     = {};   // tableId -> página atual
        const _pgFilterKey = {};   // tableId -> assinatura dos filtros (reseta página ao mudar)
        const _pgRerender  = {};   // tableId -> função que refaz a renderização
        const _TABELA_COLSPAN = {
            'tabela-demandas': 6, 'tabela-predial': 6, 'tabela-ar': 6, 'tabela-limpeza': 6,
            'tabela-visitantes': 6, 'tabela-veiculos': 8, 'tabela-eventos': 6,
            'tabela-crachas': 6, 'tabela-ocorrencias': 7
        };

        // A seção informada é a que está visível? (usado para só reconstruir o
        // HTML da tabela da aba em foco — os contadores são sempre atualizados)
        function secaoVisivel(id) {
            const ativa = document.querySelector('.section.active')?.id || '';
            return !ativa || ativa === id;
        }

        // opts: { tableId, items, rowFn, colspan, emptyMsg, filterKey, rerender }
        function renderPaginated(opts) {
            const { tableId, items, rowFn, colspan, emptyMsg, filterKey, rerender } = opts;
            _pgRerender[tableId] = rerender;
            // Mudou o filtro/busca → volta à 1ª página.
            // Mudou só o conjunto de dados (CRUD/realtime) → mantém a página.
            if (_pgFilterKey[tableId] !== filterKey) {
                _pgFilterKey[tableId] = filterKey;
                _pgState[tableId]     = 1;
            }
            const tbody = document.querySelector(`#${tableId} tbody`);
            if (!tbody) return;
            const total      = items.length;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            let   page       = _pgState[tableId] || 1;
            if (page > totalPages) { page = totalPages; _pgState[tableId] = page; }
            if (total === 0) {
                // Antes da 1ª carga terminar, mantém o skeleton: trocar por
                // "nenhum registro" enquanto os dados ainda estão vindo passa a
                // impressão errada de base vazia.
                if (!_dadosCarregados) return;
                tbody.innerHTML = `<tr><td colspan="${colspan}" class="tabela-vazia">${emptyMsg}</td></tr>`;
                _renderPager(tableId, 1, 1, 0, 0, 0);
                return;
            }
            const start = (page - 1) * PAGE_SIZE;
            const end   = Math.min(start + PAGE_SIZE, total);
            let html = '';
            for (let i = start; i < end; i++) html += rowFn(items[i]);
            tbody.innerHTML = html;
            _renderPager(tableId, page, totalPages, total, start, end);
        }

        // Controles de navegação — criados dinamicamente após a .table-container
        function _pagerEl(tableId) {
            let el = document.getElementById('pager-' + tableId);
            if (!el) {
                const table = document.getElementById(tableId);
                if (!table) return null;
                const container = table.closest('.table-container') || table.parentNode;
                el = document.createElement('div');
                el.id        = 'pager-' + tableId;
                el.className = 'pagination no-print';
                container.parentNode.insertBefore(el, container.nextSibling);
            }
            return el;
        }
        function _renderPager(tableId, page, totalPages, total, start, end) {
            const el = _pagerEl(tableId);
            if (!el) return;
            if (total <= PAGE_SIZE) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <span class="pagination-info">Exibindo <strong>${start + 1}–${end}</strong> de <strong>${total}</strong></span>
                <div class="pagination-controls">
                    <button class="pg-btn" ${page <= 1 ? 'disabled' : ''} onclick="window.pgIr('${tableId}',1)" title="Primeira página"><i class="fas fa-angles-left"></i></button>
                    <button class="pg-btn" ${page <= 1 ? 'disabled' : ''} onclick="window.pgDelta('${tableId}',-1)" title="Anterior"><i class="fas fa-angle-left"></i></button>
                    <span class="pagination-page">${page} / ${totalPages}</span>
                    <button class="pg-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window.pgDelta('${tableId}',1)" title="Próxima"><i class="fas fa-angle-right"></i></button>
                    <button class="pg-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window.pgIr('${tableId}',${totalPages})" title="Última página"><i class="fas fa-angles-right"></i></button>
                </div>`;
        }
        window.pgIr = function(tableId, page) {
            _pgState[tableId] = page;
            if (_pgRerender[tableId]) _pgRerender[tableId]();
            _scrollTopoTabela(tableId);
        };
        window.pgDelta = function(tableId, delta) {
            _pgState[tableId] = (_pgState[tableId] || 1) + delta;
            if (_pgRerender[tableId]) _pgRerender[tableId]();
            _scrollTopoTabela(tableId);
        };
        function _scrollTopoTabela(tableId) {
            const t = document.getElementById(tableId);
            if (!t) return;
            const c = t.closest('.table-container');
            if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Skeleton loader — feedback visual durante o 1º carregamento
        let _skeletonMostrado = false;
        // Vira true quando o 1º carregarDados() termina. Enquanto for false as
        // tabelas continuam exibindo o skeleton em vez de "nenhum registro".
        let _dadosCarregados = false;
        function mostrarSkeleton(tableId, colspan, linhas = 8) {
            const tbody = document.querySelector(`#${tableId} tbody`);
            if (!tbody) return;
            let html = '';
            for (let i = 0; i < linhas; i++) {
                html += `<tr class="skeleton-row"><td colspan="${colspan}"><div class="skeleton-bar"></div></td></tr>`;
            }
            tbody.innerHTML = html;
        }

        const DateUtils = {
            getNowBRT: () => {
                const now = new Date();
                const brtString = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
                return new Date(brtString);
            },
            getToInput: () => {
                const now = DateUtils.getNowBRT();
                const ano = now.getFullYear();
                const mes = String(now.getMonth() + 1).padStart(2, '0');
                const dia = String(now.getDate()).padStart(2, '0');
                const hora = String(now.getHours()).padStart(2, '0');
                const min = String(now.getMinutes()).padStart(2, '0');
                return `${ano}-${mes}-${dia}T${hora}:${min}`;
            },
            toDatabaseISO: (valorInput) => {
                if (!valorInput) return null;
                const [datePart, timePart] = valorInput.split('T');
                const [ano, mes, dia] = datePart.split('-').map(Number);
                const [hora, min] = (timePart || '00:00').split(':').map(Number);
                const utcDate = new Date(Date.UTC(ano, mes - 1, dia, hora + 3, min, 0));
                return utcDate.toISOString();
            },
            getNowDatabaseISO: () => { return DateUtils.toDatabaseISO(DateUtils.getToInput()); },
            // Timestamp ISO (UTC, como está no banco) → valor de <input type="datetime-local">
            // no horário de Brasília. É o inverso exato de toDatabaseISO(), que grava
            // sempre em BRT (+3). A conversão anterior usava getTimezoneOffset() — o fuso
            // da MÁQUINA — então em um celular/PC configurado fora de Brasília a hora
            // aparecia deslocada na edição e era regravada deslocada.
            isoParaInputBRT: (iso) => {
                if (!iso) return '';
                const d = new Date(iso);
                if (isNaN(d.getTime())) return '';
                const data = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
                const hora = d.toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false
                });
                return `${data}T${hora}`;
            }
        };

        function getDataHoraLocalParaInput() { return DateUtils.getToInput(); }
        function dataLocalParaISO(val) { return DateUtils.toDatabaseISO(val); }

        function formatarDataHoraReal(isoString) {
            if (!isoString) return '-';
            const d = new Date(isoString);
            const brtStr = d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const parts = brtStr.replace(',', '').trim().split(' ');
            const datePart = parts[0].split('/').slice(0, 2).join('/');
            const timePart = parts[1] || '';
            return `${datePart} ${timePart}`;
        }

        // Como formatarDataHoraReal, mas com o ano completo (DD/MM/AAAA HH:MM) —
        // usada onde a data sozinha (dia/mês) é ambígua entre anos, ex.: Ocorrências.
        function formatarDataHoraCompleta(isoString) {
            if (!isoString) return '-';
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '-';
            const brtStr = d.toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            return brtStr.replace(',', '').trim();
        }

        // Dia local (BRT) em YYYY-MM-DD — usado pelo filtro "Dia" nos campos
        // de timestamp (visitantes.entrada, frota.hora_inicial, ocorrencias.data_hora).
        // Datas puras (YYYY-MM-DD) passam direto, sem conversão de fuso.
        function diaLocalISO(valor) {
            if (!valor) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
            const d = new Date(valor);
            if (isNaN(d.getTime())) return String(valor).slice(0, 10);
            return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        }

        let demandas = [], frota = [], visitantes = [], eventos = [], logs = [], appUsers = [], crachas = [], ocorrencias = [];
        let currentUserData = null;
        let streamGeral = null;
        let osPrintAtualId = null;

        function montarDadosOS(id) { return demandas.find(item => item.id == id); }
        function getLogoInfoParaOS(d) {
            const cat = getCategoriaDemanda(d);
            if (cat === 'PREDIAL') return { src: 'epura.jpg', width: '140px', height: '60px', fit: 'cover' };
            if (cat === 'AR')      return { src: 'igm2.jpg',  width: '145px', height: '55px', fit: 'contain' };
            return null;
        }
        function montarCheckboxes(d) {
            const c = (d.contratada || '').toUpperCase();
            return {
                limpeza:    c.includes('LIMPEZA')          ? '[X]' : '[ ]',
                ar:         c.includes('AR CONDICIONADO')  ? '[X]' : '[ ]',
                manut:      (c.includes('PREDIAL') || c.includes('ELÉTRICA') || c.includes('PINTURA')) ? '[X]' : '[ ]',
                elevador:   c.includes('ELEVADOR')         ? '[X]' : '[ ]',
                ti:         '[ ]',
                telefonia:  c.includes('TELEFONIA')        ? '[X]' : '[ ]',
                extintores: '[ ]'
            };
        }

        // ════════════════════════════════════════════════════════════════
        // SPLASH DE BOOT — cobre TODA a transição (auth + 1ª carga de dados),
        // revelando o app já populado. Evita o flicker "vazio → cheio" (duplo
        // render) que parece um "refresh" ao logar, além do FOUC da tela de login.
        // ════════════════════════════════════════════════════════════════
        let _bootSplashFailsafe = null;
        function _armarFailsafeSplash() {
            clearTimeout(_bootSplashFailsafe);
            // Nunca deixa o usuário preso no splash (rede lenta/erro inesperado).
            _bootSplashFailsafe = setTimeout(_esconderBootSplash, 10000);
        }
        function _mostrarBootSplash() {
            const s = document.getElementById('boot-splash');
            if (!s) return;
            delete s.dataset.hidden;
            s.style.display = 'flex';
            s.style.opacity = '1';
            s.style.pointerEvents = '';
            _armarFailsafeSplash();
        }
        // Esconde o splash (com fade). Idempotente.
        function _esconderBootSplash() {
            const s = document.getElementById('boot-splash');
            if (!s || s.dataset.hidden) return;
            s.dataset.hidden = '1';
            clearTimeout(_bootSplashFailsafe);
            s.style.opacity = '0';
            s.style.pointerEvents = 'none';
            setTimeout(() => { if (s.dataset.hidden) s.style.display = 'none'; }, 350);
        }

        async function verificarSessao() {
            let data = null;
            // getSession pode falhar (rede/refresh de token). Fail-safe: cai no login,
            // nunca deixa o usuário preso no splash.
            try { ({ data } = await sb.auth.getSession()); }
            catch (e) { console.warn('getSession falhou:', e?.message); }
            if (data && data.session) {
                const user = data.session.user;
                const meta = user.user_metadata || {};
                // ── Autorização vem de public.profiles (fonte de verdade, protegida
                // por RLS e gravada só pelas funções admin_*), NUNCA de user_metadata:
                // o próprio usuário pode editar o metadata via auth.updateUser, então
                // confiar nele para is_admin/permissoes permitiria auto-elevação. ──
                let perfil = null;
                try {
                    const { data: p } = await sb.from('profiles')
                        .select('nome,is_admin,permissoes').eq('id', user.id).maybeSingle();
                    perfil = p;
                } catch (e) { console.warn('Falha ao carregar perfil de autorização:', e?.message); }
                // Fail-closed: sem perfil confiável, trata como usuário sem privilégios.
                currentUserData = {
                    nome: (perfil && perfil.nome) || meta.nome || 'Usuário',
                    email: user.email,
                    isAdmin: perfil ? perfil.is_admin === true : false,
                    perms: (perfil && perfil.permissoes) || {}
                };
                iniciarSistema(currentUserData);
            } else {
                // Sem sessão: revela o login e some com o splash.
                document.getElementById('login-overlay').style.display = 'flex';
                _esconderBootSplash();
            }
        }
        // Bootstrap só após TODOS os arquivos JS carregarem. verificarSessao()
        // chama iniciarSistema()->carregarDados()/iniciarRealtime(), definidos em
        // arquivos posteriores (02, 04…). Com <script defer>, 01-core.js executa
        // em readyState 'interactive' (ANTES dos módulos seguintes rodarem);
        // chamar verificarSessao() aqui direto poderia, se getSession()/profiles
        // resolvessem rápido, alcançar carregarDados() antes de 02 carregar →
        // ReferenceError. O DOMContentLoaded dispara logo após o ÚLTIMO script
        // defer, quando todas as funções já existem — então agendamos nele.
        _armarFailsafeSplash();   // splash já visível no load — nunca fica preso
        if (document.readyState === 'complete') {
            verificarSessao();
        } else {
            document.addEventListener('DOMContentLoaded', verificarSessao);
        }

        // ════════════════════════════════════════════════════════════════
        // DEBOUNCE nos campos de busca — evita re-render a cada tecla
        // Reduz INP de ~384ms para ~50ms (renderiza só após pausa de 250ms)
        // ════════════════════════════════════════════════════════════════
        document.addEventListener('DOMContentLoaded', () => {
            const buscaMap = {
                'filtro-texto-demanda': () => window.renderizarApenasDemandas?.(),
                'filtro-busca-predial':  () => window.renderizarAbasEspecificas?.(),
                'filtro-busca-ar':       () => window.renderizarAbasEspecificas?.(),
                'filtro-busca-limpeza':  () => window.renderizarAbasEspecificas?.(),
                'filtro-busca-vis':      () => window.renderizarApenasVisitantes?.(),
                'filtro-busca-frota':    () => window.renderizarApenasFrota?.(),
                'filtro-busca-evento':   () => window.renderizarApenasEventos?.(),
                'filtro-busca-cracha':   () => window.renderizarApenasCrachas?.(),
                'filtro-busca-oco':      () => window.renderizarApenasOcorrencias?.(),
            };
            Object.entries(buscaMap).forEach(([id, fn]) => {
                const el = document.getElementById(id);
                if (el) {
                    const deb = debounce(fn, 250);
                    el.removeAttribute('onkeyup');
                    el.addEventListener('input', deb);
                }
            });
        });

        // ESC fecha o modal aberto (todos já fechavam no clique fora / botão
        // Cancelar, mas ficavam presos para quem navega pelo teclado).
        // A importação em andamento é preservada: durante a etapa de gravação o
        // próprio modal esconde o botão Cancelar, e aqui respeitamos isso.
        const _FECHAR_MODAL = {
            'modal-print':            () => window.fecharModalImpressao?.(),
            'modal-saida-veiculo':    () => window.fecharModalSaida?.(),
            'modal-saida-visitante':  () => window.fecharModalSaidaVisitante?.(),
            'modal-concluir-demanda': () => window.fecharModalConcluir?.(),
            'modal-import-demanda':   () => window.fecharModalImport?.(),
            'modal-import-generico':  () => window.fecharImportGenerico?.()
        };
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            for (const [id, fechar] of Object.entries(_FECHAR_MODAL)) {
                const el = document.getElementById(id);
                if (!el || el.style.display !== 'flex') continue;
                const btnCancel = el.querySelector('.btn-container .btn-cancel:last-of-type');
                if (btnCancel && btnCancel.style.display === 'none') return; // gravação em curso
                fechar();
                return;
            }
        });

        window.checkEnter = function(e) { if(e.key === 'Enter') window.fazerLogin(); }
        window.toggleLoginPass = function() {
            const inp = document.getElementById('login-pass');
            const ic  = document.getElementById('login-eye-icon');
            const mostrar = inp.type === 'password';
            inp.type = mostrar ? 'text' : 'password';
            ic.classList.toggle('fa-eye', !mostrar);
            ic.classList.toggle('fa-eye-slash', mostrar);
        }
        window.esqueceuSenha = function() {
            alert('Para redefinir sua senha, contate o administrador do sistema (Divisão de Zeladoria — COGESPA).');
        }
        let _loginEmAndamento = false;
        window.fazerLogin = async function() {
            if (_loginEmAndamento) return;          // evita duplo submit (clique + Enter)
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-pass').value;
            const errEl = document.getElementById('login-error');
            if (errEl) errEl.style.display = 'none';
            // Mostra o splash JÁ no clique: cobre TODA a transição (auth + 1ª carga),
            // sem recarregar a página. Antes usava location.reload() (reprocessava tudo)
            // e depois revelava o app vazio antes dos dados — os dois causavam o "refresh".
            _loginEmAndamento = true;
            _mostrarBootSplash();
            let error = null;
            try { ({ error } = await sb.auth.signInWithPassword({ email, password })); }
            catch (e) { error = e; }
            if (error) {
                _loginEmAndamento = false;
                _esconderBootSplash();               // volta pra tela de login
                if (errEl) errEl.style.display = 'block';
            } else {
                // Sucesso: verificarSessao() carrega o perfil e chama iniciarSistema();
                // o splash só some quando o 1º carregarDados() renderiza (app já populado).
                await verificarSessao();
                _loginEmAndamento = false;
            }
        }

        function iniciarSistema(userData) {
            document.getElementById('login-overlay').style.display = 'none';
            // O splash continua visível até o 1º carregarDados() renderizar os dados
            // (ver fim de carregarDados). Assim o app é revelado já populado, sem o
            // flicker "vazio → cheio". Fail-safe garante que ele não fique preso.
            _armarFailsafeSplash();
            // FIX: usa classe em vez de style inline para não quebrar o seletor CSS
            document.getElementById('app-content').classList.add('app-visible');
            document.getElementById('user-display').innerText = `Olá, ${userData.nome}`;
            document.getElementById('user-role-display').innerText = userData.isAdmin ? 'Administrador Geral' : 'Usuário Padrão';
            const initials = userData.nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
            document.getElementById('avatar-initials').innerText = initials;
            carregarDados();
            iniciarRealtime();

            const allTabs = ['dashboard', 'demandas', 'predial', 'limpeza', 'ar', 'visitantes', 'veiculos', 'eventos', 'auditoria', 'usuarios', 'crachas', 'ocorrencias'];
            allTabs.forEach(t => document.getElementById('tab-' + t).classList.add('hidden-tab'));

            // Botão "Importar Planilha" (Demandas) — exclusivo de administradores
            const btnImport = document.getElementById('btn-import-demanda');
            if (btnImport) btnImport.style.display = userData.isAdmin ? '' : 'none';

            // Botões "Importar Planilha" — Recepção, Garagem, Eventos e Crachás
            // (mesmo recurso de Demandas, exclusivo de administradores)
            ['btn-import-visitante', 'btn-import-veiculo', 'btn-import-evento', 'btn-import-cracha'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = userData.isAdmin ? '' : 'none';
            });

            if (userData.isAdmin) {
                allTabs.forEach(t => document.getElementById('tab-' + t).classList.remove('hidden-tab'));
                // carregarUsuarios() agora é lazy (carregado ao abrir a aba Usuários)
                if(!document.querySelector('.section.active')) window.switchTab('dashboard');
            } else {
                let firstTab = null;
                if (userData.perms.demandas?.ver) { document.getElementById('tab-demandas').classList.remove('hidden-tab'); if(!firstTab) firstTab='demandas'; }
                if (userData.perms.predial?.ver) { document.getElementById('tab-predial').classList.remove('hidden-tab'); if(!firstTab) firstTab='predial'; }
                if (userData.perms.limpeza?.ver) { document.getElementById('tab-limpeza').classList.remove('hidden-tab'); if(!firstTab) firstTab='limpeza'; }
                if (userData.perms.ar?.ver) { document.getElementById('tab-ar').classList.remove('hidden-tab'); if(!firstTab) firstTab='ar'; }
                if (userData.perms.visitantes?.ver) { document.getElementById('tab-visitantes').classList.remove('hidden-tab'); if(!firstTab) firstTab='visitantes'; }
                if (userData.perms.veiculos?.ver) { document.getElementById('tab-veiculos').classList.remove('hidden-tab'); if(!firstTab) firstTab='veiculos'; }
                if (userData.perms.eventos?.ver) { document.getElementById('tab-eventos').classList.remove('hidden-tab'); if(!firstTab) firstTab='eventos'; }
                if (userData.perms.crachas?.ver) { document.getElementById('tab-crachas').classList.remove('hidden-tab'); if(!firstTab) firstTab='crachas'; }
                if (userData.perms.ocorrencias?.ver) { document.getElementById('tab-ocorrencias').classList.remove('hidden-tab'); if(!firstTab) firstTab='ocorrencias'; }
                if(userData.perms.dashboard?.ver || userData.perms.demandas?.ver || userData.perms.visitantes?.ver) {
                    document.getElementById('tab-dashboard').classList.remove('hidden-tab');
                    if(!firstTab) firstTab = 'dashboard';
                }
                if(firstTab) window.switchTab(firstTab); else alert('Seu usuário não tem permissão para visualizar nenhuma aba.');
            }
            aplicarEscopoDashboardUI();
        }

        window.toggleSidebar = function() {
            document.body.classList.toggle('sidebar-open');
        }
        function fecharSidebarMobile() {
            if (window.innerWidth <= 900) { document.body.classList.remove('sidebar-open'); }
        }

        function togglePermissoes(checkbox) {
            const container = document.getElementById('container-permissoes');
            if (checkbox.checked) { container.style.opacity = '0.5'; container.style.pointerEvents = 'none'; }
            else { container.style.opacity = '1'; container.style.pointerEvents = 'auto'; }
        }

        window.logout = async function() {
            // Mesmo que o signOut falhe (rede fora), a sessão local precisa ser
            // encerrada — senão o clique em "Sair" simplesmente não faz nada.
            try { await sb.auth.signOut(); } catch (e) { console.warn('signOut:', e?.message); }
            location.reload();
        }

        async function registrarLog(acao, secao, detalhes) {
            if (!currentUserData) return;
            await sb.from('logs_auditoria').insert({ usuario: currentUserData.nome, acao, secao, detalhes });
        }

        // ── Cache de categorias — evita recomputar getCategoriaDemanda() a cada render ──
        let _catCache = new WeakMap();
        function getCategoriaCached(d) {
            if (_catCache.has(d)) return _catCache.get(d);
            const cat = getCategoriaDemanda(d);
            _catCache.set(d, cat);
            return cat;
        }

