        // Carregado sob demanda (ao abrir a aba Usuários), não no boot — remove
        // 1 RPC (admin_get_users) do caminho crítico de inicialização do admin.
        let _usuariosCarregados = false;
        async function carregarUsuarios() {
            if(!currentUserData || !currentUserData.isAdmin) return;
            const { data, error } = await sb.rpc('admin_get_users');
            if (error || !data) {
                // Sem esse retorno a tela ficava presa em "Carregando usuários…"
                // para sempre, sem nenhuma pista do que aconteceu.
                console.error('admin_get_users:', error);
                const tbody = document.querySelector('#tabela-usuarios-app tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Não foi possível carregar os usuários. Tente novamente.</td></tr>';
                showToast('Falha ao carregar usuários: ' + (error?.message || 'erro desconhecido'), 'error', 5000);
                return;
            }
            appUsers = data; _usuariosCarregados = true; renderizarTabelaUsuarios();
        }

        async function salvarUsuario() {
            const idEdit = document.getElementById('edit-user-id').value;
            if(idEdit) editarUsuarioSalvar(idEdit); else criarUsuario();
        }

        async function criarUsuario() {
            const email = document.getElementById('novo-user-email').value;
            const pass = document.getElementById('novo-user-pass').value;
            const nome = document.getElementById('novo-user-nome').value;
            const isAdmin = document.getElementById('novo-user-admin').checked;
            const perms = montarPermissoesJSON();
            if(!email || !pass || !nome) return alert("Preencha todos os campos obrigatórios!");
            const { data, error } = await sb.rpc('admin_create_user', { email_input: email, pass_input: pass, nome_input: nome, is_admin_input: isAdmin, permissoes_input: perms });
            if(error) alert("Erro ao criar: " + error.message);
            else { showToast('Usuário criado com sucesso!', 'success'); cancelarEdicaoUsuario(); carregarUsuarios(); registrarLog('Criação', 'Usuários', `Criou usuário: ${email}`); }
        }

        async function editarUsuarioSalvar(id) {
            const nome = document.getElementById('novo-user-nome').value;
            const isAdmin = document.getElementById('novo-user-admin').checked;
            const perms = montarPermissoesJSON();
            const { error } = await sb.rpc('admin_update_user_meta', { user_id_input: id, nome_input: nome, role_input: 'custom', is_admin_input: isAdmin, permissoes_input: perms });
            if(error) alert("Erro ao atualizar: " + error.message);
            else { showToast('Usuário atualizado!', 'success'); cancelarEdicaoUsuario(); carregarUsuarios(); registrarLog('Edição', 'Usuários', `Atualizou permissões do usuário ID: ${id}`); }
        }

        function editarUsuario(userStr) {
            const u = JSON.parse(decodeURIComponent(userStr));
            const meta = u.usr_meta || {};
            document.getElementById('edit-user-id').value = u.usr_id;
            document.getElementById('titulo-user-form').innerHTML = '<i class="fas fa-edit"></i> Editando Usuário';
            document.getElementById('btn-save-user').innerText = 'Salvar Alterações';
            document.getElementById('btn-cancel-user').style.display = 'block';
            document.getElementById('novo-user-email').value = u.usr_email;
            document.getElementById('novo-user-email').disabled = true;
            document.getElementById('novo-user-pass').style.display = 'none';
            document.getElementById('novo-user-nome').value = meta.nome || '';
            document.getElementById('novo-user-admin').checked = meta.is_admin === true;
            togglePermissoes(document.getElementById('novo-user-admin'));
            const p = meta.permissoes || {};
            const mods = ['dashboard', 'demandas', 'visitantes', 'veiculos', 'eventos', 'crachas', 'predial', 'limpeza', 'ar', 'ocorrencias'];
            mods.forEach(m => {
                if(document.getElementById(`perm-${m}-ver`)) document.getElementById(`perm-${m}-ver`).checked = p[m]?.ver === true;
                if(document.getElementById(`perm-${m}-edit`)) document.getElementById(`perm-${m}-edit`).checked = p[m]?.editar === true;
                if(document.getElementById(`perm-${m}-del`)) document.getElementById(`perm-${m}-del`).checked = p[m]?.excluir === true;
                if(document.getElementById(`perm-${m}-exp`)) document.getElementById(`perm-${m}-exp`).checked = p[m]?.exportar === true;
            });
            document.getElementById('usuarios').scrollIntoView({behavior: 'smooth'});
        }

        function cancelarEdicaoUsuario() {
            document.getElementById('edit-user-id').value = "";
            document.getElementById('titulo-user-form').innerHTML = '<i class="fas fa-user-shield"></i> Criar Novo Usuário';
            document.getElementById('btn-save-user').innerText = 'Criar Usuário';
            document.getElementById('btn-cancel-user').style.display = 'none';
            document.getElementById('novo-user-email').value = '';
            document.getElementById('novo-user-email').disabled = false;
            document.getElementById('novo-user-pass').value = '';
            document.getElementById('novo-user-pass').style.display = 'block';
            document.getElementById('novo-user-nome').value = '';
            document.getElementById('novo-user-admin').checked = false;
            togglePermissoes(document.getElementById('novo-user-admin'));
            const cbs = document.querySelectorAll('.perm-table input[type="checkbox"]');
            cbs.forEach(cb => cb.checked = false);
        }

        function montarPermissoesJSON() {
            const mods = ['dashboard', 'demandas', 'visitantes', 'veiculos', 'eventos', 'crachas', 'predial', 'limpeza', 'ar', 'ocorrencias'];
            let perms = {};
            mods.forEach(m => {
                perms[m] = {
                    ver: document.getElementById(`perm-${m}-ver`) ? document.getElementById(`perm-${m}-ver`).checked : false,
                    editar: document.getElementById(`perm-${m}-edit`) ? document.getElementById(`perm-${m}-edit`).checked : false,
                    excluir: document.getElementById(`perm-${m}-del`) ? document.getElementById(`perm-${m}-del`).checked : false,
                    exportar: document.getElementById(`perm-${m}-exp`) ? document.getElementById(`perm-${m}-exp`).checked : false
                };
            });
            return perms;
        }

        async function excluirUsuario(id, email) {
            if(confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) {
                const { error } = await sb.rpc('admin_delete_user', { user_id_input: id });
                if(error) alert("Erro: " + error.message); else { showToast('Usuário removido.', 'success'); carregarUsuarios(); registrarLog('Exclusão', 'Usuários', `Removeu usuário: ${email}`); }
            }
        }

        function renderizarTabelaUsuarios() {
            const tbody = document.querySelector('#tabela-usuarios-app tbody');
            if (!appUsers.length) { tbody.innerHTML = '<tr><td colspan="5" class="tabela-vazia">Nenhum usuário cadastrado.</td></tr>'; return; }
            const htmlRows = appUsers.map(u => {
                const meta = u.usr_meta || {};
                const tipo = meta.is_admin ? '<span class="badge bg-concluido">ADMIN</span>' : '<span class="badge bg-saiu">USUÁRIO</span>';
                const lastLogin = u.usr_last_login ? new Date(u.usr_last_login).toLocaleString('pt-BR') : 'Nunca';
                const userStr = encodeURIComponent(JSON.stringify(u));
                return `<tr><td><strong>${esc(meta.nome)}</strong></td><td>${esc(u.usr_email)}</td><td>${tipo}</td><td><span style="font-family:'JetBrains Mono', monospace; font-size:0.82rem;">${lastLogin}</span></td><td><button onclick="editarUsuario('${userStr}')" class="action-btn btn-edit" title="Editar" aria-label="Editar registro"><i class="fas fa-pen" aria-hidden="true"></i></button><button onclick="excluirUsuario('${u.usr_id}', '${escJs(u.usr_email)}')" class="action-btn btn-delete" title="Excluir" aria-label="Excluir registro"><i class="fas fa-trash" aria-hidden="true"></i></button></td></tr>`;
            }).join('');
            tbody.innerHTML = htmlRows;
        }

        // Cache do dataURL do brasao -- evita recriar Image+Canvas a cada PDF gerado
        let _brasaoDataURL = null;
        async function getBrasaoDataURL() {
            if (_brasaoDataURL) return _brasaoDataURL;
            return new Promise(resolve => {
                const img = new Image(); img.crossOrigin = 'anonymous';
                img.onload = () => {
                    const cv = document.createElement('canvas');
                    cv.width = img.naturalWidth || img.width;
                    cv.height = img.naturalHeight || img.height;
                    cv.getContext('2d').drawImage(img, 0, 0);
                    _brasaoDataURL = cv.toDataURL('image/png');
                    resolve(_brasaoDataURL);
                };
                img.onerror = () => resolve(null);
                img.src = 'brasao.jpg';
            });
        }

        let _realtimeCanal = null;
        function iniciarRealtime() {
            if (_realtimeCanal) return;   // evita canal duplicado (eventos em dobro)
            const _rtTimers = {};
            const _rtRecebidoEm = {};
            // Mapa tabela → como recarregá-la. `null` devolvido por fetchAll
            // significa falha de rede: nesse caso preserva o que já está em memória.
            const RECARGA = {
                demandas:   async () => { const d = await fetchAll('demandas', 'id', false);     if (d) { demandas = d; _catCache = new WeakMap(); } },
                visitantes: async () => { const d = await fetchAll('visitantes', 'id', false);   if (d) visitantes = d; },
                frota:      async () => { const d = await fetchAll('frota', 'id', false);        if (d) frota = d; },
                eventos:    async () => { const d = await fetchAll('eventos', 'data', false);    if (d) eventos = d; },
                crachas:    async () => { const d = await fetchAll('crachas', 'id', false);      if (d) crachas = d; },
                ocorrencias:async () => { const d = await fetchAll('ocorrencias', 'data_hora', false); if (d) ocorrencias = d; },
                logs_auditoria: async () => {
                    const { data, error } = await sb.from('logs_auditoria').select('*').order('id', { ascending: false }).limit(50);
                    if (!error && data) logs = data;
                }
            };
            function recarregarTabela(tabela) {
                const recarga = RECARGA[tabela];
                if (!recarga) return;                       // tabela fora do app (ex.: profiles)
                if (!_rtTimers[tabela]) _rtRecebidoEm[tabela] = Date.now();
                clearTimeout(_rtTimers[tabela]);
                _rtTimers[tabela] = setTimeout(async () => {
                    const recebidoEm = _rtRecebidoEm[tabela];
                    _rtTimers[tabela] = null;
                    // A própria gravação local já chama carregarDados(). Se essa
                    // recarga começou DEPOIS de o evento chegar, ela com certeza já
                    // trouxe esta mudança — repetir só duplicaria o download.
                    // (Comparar com o INÍCIO, e não com o fim, é o que garante que
                    // nunca se descarte a alteração feita por outro usuário durante
                    // uma recarga já em andamento.)
                    if (_ultimaCargaIniciada >= recebidoEm) return;
                    await recarga();
                    const activeTab = document.querySelector('.section.active')?.id || '';
                    if (tabela === 'logs_auditoria') { if (activeTab === 'auditoria') renderizarLogs(); return; }
                    atualizarTodosKPIs();               // mantém todos os cards sincronizados
                    if (activeTab === 'dashboard') renderizarDashboard();
                }, 300);
            }
            _realtimeCanal = sb.channel('mudancas-db')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    recarregarTabela(payload.table);
                })
                .subscribe();
        }

        function renderizarLogs() {
            const tbody = document.querySelector('#tabela-logs tbody');
            if (logs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum log registrado.</td></tr>'; return; }
            const htmlRows = logs.map(l => {
                const data = new Date(l.data_hora).toLocaleString('pt-BR');
                const classAcao = l.acao === 'Exclusão' ? 'log-acao-exclusao' : (l.acao === 'Edição' ? 'log-acao-edicao' : '');
                return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;">${data}</td><td><strong>${esc(l.usuario)}</strong></td><td>${esc(l.secao)}</td><td class="${classAcao}">${esc(l.acao)}</td><td>${esc(l.detalhes)}</td></tr>`;
            }).join('');
            tbody.innerHTML = htmlRows;
        }

        document.getElementById('date-display').innerText = new Date().toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
        document.getElementById('demanda-data').value = DateUtils.getToInput().slice(0, 10);
        document.getElementById('demanda-hora').value = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        document.getElementById('evento-data').value = DateUtils.getToInput().slice(0, 10);
        document.getElementById('cracha-data').value = DateUtils.getToInput().slice(0, 10);
        document.getElementById('vis-entrada').value = DateUtils.getToInput();
        document.getElementById('veiculo-hora-saida').value = DateUtils.getToInput();

        window.switchTab = function(tabId) {
            fecharSidebarMobile();
            if (document.getElementById('visitantes').classList.contains('active')) { pararCamera(); }
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            const btn = document.getElementById('tab-' + tabId); if(btn) btn.classList.add('active');
            // Renderiza dados da aba ao entrar
            if(tabId === 'dashboard') { 
                renderizarDashboard(); 
                setTimeout(() => { if(chartVolume) chartVolume.resize(); if(chartGaragem) chartGaragem.resize(); if(chartTendencia) chartTendencia.resize(); if(chartPrioridade) chartPrioridade.resize(); }, 100);
            }
            if(tabId === 'demandas') { window.renderizarApenasDemandas(); }
            if(tabId === 'predial' || tabId === 'ar' || tabId === 'limpeza') { window.renderizarAbasEspecificas(); }
            if(tabId === 'visitantes') { window.renderizarApenasVisitantes(); document.getElementById('vis-entrada').value = DateUtils.getToInput(); }
            if(tabId === 'veiculos') { window.renderizarApenasFrota(); document.getElementById('veiculo-hora-saida').value = DateUtils.getToInput(); }
            if(tabId === 'eventos') { window.renderizarApenasEventos(); }
            if(tabId === 'crachas') { window.renderizarApenasCrachas(); }
            if(tabId === 'ocorrencias') { window.renderizarApenasOcorrencias(); document.getElementById('oco-data').value = DateUtils.getToInput(); }
            if(tabId === 'auditoria') { renderizarLogs(); }
            if(tabId === 'usuarios' && !_usuariosCarregados) { carregarUsuarios(); }
            if(tabId === 'predial') { const brt = DateUtils.getToInput(); document.getElementById('predial-data').value = brt.slice(0, 10); document.getElementById('predial-hora').value = brt.slice(11, 16); }
            if(tabId === 'ar') { const brt = DateUtils.getToInput(); document.getElementById('ar-data').value = brt.slice(0, 10); document.getElementById('ar-hora').value = brt.slice(11, 16); }
            if(tabId === 'limpeza') { const brt = DateUtils.getToInput(); document.getElementById('limpeza-data').value = brt.slice(0, 10); document.getElementById('limpeza-hora').value = brt.slice(11, 16); }
        }

        // ── Formatação de tempo padronizada para todas as abas ──
        function formatarTempo(diffMs) {
            if (diffMs < 0) return '00m';
            const totalMin  = Math.floor(diffMs / 60000);
            const totalH    = Math.floor(totalMin / 60);
            const totalD    = Math.floor(totalH / 24);
            const m = totalMin % 60;
            const h = totalH % 24;
            const d = totalD % 30;
            const meses = Math.floor(totalD / 30);
            if (meses > 0)   return `${meses}M ${d}d`;
            if (totalD > 0)  return `${totalD}d ${String(h).padStart(2,'0')}h`;
            if (totalH > 0)  return `${String(totalH).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
            return `${String(m).padStart(2,'0')}m`;
        }

        function calcularTempoDecorrido(dataStr, horaStr, dataFimStr) {
            if (!dataStr) return '--';   // demanda sem data (importada/legada) não derruba a tabela
            const [ano, mes, dia] = dataStr.split('-').map(Number);
            const [h, m] = (horaStr || '00:00').split(':').map(Number);
            const inicio = new Date(Date.UTC(ano, mes - 1, dia, h + 3, m, 0));
            let fim;
            if (dataFimStr) { fim = new Date(dataFimStr); } else { fim = new Date(); }
            return formatarTempo(fim - inicio);
        }

        function formatarData(dataISO) { if(!dataISO) return ''; const [ano, mes, dia] = dataISO.split('-'); return `${dia}/${mes}/${ano}`; }

        function pode(modulo, acao) {
            // Fail-closed: sem perfil carregado, nenhuma permissão (e sem TypeError
            // caso um renderizador rode antes de verificarSessao() concluir).
            if (!currentUserData) return false;
            if (currentUserData.isAdmin) return true;
            const p = currentUserData.perms || {};
            return !!(p[modulo] && p[modulo][acao] === true);
        }

        // ════════════════════════════════════════════════════════════════
        // ESCOPO DO DASHBOARD POR ÁREA
        // Usuário sem "Demandas (Geral)" enxerga o dashboard/relatório
        // restrito às categorias (Predial/Ar/Limpeza) que pode visualizar.
        // Retorna null = sem restrição (admin ou quem vê demandas geral).
        // ════════════════════════════════════════════════════════════════
        function dashCategoriasPermitidas() {
            if (!currentUserData || currentUserData.isAdmin) return null;
            const p = currentUserData.perms || {};
            if (p.demandas?.ver) return null;
            const cats = [];
            if (p.predial?.ver) cats.push('PREDIAL');
            if (p.ar?.ver)      cats.push('AR');
            if (p.limpeza?.ver) cats.push('LIMPEZA');
            return cats;
        }
        function demandasEscopoDash() {
            const cats = dashCategoriasPermitidas();
            if (!cats) return demandas;
            return demandas.filter(d => cats.includes(getCategoriaCached(d)));
        }
        // Esconde no dashboard os blocos de módulos fora do escopo do usuário
        function aplicarEscopoDashboardUI() {
            if (!currentUserData) return;
            const cats = dashCategoriasPermitidas();
            const restrito = cats !== null;
            const p = currentUserData.perms || {};
            const mostra = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis ? '' : 'none'; };
            mostra('card-chart-garagem', !restrito || p.veiculos?.ver === true);
            mostra('stat-mini-eventos',  !restrito || p.eventos?.ver === true);
            mostra('stat-mini-crachas',  !restrito || p.crachas?.ver === true);
            mostra('stat-mini-cftv',     !restrito);
            // Baixar PDF: usuário restrito precisa da permissão "Exportar" do Dashboard
            mostra('btn-pdf-dash', !restrito || p.dashboard?.exportar === true);
        }

