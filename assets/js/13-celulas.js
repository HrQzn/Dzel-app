        // ════════════════════════════════════════════════════════════════
        // CÉLULAS DAS LISTAS no desenho do canvas (Recepção, Garagem,
        // Eventos, Crachás e Ocorrências). Só montam HTML; os dados e as
        // regras de cada aba continuam nos arquivos de cada módulo.
        // ════════════════════════════════════════════════════════════════
        (function () {
            const dois = n => String(n).padStart(2, '0');
            const data = v => { if (!v) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v); return isNaN(d) ? null : d; };
            window.celPill = (texto, tom) => `<span class="cel-pill ${tom || 'neutro'}">${esc(texto)}</span>`;
            window.celDuas = (linha1, linha2) => `<div class="cel-duas"><span>${linha1 || '-'}</span>${linha2 ? `<small>${linha2}</small>` : ''}</div>`;
            window.celChip = (texto, tom) => `<span class="cel-chip ${tom || ''}">${esc(texto)}</span>`;
            window.celDiaMes = (v) => { const d = data(v); return d ? dois(d.getDate()) + '/' + dois(d.getMonth() + 1) : '-'; };
            window.celQuando = (v) => { const d = data(v); return d ? `${dois(d.getDate())}/${dois(d.getMonth() + 1)}, ${dois(d.getHours())}:${dois(d.getMinutes())}` : '-'; };
            window.celSaida = (ent, sai) => {
                const a = data(ent), b = data(sai); if (!b) return '';
                const hora = `${dois(b.getHours())}:${dois(b.getMinutes())}`;
                return a && a.toDateString() === b.toDateString() ? 'saiu às ' + hora : `saiu em ${dois(b.getDate())}/${dois(b.getMonth() + 1)}, ${hora}`;
            };
            window.celIniciais = (nome) => {
                const p = String(nome || '').trim().split(/\s+/).filter(x => x.length > 2 || /^[A-ZÀ-Ú]/i.test(x));
                return esc(((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase());
            };
            // Mostra só três dígitos do documento; o número inteiro fica na edição
            window.celMascara = (doc) => {
                const s = String(doc || ''); const dig = s.replace(/\D/g, '');
                if (dig.length < 5) return s;
                const mostrar = new Set([dig.length - 4, dig.length - 3, dig.length - 2]);
                let i = -1;
                return s.replace(/\d/g, () => { i++; return mostrar.has(i) ? dig[i] : '•'; });
            };
            // "GOL - ABC1D23" → modelo em cima e placa embaixo
            window.celVeiculo = (carro) => {
                const s = String(carro || '').trim();
                const m = s.match(/^(.*?)[\s\-–,/]+([A-Z]{3}-?\d[A-Z0-9]\d{2})$/i);
                return m ? celDuas(esc(m[1]), `<span class="cel-mono">${esc(m[2].toUpperCase())}</span>`) : celDuas(esc(s) || '-', '');
            };
            window.celAcoes = (html) => `<div class="cel-acoes">${html || ''}</div>`;
        })();

        // ════════════════════════════════════════════════════════════════
        // EVENTOS: agenda do mês ao lado da lista. Clicar num dia filtra a
        // lista por aquele dia; clicar de novo tira o filtro.
        // ════════════════════════════════════════════════════════════════
        (function () {
            const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const dois = n => String(n).padStart(2, '0');
            const grupo = e => /TEATRO/i.test(e.local || '') ? 'rosa' : /NOBRE/i.test(e.local || '') ? 'ciano' : 'cinza';
            const NOMES = { rosa: 'Teatro', ciano: 'Salão Nobre', cinza: 'Outros espaços' };
            window.renderizarAgendaEventos = function () {
                const el = document.getElementById('ev-agenda'); if (!el || typeof eventos === 'undefined') return;
                const hoje = DateUtils.getNowBRT();
                const mesSel = (document.getElementById('filtro-mes-evento') || {}).value;
                const diaSel = (document.getElementById('filtro-dia-evento') || {}).value || '';
                const mes = mesSel || (diaSel ? diaSel.slice(0, 7) : hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1));
                const [y, m] = mes.split('-').map(Number);
                const doMes = eventos.filter(e => (e.data || '').startsWith(mes));
                const porDia = {}; const porGrupo = {};
                doMes.forEach(e => { const d = parseInt(e.data.slice(8, 10), 10); (porDia[d] = porDia[d] || []).push(e); porGrupo[grupo(e)] = (porGrupo[grupo(e)] || 0) + 1; });
                const inicio = new Date(y, m - 1, 1).getDay();
                const total = new Date(y, m, 0).getDate();
                const hojeIso = hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1) + '-' + dois(hoje.getDate());
                let dias = '';
                for (let i = 0; i < inicio; i++) dias += '<span class="ag-vazio"></span>';
                for (let d = 1; d <= total; d++) {
                    const iso = `${mes}-${dois(d)}`; const evs = porDia[d] || [];
                    const dow = (inicio + d - 1) % 7;
                    const cls = ['ag-dia', evs.length ? 'tem' : '', dow === 0 || dow === 6 ? 'fds' : '', iso === diaSel ? 'sel' : '', iso === hojeIso ? 'hoje' : ''].filter(Boolean).join(' ');
                    const rot = `${d} de ${MESES[m - 1]}: ${evs.length ? (evs.length === 1 ? '1 evento' : evs.length + ' eventos') : 'sem eventos'}`;
                    const marcas = evs.slice(0, 4).map(e => `<i class="${grupo(e)}"></i>`).join('');
                    dias += `<button type="button" class="${cls}" data-dia="${iso}" aria-label="${rot}" title="${evs.map(e => esc(e.nome)).join('\n') || rot}" aria-pressed="${iso === diaSel}">${d}<span class="ag-marcas">${marcas}</span></button>`;
                }
                const legenda = ['rosa', 'ciano', 'cinza'].filter(g => porGrupo[g]).map(g => `<span><i class="${g}"></i>${NOMES[g]}, ${porGrupo[g] === 1 ? '1 evento' : porGrupo[g] + ' eventos'}</span>`).join('');
                el.innerHTML = `
                    <div class="ag-topo"><h3>Agenda de ${MESES[m - 1]} de ${y}</h3><span>${doMes.length === 1 ? '1 evento' : doMes.length + ' eventos'}</span></div>
                    <div class="ag-semana" aria-hidden="true"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
                    <div class="ag-mes">${dias}</div>
                    ${legenda ? `<div class="ag-legenda">${legenda}</div>` : '<p class="ag-nada">Nenhum evento neste mês.</p>'}
                    ${diaSel ? '<button type="button" class="pn-link ag-limpar">Mostrar o mês inteiro</button>' : ''}`;
            };
            document.addEventListener('click', (e) => {
                const dia = e.target.closest('#ev-agenda .ag-dia');
                const limpar = e.target.closest('#ev-agenda .ag-limpar');
                if (!dia && !limpar) return;
                const fDia = document.getElementById('filtro-dia-evento'); if (!fDia) return;
                fDia.value = limpar || fDia.value === dia.dataset.dia ? '' : dia.dataset.dia;
                window.renderizarApenasEventos?.();
                const foco = document.querySelector(`#ev-agenda .ag-dia[data-dia="${dia ? dia.dataset.dia : ''}"]`);
                if (foco) foco.focus();
            });
        })();

        // ════════════════════════════════════════════════════════════════
        // AUDITORIA: contagem por tipo de ação e filtros por período,
        // usuário, módulo e ação. A busca vai ao banco com os filtros (antes
        // a tela mostrava só as 50 ações mais recentes, sem filtro).
        // ════════════════════════════════════════════════════════════════
        (function () {
            const ACOES = [['Edição', 'roxo'], ['Criação', 'verde'], ['Exclusão', 'vermelho'], ['Exportação', 'rosa'], ['Saída', 'cinza'], ['Importação', 'teal']];
            const TOM = { 'Edição': 'roxo', 'Criação': 'verde', 'Criacao': 'verde', 'Exclusão': 'vermelho', 'Exportação': 'rosa', 'Saída': 'cinza', 'Importação': 'teal' };
            const LIMITE = 200;
            let seq = 0, resumoEm = 0, opcoesFeitas = false;
            const val = id => (document.getElementById(id) || {}).value || '';
            const filtroAcao = (q, a) => a === 'Criação' ? q.in('acao', ['Criação', 'Criacao']) : q.eq('acao', a);

            async function resumo() {
                const el = document.getElementById('aud-resumo'); if (!el || Date.now() - resumoEm < 60000) return;
                resumoEm = Date.now();
                try {
                    const res = await Promise.all(ACOES.map(([a]) => filtroAcao(sb.from('logs_auditoria').select('id', { count: 'exact', head: true }), a)));
                    const ns = res.map(r => r && !r.error && typeof r.count === 'number' ? r.count : null);
                    if (ns.every(n => n == null)) { el.innerHTML = ''; resumoEm = 0; return; }
                    const total = ns.reduce((s, n) => s + (n || 0), 0);
                    const sub = document.getElementById('aud-sub');
                    if (sub) sub.textContent = `${total.toLocaleString('pt-BR')} ações registradas: quem fez o quê, em qual módulo e quando`;
                    el.innerHTML = ACOES.map(([a, tom], i) => `<button type="button" class="aud-cel" data-acao="${a}"><span class="aud-acao ${tom}"><i></i>${a}</span><b>${ns[i] == null ? '—' : ns[i].toLocaleString('pt-BR')}</b></button>`).join('');
                } catch (e) { el.innerHTML = ''; resumoEm = 0; }
            }
            async function opcoes() {
                if (opcoesFeitas) return; opcoesFeitas = true;
                try {
                    const { data, error } = await sb.from('logs_auditoria').select('usuario,secao').order('id', { ascending: false }).limit(1000);
                    if (error || !data) { opcoesFeitas = false; return; }
                    const preencher = (id, valores) => {
                        const sel = document.getElementById(id); if (!sel) return;
                        const atual = sel.value;
                        sel.innerHTML = '<option value="">Todos</option>' + [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
                        sel.value = atual;
                    };
                    preencher('aud-usuario', data.map(l => l.usuario));
                    preencher('aud-modulo', data.map(l => l.secao));
                } catch (e) { opcoesFeitas = false; }
            }
            window.renderizarLogs = async function () {
                const tbody = document.querySelector('#tabela-logs tbody'); if (!tbody) return;
                if (!currentUserData || !currentUserData.isAdmin) return;
                const minha = ++seq;
                const de = val('aud-de'), ate = val('aud-ate'), u = val('aud-usuario'), mod = val('aud-modulo'), ac = val('aud-acao');
                const filtrado = !!(de || ate || u || mod || ac);
                let lista = null;
                try {
                    let q = sb.from('logs_auditoria').select('*').order('id', { ascending: false }).limit(LIMITE);
                    if (de) q = q.gte('data_hora', new Date(de + 'T00:00:00').toISOString());
                    if (ate) q = q.lte('data_hora', new Date(ate + 'T23:59:59.999').toISOString());
                    if (u) q = q.eq('usuario', u);
                    if (mod) q = q.eq('secao', mod);
                    if (ac) q = filtroAcao(q, ac);
                    const { data, error } = await q;
                    if (!error && data) lista = data;
                } catch (e) { /* usa o que já está carregado */ }
                if (minha !== seq) return;
                if (lista === null) lista = filtrado ? [] : (logs || []);
                tbody.innerHTML = lista.length ? lista.map(l => {
                    const acao = l.acao === 'Criacao' ? 'Criação' : l.acao;
                    return `<tr><td class="cel-data">${celQuando(l.data_hora)}</td><td>${esc(l.usuario)}</td><td>${esc(l.secao)}</td>
                        <td><span class="aud-acao ${TOM[l.acao] || 'cinza'}"><i></i>${esc(acao)}</span></td><td class="aud-det" title="${esc(l.detalhes)}">${esc(l.detalhes)}</td></tr>`;
                }).join('') : `<tr><td colspan="5" class="aud-vazio">${filtrado ? 'Nenhuma ação com estes filtros.' : 'Nenhuma ação registrada.'}</td></tr>`;
                const rod = document.getElementById('aud-rodape');
                if (rod) rod.textContent = lista.length >= LIMITE ? `Mostrando as ${LIMITE} ações mais recentes${filtrado ? ' com estes filtros' : ''}. Use os filtros para ver as anteriores.`
                    : lista.length ? `${lista.length === 1 ? '1 ação' : lista.length + ' ações'}${filtrado ? ' com estes filtros' : ''}.` : '';
                resumo(); opcoes();
            };
            document.addEventListener('change', (e) => { if (e.target.closest('#auditoria .aud-filtros')) window.renderizarLogs(); });
            document.addEventListener('click', (e) => {
                const c = e.target.closest('#aud-resumo .aud-cel'); if (!c) return;
                const sel = document.getElementById('aud-acao'); if (!sel) return;
                sel.value = sel.value === c.dataset.acao ? '' : c.dataset.acao;
                document.querySelectorAll('#aud-resumo .aud-cel').forEach(b => b.classList.toggle('ativa', b.dataset.acao === sel.value));
                window.renderizarLogs();
            });
        })();

        // ════════════════════════════════════════════════════════════════
        // CELULAR: tocar numa demanda da lista abre a ficha dela em tela
        // cheia (serviço, prazos, andamento e as ações principais).
        // ════════════════════════════════════════════════════════════════
        (function () {
            const celular = window.matchMedia('(max-width: 900px)');
            let voltarPara = null;
            const hora = h => { if (!h || !/^\d{1,2}:\d{2}/.test(h)) return ''; const [hh, mm] = h.slice(0, 5).split(':'); return parseInt(hh, 10) + 'h' + (mm === '00' ? '' : mm); };
            const quando = v => {
                const d = v ? new Date(v) : null; if (!d || isNaN(d)) return '';
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}, às ${hora(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'))}`;
            };
            function folha() {
                let el = document.getElementById('detalhe-demanda');
                if (!el) {
                    el = document.createElement('div');
                    el.id = 'detalhe-demanda'; el.className = 'detalhe'; el.hidden = true;
                    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'detalhe-titulo');
                    document.body.appendChild(el);
                }
                return el;
            }
            window.fecharDetalheDemanda = function () {
                const el = document.getElementById('detalhe-demanda'); if (!el || el.hidden) return;
                el.hidden = true; document.documentElement.classList.remove('detalhe-aberto');
                const alvo = voltarPara && document.contains(voltarPara) ? voltarPara : document.querySelector(`.section.active .btn-mais[data-id="${el.dataset.id}"]`);
                if (alvo) alvo.focus();
            };
            window.abrirDetalheDemanda = function (id, origem, botao) {
                const d = demandas.find(x => x.id == id); if (!d) return;
                const modulo = origem || 'demandas';
                const el = folha();
                if (el.hidden) voltarPara = botao || document.activeElement;
                el.dataset.id = d.id;
                const pri = d.prioridade || 'Baixa';
                const st = d.status || 'Pendente';
                const serv = (_PN_SERVICOS[(d.contratada || '').trim().toUpperCase()] || [(d.contratada || '').trim() || '-'])[0];
                const meta = metaSLA(d);
                const abertaEm = d.data ? `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}/${d.data.slice(0, 4)}${hora(d.hora) ? ', às ' + hora(d.hora) : ''}` : '-';
                const linhas = [['Serviço', esc(serv)], ['Aberta em', abertaEm], ['Prazo de SLA', meta === 24 ? '1 dia útil' : Math.round(meta / 24) + ' dias úteis']];
                if (st !== 'Concluído') {
                    const dias = Math.floor((idadeAberta(d) || 0) / 24);
                    linhas.push(['Em aberto há', `<span class="pn-ab">${dias ? (dias === 1 ? '1 dia útil' : dias + ' dias úteis') : 'menos de 1 dia útil'}</span>`]);
                } else {
                    linhas.push(['Concluída em', quando(d.data_fim) || '-']);
                    linhas.push(['Tempo de atendimento', formatarDuracao(tempoResolucao(d))]);
                }
                linhas.push(['Unidade', esc(unidadeDe(d))]);
                if (d.origem) linhas.push(['Origem', esc(d.origem)]);
                if (d.projeto_id && typeof projetos !== 'undefined') { const pj = projetos.find(x => x.id == d.projeto_id); if (pj) linhas.push(['Projeto', `<span class="pn-link">${esc(pj.nome)}</span>`]); }
                if (d.solicitante) linhas.push(['Solicitante', esc(d.solicitante)]);
                if (d.numero_os) linhas.push(['Nº da O.S.', esc(d.numero_os)]);
                const passos = [
                    ['feito', 'Demanda aberta', abertaEm],
                    st === 'Pendente' ? ['futuro', 'Atendimento', 'Ainda não começou']
                        : ['feito' + (st === 'Em Andamento' ? ' agora' : ''), st === 'Em Andamento' ? 'Em andamento' : 'Atendimento iniciado', quando(d.data_inicio_atendimento) || 'Sem horário de início registrado']
                ];
                if (st === 'Concluído') passos.push(['feito fim', 'Concluída', quando(d.data_fim) || 'Sem horário de conclusão registrado']);
                const podeEditar = pode(modulo, 'editar');
                const acao = st !== 'Concluído' && podeEditar ? (st === 'Pendente' ? 'Iniciar atendimento' : 'Concluir demanda') : '';
                el.innerHTML = `
                    <div class="detalhe-topo">
                        <button type="button" class="detalhe-voltar" onclick="fecharDetalheDemanda()" aria-label="Voltar para a lista"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
                        <h2 id="detalhe-titulo">Demanda${d.numero_os ? ' ' + esc(d.numero_os) : ''}</h2>
                        ${podeEditar ? `<button type="button" class="detalhe-editar" aria-label="Editar demanda" title="Editar"><i class="fas fa-pen" aria-hidden="true"></i></button>` : ''}
                    </div>
                    <div class="detalhe-corpo">
                        <div class="detalhe-etiquetas">${celPill('Prioridade ' + pri.toLowerCase(), pri === 'Alta' ? 'vermelho' : pri === 'Média' ? 'ambar' : 'neutro')}${celPill(st === 'Em Andamento' ? 'Em andamento' : st, st === 'Concluído' ? 'verde' : st === 'Em Andamento' ? 'ambar' : 'neutro')}</div>
                        <p class="detalhe-tit">${esc(d.titulo || 'Sem descrição')}</p>
                        ${d.setor ? `<div class="detalhe-locais">${celChip(d.setor)}</div>` : ''}
                        <dl class="detalhe-info">${linhas.map(([r, v]) => `<div><dt>${r}</dt><dd>${v}</dd></div>`).join('')}</dl>
                        ${d.observacoes ? `<section class="detalhe-obs"><h3>Observações</h3>${esc(d.observacoes)}</section>` : ''}
                        ${d.foto_path ? '<a class="detalhe-foto" target="_blank" rel="noopener" hidden><img alt="Foto do problema"></a>' : ''}
                        <section class="detalhe-andamento"><h3>Andamento</h3>${passos.map(([c, t, s]) => `<div class="detalhe-passo ${c}"><b>${t}</b><small>${s}</small></div>`).join('')}</section>
                    </div>
                    <div class="detalhe-rodape">
                        <button type="button" class="sec detalhe-os">Gerar O.S.</button>
                        ${acao ? `<button type="button" class="pri detalhe-avancar">${acao}</button>` : ''}
                    </div>`;
                el.querySelector('.detalhe-os').onclick = () => { fecharDetalheDemanda(); abrirModalImpressao(d.id); };
                const ed = el.querySelector('.detalhe-editar');
                if (ed) ed.onclick = () => { fecharDetalheDemanda(); editarDemanda(d.id, origem); };
                const av = el.querySelector('.detalhe-avancar');
                if (av) av.onclick = async () => {
                    av.disabled = true;
                    if (st === 'Em Andamento' && origem) { fecharDetalheDemanda(); avancarStatus(d.id, origem); return; }
                    try {
                        await avancarStatus(d.id, origem);
                        // a lista recarrega em segundo plano; espera o novo status chegar
                        for (let i = 0; i < 25; i++) {
                            const atual = demandas.find(x => x.id == d.id);
                            if (!atual || atual.status !== st) break;
                            await new Promise(r => setTimeout(r, 200));
                        }
                    } finally { if (!el.hidden) abrirDetalheDemanda(d.id, origem); }
                };
                if (d.foto_path) urlAnexo(d.foto_path).then(u => { const a = el.querySelector('.detalhe-foto'); if (u && a) { a.href = u; a.querySelector('img').src = u; a.hidden = false; } });
                el.hidden = false; document.documentElement.classList.add('detalhe-aberto');
                el.querySelector('.detalhe-voltar').focus();
            };
            document.addEventListener('click', (e) => {
                if (!celular.matches) return;
                const tr = e.target.closest('.tabela-refinada tbody tr');
                if (!tr || e.target.closest('button, a, input, select, label, textarea')) return;
                const mais = tr.querySelector('.btn-mais'); if (!mais) return;
                abrirDetalheDemanda(Number(mais.dataset.id), mais.dataset.origem || undefined, mais);
            });
            document.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                const el = document.getElementById('detalhe-demanda');
                if (el && !el.hidden && !document.querySelector('.modal-overlay[style*="flex"]')) { e.stopPropagation(); fecharDetalheDemanda(); }
            }, true);
        })();
