        async function carregarUsuarios() {
            if(!currentUserData.isAdmin) return;
            const { data, error } = await sb.rpc('admin_get_users');
            if(data) { appUsers = data; renderizarTabelaUsuarios(); }
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
            else { alert("Usuário criado com sucesso!"); cancelarEdicaoUsuario(); carregarUsuarios(); registrarLog('Criação', 'Usuários', `Criou usuário: ${email}`); }
        }

        async function editarUsuarioSalvar(id) {
            const nome = document.getElementById('novo-user-nome').value;
            const isAdmin = document.getElementById('novo-user-admin').checked;
            const perms = montarPermissoesJSON();
            const { error } = await sb.rpc('admin_update_user_meta', { user_id_input: id, nome_input: nome, role_input: 'custom', is_admin_input: isAdmin, permissoes_input: perms });
            if(error) alert("Erro ao atualizar: " + error.message);
            else { alert("Usuário atualizado!"); cancelarEdicaoUsuario(); carregarUsuarios(); registrarLog('Edição', 'Usuários', `Atualizou permissões do usuário ID: ${id}`); }
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
                if(error) alert("Erro: " + error.message); else { alert("Usuário removido."); carregarUsuarios(); registrarLog('Exclusão', 'Usuários', `Removeu usuário: ${email}`); }
            }
        }

        function renderizarTabelaUsuarios() {
            const tbody = document.querySelector('#tabela-usuarios-app tbody');
            const htmlRows = appUsers.map(u => {
                const meta = u.usr_meta || {};
                const tipo = meta.is_admin ? '<span class="badge bg-concluido">ADMIN</span>' : '<span class="badge bg-saiu">USUÁRIO</span>';
                const lastLogin = u.usr_last_login ? new Date(u.usr_last_login).toLocaleString('pt-BR') : 'Nunca';
                const userStr = encodeURIComponent(JSON.stringify(u));
                return `<tr><td><strong>${esc(meta.nome)}</strong></td><td>${esc(u.usr_email)}</td><td>${tipo}</td><td><span style="font-family:'JetBrains Mono', monospace; font-size:0.82rem;">${lastLogin}</span></td><td><button onclick="editarUsuario('${userStr}')" class="action-btn btn-edit"><i class="fas fa-pen"></i></button><button onclick="excluirUsuario('${u.usr_id}', '${escJs(u.usr_email)}')" class="action-btn btn-delete"><i class="fas fa-trash"></i></button></td></tr>`;
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

        function iniciarRealtime() {
            let _rtTimers = {};
            function recarregarTabela(tabela) {
                clearTimeout(_rtTimers[tabela]);
                _rtTimers[tabela] = setTimeout(async () => {
                    const activeTab = document.querySelector('.section.active')?.id || '';
                    if (tabela === 'demandas') {
                        const data = await fetchAll('demandas', 'id', false);
                        if (data.length) { demandas = data; _catCache = new WeakMap(); window.renderizarApenasDemandas(); window.renderizarAbasEspecificas(); }
                    } else if (tabela === 'visitantes') {
                        const data = await fetchAll('visitantes', 'id', false);
                        if (data.length) { visitantes = data; if(activeTab === 'visitantes') window.renderizarApenasVisitantes?.(); }
                    } else if (tabela === 'frota') {
                        const data = await fetchAll('frota', 'id', false);
                        if (data.length) { frota = data; if(activeTab === 'veiculos') window.renderizarApenasFrota?.(); }
                    } else if (tabela === 'eventos') {
                        const data = await fetchAll('eventos', 'data', false);
                        if (data.length) { eventos = data; if(activeTab === 'eventos') window.renderizarApenasEventos?.(); }
                    } else if (tabela === 'crachas') {
                        const data = await fetchAll('crachas', 'id', false);
                        if (data.length) { crachas = data; if(activeTab === 'crachas') window.renderizarApenasCrachas?.(); }
                    } else if (tabela === 'ocorrencias') {
                        const data = await fetchAll('ocorrencias', 'data_hora', false);
                        if (data.length) { ocorrencias = data; if(activeTab === 'ocorrencias') window.renderizarApenasOcorrencias?.(); }
                    } else if (tabela === 'logs_auditoria') {
                        const { data } = await sb.from('logs_auditoria').select('*').order('id', { ascending: false }).limit(50);
                        if (data) { logs = data; if(activeTab === 'auditoria') renderizarLogs(); }
                    }
                    // Sempre atualiza todos os cards após qualquer mudança
                    atualizarTodosKPIs();
                    if (activeTab === 'dashboard') renderizarDashboard();
                }, 300);
            }
            sb.channel('mudancas-db')
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
            const [ano, mes, dia] = dataStr.split('-').map(Number);
            const [h, m] = (horaStr || '00:00').split(':').map(Number);
            const inicio = new Date(Date.UTC(ano, mes - 1, dia, h + 3, m, 0));
            let fim;
            if (dataFimStr) { fim = new Date(dataFimStr); } else { fim = new Date(); }
            return formatarTempo(fim - inicio);
        }

        function formatarData(dataISO) { if(!dataISO) return ''; const [ano, mes, dia] = dataISO.split('-'); return `${dia}/${mes}/${ano}`; }

        function pode(modulo, acao) {
            if (currentUserData.isAdmin) return true;
            return currentUserData.perms[modulo] && currentUserData.perms[modulo][acao] === true;
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

