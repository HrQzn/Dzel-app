        const formVis = document.getElementById('form-visitante');
        formVis.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('visitante-id-edit').value;
            const id = idEdicao || Date.now();
            const fotoBase64 = document.getElementById('vis-foto-base64').value;
            const horaEntrada = idEdicao ? dataLocalParaISO(document.getElementById('vis-entrada').value) : dataLocalParaISO(DateUtils.getToInput());
            const novoVisitante = { id, foto: fotoBase64 || null, nome: document.getElementById('vis-nome').value.toUpperCase(), doc: document.getElementById('vis-doc').value.toUpperCase(), empresa: document.getElementById('vis-empresa').value.toUpperCase(), contato: document.getElementById('vis-contato').value.toUpperCase(), responsavel: document.getElementById('vis-responsavel').value.toUpperCase(), finalidade: document.getElementById('vis-finalidade').value.toUpperCase(), entrada: horaEntrada, status: idEdicao ? document.getElementById('vis-status-edit').value : 'Ativo', saida: null };
            if(idEdicao) { const ant = visitantes.find(v => v.id == id); if (!novoVisitante.foto && ant && ant.foto) novoVisitante.foto = ant.foto; if (novoVisitante.status === 'Saiu' && (!ant || !ant.saida)) novoVisitante.saida = new Date().toISOString(); else if (ant && ant.saida) novoVisitante.saida = ant.saida; registrarLog('Edição', 'Visitantes', `Alterou visitante: ${novoVisitante.nome}`); }
            const { error } = await sb.from('visitantes').upsert(novoVisitante);
            if(error) alert('Erro: ' + error.message); else { syncSheets('visitantes', 'upsert', novoVisitante); cancelarEdicaoVisitante(); carregarDados(); }
        });

        window.editarVisitante = function(id) {
            const v = visitantes.find(i => i.id == id); if(!v) return;
            document.getElementById('visitante-id-edit').value = v.id;
            document.getElementById('vis-nome').value = v.nome;
            document.getElementById('vis-doc').value = v.doc;
            document.getElementById('vis-empresa').value = v.empresa;
            document.getElementById('vis-contato').value = v.contato;
            document.getElementById('vis-responsavel').value = v.responsavel;
            document.getElementById('vis-finalidade').value = v.finalidade;
            if(v.entrada) { const dataLocal = new Date(v.entrada); dataLocal.setMinutes(dataLocal.getMinutes() - dataLocal.getTimezoneOffset()); document.getElementById('vis-entrada').value = dataLocal.toISOString().slice(0,16); }
            const preview = document.getElementById('vis-preview');
            const defaultIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Cpath fill='%23ccc' d='M50 50c-13.8 0-25-11.2-25-25s11.2-25 25-25 25 11.2 25 25-11.2 25-25 25zm0 10c16.7 0 50 8.3 50 25v15H0v-15c0-16.7 33.3-25 50-25z'/%3E%3C/svg%3E";
            if (v.foto) { preview.src = v.foto; document.getElementById('vis-foto-base64').value = v.foto; } else { preview.src = defaultIcon; document.getElementById('vis-foto-base64').value = ""; }
            document.getElementById('titulo-form-visitante').innerHTML = '<i class="fas fa-edit"></i> Editando Visitante';
            const btn = document.getElementById('btn-submit-vis'); btn.innerText = "Salvar"; btn.style.background = "linear-gradient(135deg, var(--edit), #d97706)";
            document.getElementById('btn-cancel-vis').style.display = "block";
            const selStat = document.getElementById('vis-status-edit'); selStat.style.display="block"; selStat.value = v.status;
            document.getElementById('visitantes').scrollIntoView({behavior:'smooth'});
        }

        window.deletarVisitante = async function(id) {
            if(confirm('Excluir?')) { const item = visitantes.find(v => v.id == id); await sb.from('visitantes').delete().eq('id', id); syncSheets('visitantes','delete',{id}); registrarLog('Exclusão', 'Visitantes', `Removeu visitante: ${item ? item.nome : id}`); if(document.getElementById('visitante-id-edit').value == id) cancelarEdicaoVisitante(); carregarDados(); }
        }

        window.cancelarEdicaoVisitante = function() {
            document.getElementById('visitante-id-edit').value = ""; formVis.reset();
            document.getElementById('vis-entrada').value = DateUtils.getToInput();
            document.getElementById('titulo-form-visitante').innerHTML = '<i class="fas fa-user-plus"></i> Cadastrar Visitante';
            const btn = document.getElementById('btn-submit-vis'); btn.innerText = "Registrar Entrada"; btn.style.background = "linear-gradient(135deg, var(--accent), #6366f1)";
            document.getElementById('btn-cancel-vis').style.display = "none"; document.getElementById('vis-status-edit').style.display="none";
            document.getElementById('vis-preview').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Cpath fill='%23ccc' d='M50 50c-13.8 0-25-11.2-25-25s11.2-25 25-25 25 11.2 25 25-11.2 25-25 25zm0 10c16.7 0 50 8.3 50 25v15H0v-15c0-16.7 33.3-25 50-25z'/%3E%3C/svg%3E";
            document.getElementById('vis-foto-base64').value = ""; pararCamera();
        }

        window.renderizarApenasVisitantes = function() {
            const mes = document.getElementById('filtro-mes-vis').value;
            const dia = document.getElementById('filtro-dia-vis').value;
            const termo = document.getElementById('filtro-busca-vis').value.toUpperCase();
            const lista = visitantes.filter(v => { const bateMes = !mes || (v.entrada||'').startsWith(mes); const bateDia = !dia || diaLocalISO(v.entrada) === dia; const bateTermo = !termo || (v.nome||'').toUpperCase().includes(termo) || (v.doc||'').toUpperCase().includes(termo) || (v.empresa||'').toUpperCase().includes(termo); return bateMes && bateDia && bateTermo; });
            document.getElementById('dash-visitantes-ativos').innerText = lista.filter(v => v.status === 'Ativo').length;
            document.getElementById('dash-visitantes-total').innerText = lista.length;
            const tbody = document.querySelector('#tabela-visitantes tbody');
            const btnExport = document.getElementById('btn-export-visitantes');
            if (pode('visitantes', 'exportar')) btnExport.style.display = 'inline-flex'; else btnExport.style.display = 'none';
            const defaultIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23eee'/%3E%3Cpath fill='%23ccc' d='M50 50c-13.8 0-25-11.2-25-25s11.2-25 25-25 25 11.2 25 25-11.2 25-25 25zm0 10c16.7 0 50 8.3 50 25v15H0v-15c0-16.7 33.3-25 50-25z'/%3E%3C/svg%3E";
            renderPaginated({
                tableId: 'tabela-visitantes', items: lista, colspan: 6,
                emptyMsg: 'Nenhum visitante encontrado.',
                filterKey: mes + '|' + dia + '|' + termo,
                rerender: window.renderizarApenasVisitantes,
                rowFn: (v) => {
                    const badge = v.status === 'Ativo' ? '<span class="badge bg-visitante-ativo">NA EMPRESA</span>' : '<span class="badge bg-saiu">SAIU</span>';
                    const dataEnt = formatarDataHoraReal(v.entrada);
                    const dataSai = v.saida ? formatarDataHoraReal(v.saida) : '-';
                    const btnBaixa = (v.status === 'Ativo' && pode('visitantes', 'editar')) ? `<button onclick="baixaVisitante(${v.id})" class="action-btn btn-baixa"><i class="fas fa-sign-out-alt"></i> Saída</button>` : '<i class="fas fa-check" style="color:var(--success);"></i>';
                    let buttons = '';
                    if (pode('visitantes', 'editar')) buttons += `<button onclick="editarVisitante(${v.id})" class="action-btn btn-edit"><i class="fas fa-pen"></i></button>`;
                    if (pode('visitantes', 'excluir')) buttons += `<button onclick="deletarVisitante(${v.id})" class="action-btn btn-delete"><i class="fas fa-trash"></i></button>`;
                    const imgTag = `<img src="${esc(v.foto || defaultIcon)}" class="avatar-table">`;
                    return `<tr><td>${badge}</td><td>${imgTag}<strong>${esc(v.nome)}</strong><br><small style="color:var(--text-muted)">${esc(v.contato)}</small></td><td>${esc(v.empresa) || '-'}<br><small style="color:var(--text-muted)">${esc(v.doc)}</small></td><td>${esc(v.responsavel)}<br><small style="color:var(--text-muted)">${esc(v.finalidade)}</small></td><td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;">Ent: ${dataEnt}<br>Sai: ${dataSai}</td><td style="min-width:140px">${btnBaixa}${buttons}</td></tr>`;
                }
            });
        }

        window.baixaVisitante = function(id) {
            const v = visitantes.find(i => i.id == id); if (!v) return;
            document.getElementById('saida-visitante-id').value = id;
            document.getElementById('saida-info-visitante').innerHTML = `<strong>${esc(v.nome)}</strong>${v.empresa ? ' — ' + esc(v.empresa) : ''} <br><small style="color:var(--text-muted)">Entrada: ${formatarDataHoraReal(v.entrada)}</small>`;
            document.getElementById('saida-vis-hora').value = DateUtils.getToInput();
            document.getElementById('modal-saida-visitante').style.display = 'flex';
        }

        window.fecharModalSaidaVisitante = function() {
            document.getElementById('modal-saida-visitante').style.display = 'none';
        }

        window.confirmarSaidaVisitante = async function() {
            const id = document.getElementById('saida-visitante-id').value;
            const horaLocal = document.getElementById('saida-vis-hora').value;
            if (!horaLocal) { alert('Informe o horário de saída.'); return; }
            const upd = { status: 'Saiu', saida: DateUtils.toDatabaseISO(horaLocal) };
            await sb.from('visitantes').update(upd).eq('id', id);
            const item = visitantes.find(v => v.id == id);
            if (item) {
                registrarLog('Saída', 'Visitantes', `Saída: ${item.nome}`);
                syncSheets('visitantes', 'upsert', { ...item, ...upd });
            }
            fecharModalSaidaVisitante();
            carregarDados();
        }

        // ---- VEÍCULOS ----
        window.atualizarLabels = function() {
            const tipo = document.querySelector('input[name="tipoFluxo"]:checked').value;
            const btn = document.getElementById('btn-submit-veiculo');
            if (!document.getElementById('veiculo-id-edit').value) btn.innerText = "Registrar Entrada";
            if (tipo === 'servidor') { btn.style.background = `linear-gradient(135deg, var(--servidor), #1d4ed8)`; document.getElementById('veiculo-setor').placeholder = "Setor de Origem"; }
            else { btn.style.background = `linear-gradient(135deg, var(--visitante), #6d28d9)`; document.getElementById('veiculo-setor').placeholder = "Empresa / Setor Visitado"; }
        }

        const formVeiculo = document.getElementById('form-veiculo');
        formVeiculo.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('veiculo-id-edit').value;
            const id = idEdicao || Date.now();
            const tipo = document.querySelector('input[name="tipoFluxo"]:checked').value;
            const horaEntrada = idEdicao ? dataLocalParaISO(document.getElementById('veiculo-hora-saida').value) : dataLocalParaISO(DateUtils.getToInput());
            const novoVeiculo = { id, tipo, carro: document.getElementById('veiculo-carro').value.toUpperCase(), motorista: document.getElementById('veiculo-motorista').value.toUpperCase(), setor: document.getElementById('veiculo-setor').value.toUpperCase(), contato: document.getElementById('veiculo-contato').value.toUpperCase(), destino: document.getElementById('veiculo-destino').value.toUpperCase(), hora_inicial: horaEntrada, status: idEdicao ? document.getElementById('veiculo-status-edit').value : 'Aberto', hora_final: null };
            if(idEdicao) { const ant = frota.find(f => f.id == id); if (novoVeiculo.status === 'Aberto') { novoVeiculo.hora_final = null; } else if (ant && ant.hora_final) { novoVeiculo.hora_final = ant.hora_final; } registrarLog('Edição', 'Garagem', `Alterou registro: ${novoVeiculo.carro}`); }
            const { error } = await sb.from('frota').upsert(novoVeiculo);
            if(error) alert('Erro: ' + error.message); else { syncSheets('frota', 'upsert', novoVeiculo); cancelarEdicaoVeiculo(); window.atualizarLabels(); carregarDados(); }
        });

        window.editarVeiculo = function(id) {
            const f = frota.find(i => i.id == id); if (!f) return;
            document.getElementById('veiculo-id-edit').value = f.id;
            document.getElementById('veiculo-carro').value = f.carro;
            document.getElementById('veiculo-motorista').value = f.motorista;
            document.getElementById('veiculo-setor').value = f.setor || '';
            document.getElementById('veiculo-contato').value = f.contato || '';
            document.getElementById('veiculo-destino').value = f.destino;
            if(f.hora_inicial) { const dataLocal = new Date(f.hora_inicial); dataLocal.setMinutes(dataLocal.getMinutes() - dataLocal.getTimezoneOffset()); document.getElementById('veiculo-hora-saida').value = dataLocal.toISOString().slice(0,16); }
            if (f.tipo === 'servidor') document.getElementById('radio-servidor').checked = true; else document.getElementById('radio-visitante').checked = true;
            document.getElementById('titulo-form-veiculo').innerHTML = '<i class="fas fa-edit"></i> Editando';
            const btn = document.getElementById('btn-submit-veiculo'); btn.innerText = "Salvar"; btn.style.background = "linear-gradient(135deg, var(--edit), #d97706)";
            document.getElementById('btn-cancel-veiculo').style.display = "block";
            document.getElementById('container-status-veiculo').style.display = "block";
            document.getElementById('veiculo-status-edit').value = f.status;
            window.atualizarLabels();
            document.getElementById('veiculos').scrollIntoView({behavior: 'smooth'});
        }

        window.deletarVeiculo = async function(id) {
            if(confirm('Excluir este registro?')) { const item = frota.find(f => f.id == id); await sb.from('frota').delete().eq('id', id); syncSheets('frota','delete',{id}); registrarLog('Exclusão', 'Garagem', `Removeu veículo: ${item ? item.carro : id}`); if(document.getElementById('veiculo-id-edit').value == id) cancelarEdicaoVeiculo(); carregarDados(); }
        }

        window.cancelarEdicaoVeiculo = function() {
            document.getElementById('veiculo-id-edit').value = ""; formVeiculo.reset();
            document.getElementById('veiculo-hora-saida').value = DateUtils.getToInput();
            document.getElementById('titulo-form-veiculo').innerHTML = '<i class="fas fa-parking"></i> Registrar Entrada';
            document.getElementById('btn-cancel-veiculo').style.display = "none";
            document.getElementById('container-status-veiculo').style.display = "none";
            document.getElementById('radio-servidor').checked = true; window.atualizarLabels();
        }

        window.renderizarApenasFrota = function() {
            const mes = document.getElementById('filtro-mes-frota').value;
            const dia = document.getElementById('filtro-dia-frota').value;
            const busca = document.getElementById('filtro-busca-frota').value.toUpperCase();
            const lista = frota.filter(f => { const bData = !mes || (f.hora_inicial||'').startsWith(mes); const bDia = !dia || diaLocalISO(f.hora_inicial) === dia; const bTexto = !busca || ((f.motorista||'')+(f.carro||'')+(f.setor||'')).toUpperCase().includes(busca); return bData && bDia && bTexto; });
            document.getElementById('dash-frota-total').innerText = lista.length;
            document.getElementById('dash-frota-estacionados').innerText = lista.filter(f => f.status === 'Aberto').length;
            document.getElementById('dash-servidor-count').innerText = lista.filter(f => f.tipo === 'servidor').length;
            document.getElementById('dash-visitante-count').innerText = lista.filter(f => f.tipo === 'visitante').length;
            const tbody = document.querySelector('#tabela-veiculos tbody');
            const btnExport = document.getElementById('btn-export-veiculos');
            if (pode('veiculos', 'exportar')) btnExport.style.display = 'inline-flex'; else btnExport.style.display = 'none';
            renderPaginated({
                tableId: 'tabela-veiculos', items: lista, colspan: 8,
                emptyMsg: 'Nenhum veículo encontrado.',
                filterKey: mes + '|' + dia + '|' + busca,
                rerender: window.renderizarApenasFrota,
                rowFn: (f) => {
                    const badge = f.status === 'Aberto' ? '<span class="badge bg-estacionado">ESTACIONADO</span>' : '<span class="badge bg-saiu">FINALIZADO</span>';
                    const icon = f.tipo === 'servidor' ? '<span style="color:var(--servidor);font-size:0.75rem;font-weight:700;"><i class="fas fa-id-badge"></i> Servidor</span>' : '<span style="color:var(--visitante);font-size:0.75rem;font-weight:700;"><i class="fas fa-user-tag"></i> Visitante</span>';
                    const dIn = formatarDataHoraReal(f.hora_inicial);
                    const dOut = f.hora_final ? formatarDataHoraReal(f.hora_final) : '-';
                    let tempoStr = '--';
                    if (f.hora_inicial) {
                        const ini = new Date(f.hora_inicial);
                        const fim = f.hora_final ? new Date(f.hora_final) : new Date();
                        tempoStr = formatarTempo(fim - ini);
                    }
                    const tempoDisplay = (f.status === 'Fechado')
                        ? `<span class="time-badge"><i class="fas fa-stopwatch"></i> ${tempoStr}</span>`
                        : `<span class="time-badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a"><i class="fas fa-hourglass-half"></i> ${tempoStr}</span>`;
                    const btnBaixa = (f.status === 'Aberto' && pode('veiculos', 'editar')) ? `<button onclick="baixaVeiculo(${f.id})" class="action-btn btn-baixa"><i class="fas fa-sign-out-alt"></i> Saída</button>` : '<i class="fas fa-check" style="color:var(--success);"></i>';
                    let buttons = '';
                    if (pode('veiculos', 'editar')) buttons += `<button onclick="editarVeiculo(${f.id})" class="action-btn btn-edit"><i class="fas fa-pen"></i></button>`;
                    if (pode('veiculos', 'excluir')) buttons += `<button onclick="deletarVeiculo(${f.id})" class="action-btn btn-delete"><i class="fas fa-trash"></i></button>`;
                    return `<tr><td>${badge}</td><td>${icon}</td><td><strong>${esc(f.motorista)}</strong><br><small style="color:var(--text-muted)">${esc(f.contato)}</small></td><td>${esc(f.carro)}</td><td>${esc(f.setor) || '-'}</td><td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;">Ent: ${dIn}<br>Sai: ${dOut}</td><td>${tempoDisplay}</td><td style="min-width:140px">${btnBaixa}${buttons}</td></tr>`;
                }
            });
        }

        window.baixaVeiculo = function(id) {
            const f = frota.find(v => v.id == id); if (!f) return;
            document.getElementById('saida-veiculo-id').value = id;
            document.getElementById('saida-info-veiculo').innerHTML = `<strong>${esc(f.carro)}</strong> — ${esc(f.motorista)} <br><small style="color:var(--text-muted)">Entrada: ${formatarDataHoraReal(f.hora_inicial)}</small>`;
            document.getElementById('saida-hora').value = DateUtils.getToInput();
            document.getElementById('modal-saida-veiculo').style.display = 'flex';
        }

        window.fecharModalSaida = function() {
            document.getElementById('modal-saida-veiculo').style.display = 'none';
        }

        window.confirmarSaidaVeiculo = async function() {
            const id = document.getElementById('saida-veiculo-id').value;
            const horaLocal = document.getElementById('saida-hora').value;
            if (!horaLocal) { alert('Informe o horário de saída.'); return; }
            const horaISO = DateUtils.toDatabaseISO(horaLocal);
            const upd = { hora_final: horaISO, status: 'Fechado' };
            await sb.from('frota').update(upd).eq('id', id);
            const item = frota.find(f => f.id == id);
            if (item) {
                registrarLog('Saída', 'Garagem', `Saída: ${item.carro} — ${item.motorista}`);
                syncSheets('frota', 'upsert', { ...item, ...upd });
            }
            fecharModalSaida();
            carregarDados();
        }

        // ---- EVENTOS ----
        const formEvento = document.getElementById('form-evento');
        formEvento.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('evento-id-edit').value;
            const id = idEdicao || Date.now();
            const novoEvento = { id, tipo: document.querySelector('input[name="tipoEvento"]:checked').value, nome: document.getElementById('evento-nome').value.toUpperCase(), organizador: document.getElementById('evento-organizador').value.toUpperCase(), data: document.getElementById('evento-data').value, publico: parseInt(document.getElementById('evento-publico').value) || 0, local: document.getElementById('evento-local').value.toUpperCase(), coffee: document.getElementById('evento-coffee').checked, obs: document.getElementById('evento-obs').value.toUpperCase() };
            if(idEdicao) registrarLog('Edição', 'Eventos', `Alterou evento: ${novoEvento.nome}`);
            const { error } = await sb.from('eventos').upsert(novoEvento);
            if(error) alert('Erro ao salvar evento: ' + error.message); else { syncSheets('eventos','upsert',novoEvento); cancelarEdicaoEvento(); carregarDados(); }
        });

        window.editarEvento = function(id) {
            const ev = eventos.find(item => item.id == id); if (!ev) return;
            document.getElementById('evento-id-edit').value = ev.id;
            document.getElementById('evento-nome').value = ev.nome;
            document.getElementById('evento-organizador').value = ev.organizador;
            document.getElementById('evento-data').value = ev.data;
            document.getElementById('evento-publico').value = ev.publico;
            document.getElementById('evento-local').value = ev.local;
            document.getElementById('evento-coffee').checked = ev.coffee || false;
            document.getElementById('evento-obs').value = ev.obs || "";
            const radios = document.getElementsByName('tipoEvento');
            for(let i=0; i<radios.length; i++) { if(radios[i].value === ev.tipo) radios[i].checked = true; }
            document.getElementById('titulo-form-evento').innerHTML = '<i class="fas fa-edit"></i> Editando Evento';
            const btn = document.getElementById('btn-submit-evento'); btn.innerText = "Salvar Evento"; btn.style.background = "linear-gradient(135deg, var(--edit), #d97706)";
            document.getElementById('btn-cancel-evento').style.display = "block";
            document.getElementById('eventos').scrollIntoView({behavior: 'smooth'});
        }

        window.cancelarEdicaoEvento = function() {
            document.getElementById('evento-id-edit').value = ""; formEvento.reset();
            document.getElementById('evento-data').value = DateUtils.getToInput().slice(0, 10);
            document.getElementById('evento-coffee').checked = false;
            document.getElementById('evento-obs').value = "";
            document.getElementById('titulo-form-evento').innerHTML = '<i class="fas fa-calendar-plus"></i> Registrar Evento';
            const btn = document.getElementById('btn-submit-evento'); btn.innerText = "Salvar Evento"; btn.style.background = "linear-gradient(135deg, var(--evento), #be185d)";
            document.getElementById('btn-cancel-evento').style.display = "none";
        }

        window.deletarEvento = async function(id) {
            if(confirm('Excluir este evento?')) { const item = eventos.find(e => e.id == id); await sb.from('eventos').delete().eq('id', id); syncSheets('eventos','delete',{id}); registrarLog('Exclusão', 'Eventos', `Removeu evento: ${item ? item.nome : id}`); if(document.getElementById('evento-id-edit').value == id) cancelarEdicaoEvento(); carregarDados(); }
        }

        window.renderizarApenasEventos = function() {
            const mes = document.getElementById('filtro-mes-evento').value;
            const dia = document.getElementById('filtro-dia-evento').value;
            const busca = document.getElementById('filtro-busca-evento').value.toUpperCase();
            const lista = eventos.filter(ev => { const bData = !mes || (ev.data||'').startsWith(mes); const bDia = !dia || (ev.data||'') === dia; const bTexto = !busca || ((ev.nome||'') + (ev.organizador||'') + (ev.local||'')).toUpperCase().includes(busca); return bData && bDia && bTexto; });
            document.getElementById('dash-eventos-qtd').innerText = lista.length;
            document.getElementById('dash-eventos-interno').innerText = lista.filter(e => e.tipo === 'Interno').length;
            document.getElementById('dash-eventos-externo').innerText = lista.filter(e => e.tipo === 'Externo').length;
            document.getElementById('dash-eventos-publico').innerText = lista.reduce((sum, ev) => sum + (parseInt(ev.publico) || 0), 0);
            const tbody = document.querySelector('#tabela-eventos tbody');
            const btnExport = document.getElementById('btn-export-eventos');
            if (pode('eventos', 'exportar')) btnExport.style.display = 'inline-flex'; else btnExport.style.display = 'none';
            renderPaginated({
                tableId: 'tabela-eventos', items: lista, colspan: 6,
                emptyMsg: 'Nenhum evento encontrado.',
                filterKey: mes + '|' + dia + '|' + busca,
                rerender: window.renderizarApenasEventos,
                rowFn: (ev) => {
                    const badgeClass = ev.tipo === 'Interno' ? 'bg-interno' : 'bg-externo';
                    const iconCoffee = ev.coffee ? '<i class="fas fa-coffee" style="color:#92400e;margin-left:6px;" title="Coffee Break"></i>' : '';
                    const obsText = ev.obs ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;margin-top:3px;border-top:1px dashed var(--border);padding-top:3px">${esc(ev.obs)}</div>` : '';
                    let buttons = '';
                    if (pode('eventos', 'editar')) buttons += `<button onclick="editarEvento(${ev.id})" class="action-btn btn-edit"><i class="fas fa-pen"></i></button>`;
                    if (pode('eventos', 'excluir')) buttons += `<button onclick="deletarEvento(${ev.id})" class="action-btn btn-delete"><i class="fas fa-trash"></i></button>`;
                    return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;"><strong>${formatarData(ev.data)}</strong></td><td><span class="badge ${badgeClass}">${esc(ev.tipo)}</span></td><td><strong>${esc(ev.nome)}</strong>${iconCoffee}<br><small style="color:var(--text-muted)">${esc(ev.local)}</small>${obsText}</td><td>${esc(ev.organizador)}</td><td><strong style="font-family:'JetBrains Mono',monospace;">${esc(ev.publico)}</strong></td><td style="min-width:100px">${buttons}</td></tr>`;
                }
            });
        }

        // ---- CRACHÁS ----
        const formCracha = document.getElementById('form-cracha');
        formCracha.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('cracha-id-edit').value;
            const id = idEdicao || Date.now();
            const novoCracha = { id, nome: document.getElementById('cracha-nome').value.toUpperCase(), doc_identidade: document.getElementById('cracha-doc').value.toUpperCase(), setor: document.getElementById('cracha-setor').value.toUpperCase(), cargo: document.getElementById('cracha-cargo').value.toUpperCase(), sala: document.getElementById('cracha-sala').value.toUpperCase(), ramal: document.getElementById('cracha-ramal').value.toUpperCase(), tipo: document.getElementById('cracha-tipo').value, status: document.getElementById('cracha-status').value, data_solicitacao: document.getElementById('cracha-data').value, data_entrega: (document.getElementById('cracha-status').value === 'Entregue') ? new Date().toISOString() : null };
            if (idEdicao) registrarLog('Edição', 'Crachás', `Editou crachá de: ${novoCracha.nome}`); else registrarLog('Criação', 'Crachás', `Solicitou crachá para: ${novoCracha.nome}`);
            const { error } = await sb.from('crachas').upsert(novoCracha);
            if(error) alert('Erro ao salvar crachá: ' + error.message); else { syncSheets('crachas','upsert',novoCracha); cancelarEdicaoCracha(); carregarDados(); }
        });

        window.editarCracha = function(id) {
            const c = crachas.find(item => item.id == id); if (!c) return;
            document.getElementById('cracha-id-edit').value = c.id;
            document.getElementById('cracha-nome').value = c.nome;
            document.getElementById('cracha-doc').value = c.doc_identidade || '';
            document.getElementById('cracha-setor').value = c.setor;
            document.getElementById('cracha-cargo').value = c.cargo || '';
            document.getElementById('cracha-sala').value = c.sala || '';
            document.getElementById('cracha-ramal').value = c.ramal || '';
            document.getElementById('cracha-tipo').value = c.tipo;
            document.getElementById('cracha-data').value = c.data_solicitacao;
            document.getElementById('cracha-status').value = c.status;
            document.getElementById('titulo-form-cracha').innerHTML = '<i class="fas fa-edit"></i> Editando Crachá';
            const btn = document.getElementById('btn-submit-cracha'); btn.innerText = "Salvar Alterações"; btn.style.background = "linear-gradient(135deg, var(--edit), #d97706)";
            document.getElementById('btn-cancel-cracha').style.display = "block";
            document.getElementById('crachas').scrollIntoView({behavior: 'smooth'});
        }

        window.cancelarEdicaoCracha = function() {
            document.getElementById('cracha-id-edit').value = ""; formCracha.reset();
            document.getElementById('cracha-data').value = DateUtils.getToInput().slice(0, 10);
            document.getElementById('titulo-form-cracha').innerHTML = '<i class="fas fa-id-card"></i> Novo Crachá';
            const btn = document.getElementById('btn-submit-cracha'); btn.innerText = "Salvar Crachá"; btn.style.background = "linear-gradient(135deg, var(--cracha), #5b21b6)";
            document.getElementById('btn-cancel-cracha').style.display = "none";
        }

        window.deletarCracha = async function(id) {
            if(confirm('Excluir este crachá?')) { const item = crachas.find(c => c.id == id); await sb.from('crachas').delete().eq('id', id); syncSheets('crachas','delete',{id}); registrarLog('Exclusão', 'Crachás', `Removeu crachá: ${item ? item.nome : id}`); if(document.getElementById('cracha-id-edit').value == id) cancelarEdicaoCracha(); carregarDados(); }
        }

        window.renderizarApenasCrachas = function() {
            const busca = document.getElementById('filtro-busca-cracha').value.toUpperCase();
            const statusFiltro = document.getElementById('filtro-status-cracha').value;
            const lista = crachas.filter(c => { const termo = ((c.nome||'') + (c.setor||'') + (c.doc_identidade||'')).toUpperCase(); const bateTexto = !busca || termo.includes(busca); const bateStatus = !statusFiltro || c.status === statusFiltro; return bateTexto && bateStatus; });
            document.getElementById('dash-cracha-solicitado').innerText = lista.filter(c => c.status === 'Solicitado').length;
            document.getElementById('dash-cracha-confeccionado').innerText = lista.filter(c => c.status === 'Confeccionado').length;
            document.getElementById('dash-cracha-entregue').innerText = lista.filter(c => c.status === 'Entregue').length;
            const tbody = document.querySelector('#tabela-crachas tbody');
            const btnExport = document.getElementById('btn-export-crachas');
            if (pode('crachas', 'exportar')) btnExport.style.display = 'inline-flex'; else btnExport.style.display = 'none';
            renderPaginated({
                tableId: 'tabela-crachas', items: lista, colspan: 6,
                emptyMsg: 'Nenhum crachá encontrado.',
                filterKey: busca + '|' + statusFiltro,
                rerender: window.renderizarApenasCrachas,
                rowFn: (c) => {
                    let badgeClass = c.status === 'Solicitado' ? 'bg-cracha-solicitado' : c.status === 'Confeccionado' ? 'bg-cracha-confeccionado' : 'bg-cracha-entregue';
                    const dataEnt = c.data_entrega ? `<br><small style="color:var(--success);font-weight:600;"><i class="fas fa-check"></i> ${new Date(c.data_entrega).toLocaleDateString('pt-BR')}</small>` : '';
                    let buttons = '';
                    if (pode('crachas', 'editar')) buttons += `<button onclick="editarCracha(${c.id})" class="action-btn btn-edit"><i class="fas fa-pen"></i></button>`;
                    if (pode('crachas', 'excluir')) buttons += `<button onclick="deletarCracha(${c.id})" class="action-btn btn-delete"><i class="fas fa-trash"></i></button>`;
                    return `<tr><td style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;">${formatarData(c.data_solicitacao)}</td><td><strong>${esc(c.nome)}</strong><br><small style="color:var(--text-muted)">DOC: ${esc(c.doc_identidade) || '-'}</small></td><td>${esc(c.setor)}<br><small style="color:var(--text-muted)">${esc(c.cargo) || '-'}</small></td><td>Sala: <strong>${esc(c.sala) || '-'}</strong><br><small style="color:var(--text-muted)">Ramal: ${esc(c.ramal) || '-'}</small></td><td><span class="badge ${badgeClass}">${esc(c.status)}</span>${dataEnt}</td><td>${buttons}</td></tr>`;
                }
            });
        }

        // Upload de foto
        document.getElementById('vis-foto-input').addEventListener('change', function(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) { document.getElementById('vis-foto-base64').value = ev.target.result; document.getElementById('vis-preview').src = ev.target.result; };
            reader.readAsDataURL(file);
        });

        // Inicializa data das ocorrências
        document.getElementById('oco-data').value = DateUtils.getToInput();

        // ================================================================
        // WHATSAPP
        // ================================================================
        window.enviarWhatsAppDemanda = function(id) {
            const d = demandas.find(i => i.id == id); if (!d) return;
            const ic = d.prioridade === 'Alta' ? '🚨' : '🔧';
            let t = `${ic} *ORDEM DE SERVIÇO* ${ic}\n\n`;
            if (d.numero_os) t += `*Nº O.S.:* ${d.numero_os}\n`;
            t += `*Status:* ${d.status}\n`;
            t += `*Prioridade:* ${d.prioridade}\n`;
            t += `*Serviço:* ${d.titulo}\n`;
            t += `*Setor:* ${d.setor}\n`;
            t += `*Data:* ${formatarData(d.data)} ${d.hora || ''}\n`;
            t += `*Solicitante:* ${d.solicitante}\n`;
            if (d.contratada) t += `*Contratada:* ${d.contratada}\n`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(t)}`, '_blank');
        };

        window.enviarWhatsAppOcorrencia = function(id) {
            const o = ocorrencias.find(i => i.id == id); if (!o) return;
            const ic = (o.gravidade === 'Crítica' || o.gravidade === 'Alta') ? '🚨' : o.gravidade === 'Baixa' ? 'ℹ️' : '⚠️';
            const dtStr = o.data_hora ? formatarDataHoraReal(o.data_hora) : '';
            let t = `${ic} *REGISTRO DE OCORRÊNCIA* ${ic}\n\n`;
            if (o.numero) t += `*Nº:* ${o.numero}\n`;
            t += `*Status:* ${o.status}\n`;
            t += `*Gravidade:* ${o.gravidade}\n`;
            t += `*Categoria:* ${o.categoria}\n`;
            t += `*Unidade:* ${o.unidade} — ${o.local}\n`;
            t += `*Data/Hora:* ${dtStr}\n`;
            t += `*Responsável:* ${o.responsavel}\n\n`;
            t += `*Descrição:*\n${o.descricao}`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(t)}`, '_blank');
        };

        // ================================================================
        // OCORRÊNCIAS — CRUD
        // ================================================================
