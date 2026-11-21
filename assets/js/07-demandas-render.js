        // ════════════════════════════════════════════════════════════════
        // LISTA REFINADA DE DEMANDAS (Demandas e abas Predial, Ar, Limpeza)
        // Abas de visualização, filtros, ordenação, densidade, atraso no SLA,
        // seleção em lote e menu de ações por linha.
        // ════════════════════════════════════════════════════════════════
        const _LISTA_ESTADO = {};
        const _VISOES = [
            { id: 'abertas',    nome: 'Em aberto',       f: d => d.status !== 'Concluído' },
            { id: 'atrasadas',  nome: 'Atrasadas',       f: d => d.status !== 'Concluído' && _atraso(d) > 0 },
            { id: 'alta',       nome: 'Prioridade alta', f: d => d.status !== 'Concluído' && d.prioridade === 'Alta' },
            { id: 'concluidas', nome: 'Concluídas',      f: d => d.status === 'Concluído' },
            { id: 'todas',      nome: 'Todas',           f: () => true }
        ];
        // Cores de serviço e de prioridade vêm do tema (tema.css), por classe
        const _SERVICOS = {
            PREDIAL: ['Predial', 'predial'], AR: ['Ar condicionado', 'ar'], LIMPEZA: ['Limpeza', 'limpeza'],
            RAMAL: ['Telefonia', 'telefonia'], OUTROS: ['Outros', 'outros']
        };
        const _CLASSE_PRIORIDADE = { 'Alta': 'pri-alta', 'Média': 'pri-media', 'Baixa': 'pri-baixa' };
        const _PESO_PRIORIDADE = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };

        function _valor(id) { const el = document.getElementById(id); return el ? el.value : ''; }

        function _estadoLista(chave) {
            if (!_LISTA_ESTADO[chave]) {
                let visao = 'abertas';
                try { visao = localStorage.getItem('dzel.visao.' + chave) || 'abertas'; } catch (e) {}
                if (!_VISOES.some(v => v.id === visao)) visao = 'abertas';
                _LISTA_ESTADO[chave] = { visao, sel: new Set() };
            }
            return _LISTA_ESTADO[chave];
        }

        // Horas úteis além da meta de SLA (0 = no prazo). Calculado uma vez por desenho.
        let _cacheAtraso = new WeakMap();
        function _atraso(d) {
            if (_cacheAtraso.has(d)) return _cacheAtraso.get(d);
            let h = 0;
            if (d.status !== 'Concluído') {
                const idade = idadeAberta(d);
                h = idade == null ? 0 : Math.max(0, idade - metaSLA(d));
            }
            _cacheAtraso.set(d, h);
            return h;
        }
        function _uteis(h) {
            if (h < 24) { const n = Math.max(1, Math.round(h)); return n + (n === 1 ? ' hora útil' : ' horas úteis'); }
            const dias = Math.floor(h / 24);
            return dias + (dias === 1 ? ' dia útil' : ' dias úteis');
        }
        function _celulaSLA(d) {
            const meta = metaSLA(d);
            if (d.status === 'Concluído') {
                const t = tempoResolucao(d);
                if (t == null) return '<span class="sla sla-neutro">Concluída</span>';
                return t <= meta
                    ? '<span class="sla sla-ok"><i class="fas fa-check" aria-hidden="true"></i> No prazo</span>'
                    : `<span class="sla sla-neutro">Fora do prazo, ${_uteis(t - meta)}</span>`;
            }
            const idade = idadeAberta(d);
            if (idade == null) return '<span class="sla sla-neutro">Sem data</span>';
            if (idade > meta) return `<span class="sla sla-atraso"><i class="far fa-clock" aria-hidden="true"></i> ${_uteis(idade - meta)}</span>`;
            return `<span class="sla sla-prazo">Vence em ${_uteis(meta - idade)}</span>`;
        }
        function _celulaPrioridade(p) {
            const cls = _CLASSE_PRIORIDADE[p] || 'pri-baixa';
            return `<span class="pri ${cls}"><svg aria-hidden="true" width="13" height="12" viewBox="0 0 13 12"><rect class="b1" x="0" y="7" width="3" height="5" rx="1"/><rect class="b2" x="5" y="3.5" width="3" height="8.5" rx="1"/><rect class="b3" x="10" y="0" width="3" height="12" rx="1"/></svg>${esc(p || 'Sem prioridade')}</span>`;
        }
        function _celulaStatus(s) {
            const cls = s === 'Pendente' ? 'st-pendente' : (s === 'Em Andamento' ? 'st-andamento' : 'st-concluido');
            return `<span class="st ${cls}"><i aria-hidden="true"></i>${esc(s === 'Em Andamento' ? 'Em andamento' : s)}</span>`;
        }

        // ── Datas curtas para a lista (horário de Brasília) ──
        function _diaCurto(ymd) {   // 'AAAA-MM-DD' → 'dd/mm' (ano atual) ou 'dd/mm/aa'
            if (!ymd) return '';
            const dm = ymd.slice(8, 10) + '/' + ymd.slice(5, 7);
            return ymd.slice(0, 4) === DateUtils.getToInput().slice(0, 4) ? dm : dm + '/' + ymd.slice(2, 4);
        }
        function _diaCompletoLocal(v) {   // 'AAAA-MM-DDTHH:MM' → 'dd/mm/aaaa às hh:mm'
            return v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)} às ${v.slice(11, 16)}` : '';
        }
        function _celulaData(d, origem, campo) {
            const iso = campo === 'ini' ? d.data_inicio_atendimento : d.data_fim;
            const nome = campo === 'ini' ? 'Início' : 'Conclusão';
            const cls = campo === 'ini' ? 'col-ini' : 'col-fim';
            const editar = pode(origem || 'demandas', 'editar');
            const dados = `data-id="${d.id}" data-origem="${origem || ''}"`;
            const local = iso ? DateUtils.isoParaInputBRT(iso) : '';
            if (!local) {
                return `<td class="${cls} sem-data">${editar ? `<button type="button" class="btn-data vazio" ${dados} aria-label="Definir ${campo === 'ini' ? 'o início' : 'a conclusão'} da demanda ${d.id}">definir</button>` : ''}</td>`;
            }
            const completo = _diaCompletoLocal(local), curto = _diaCurto(local.slice(0, 10));
            return `<td class="${cls}">` + (editar
                ? `<button type="button" class="btn-data" ${dados} title="${nome}: ${completo}. Clique para alterar" aria-label="${nome} em ${completo}. Alterar as datas da demanda ${d.id}">${curto}</button>`
                : `<span title="${nome}: ${completo}">${curto}</span>`) + `</td>`;
        }

        // origem: undefined na aba Demandas; 'predial' | 'ar' | 'limpeza' nas abas técnicas
        function criarLinhaDemanda(d, origem) {
            const marcada = _estadoLista(origem || 'demandas').sel.has(String(d.id));
            const cat = getCategoriaCached(d);
            const serv = _SERVICOS[cat] || _SERVICOS.OUTROS;
            const nomeServ = (cat === 'OUTROS' && d.contratada) ? d.contratada : serv[0];
            const aberta = _diaCurto(d.data);
            const sub = [d.solicitante, d.numero_os ? 'O.S. ' + d.numero_os : ''].filter(Boolean).map(esc).join(', ');
            const colServico = origem ? '' : `<td class="col-serv"><span class="serv"><i class="serv-${serv[1]}" aria-hidden="true"></i>${esc(nomeServ)}</span></td>`;
            return `<tr class="${marcada ? 'linha-sel' : ''}">`
                + `<td class="col-sel"><input type="checkbox" class="sel-linha" data-id="${d.id}" ${marcada ? 'checked' : ''} aria-label="Selecionar a demanda ${d.id}"></td>`
                + `<td class="col-num">#${d.id}</td>`
                + `<td class="col-dem"><div class="dem"><span class="dem-titulo" title="${esc(d.titulo)}">${esc(d.titulo)}</span>${d.setor ? `<span class="dem-local" title="${esc(d.setor)}">${esc(d.setor)}</span>` : ''}</div>${sub ? `<small class="dem-sub">${sub}</small>` : ''}</td>`
                + colServico
                + `<td class="col-pri">${_celulaPrioridade(d.prioridade)}</td>`
                + `<td class="col-sla">${_celulaSLA(d)}</td>`
                + `<td class="col-data" title="Aberta em ${formatarData(d.data)}${d.hora ? ' às ' + esc(String(d.hora).slice(0, 5)) : ''}">${aberta}</td>`
                + _celulaData(d, origem, 'ini')
                + _celulaData(d, origem, 'fim')
                + `<td class="col-st">${_celulaStatus(d.status)}</td>`
                + `<td class="col-mais"><button type="button" class="btn-mais" data-id="${d.id}" data-origem="${origem || ''}" aria-haspopup="menu" aria-expanded="false" aria-label="Mais ações para a demanda ${d.id}" title="Mais ações"><i class="fas fa-ellipsis" aria-hidden="true"></i></button></td>`
                + `</tr>`;
        }

        function _ordenar(lista, ordem) {
            const porId = (a, b) => b.id - a.id;
            if (ordem === 'recentes') return lista.sort((a, b) => ((b.data || '') + (b.hora || '')).localeCompare((a.data || '') + (a.hora || '')) || porId(a, b));
            if (ordem === 'atraso') return lista.sort((a, b) => (_atraso(b) - _atraso(a)) || porId(a, b));
            return lista.sort((a, b) =>
                ((a.status === 'Concluído') - (b.status === 'Concluído'))
                || ((_PESO_PRIORIDADE[a.prioridade] ?? 3) - (_PESO_PRIORIDADE[b.prioridade] ?? 3))
                || (_atraso(b) - _atraso(a)) || porId(a, b));
        }

        // Desenha abas, lista e barra de seleção. o: { chave, sufixo, base, origem, tableId, colspan, emptyMsg, filterKey, rerender }
        function _desenharLista(o) {
            _cacheAtraso = new WeakMap();
            const est = _estadoLista(o.chave);
            const visao = _VISOES.find(v => v.id === est.visao) || _VISOES[0];
            const cont = {}; _VISOES.forEach(v => { cont[v.id] = 0; });
            const lista = [];
            for (const d of o.base) {
                for (const v of _VISOES) if (v.f(d)) cont[v.id]++;
                if (visao.f(d)) lista.push(d);
            }
            const abas = document.querySelector(`.lista-visoes[data-lista="${o.chave}"]`);
            if (abas) abas.innerHTML = _VISOES.map(v => {
                const ativa = v.id === visao.id;
                return `<button type="button" role="tab" aria-selected="${ativa}" data-visao="${v.id}" class="visao${ativa ? ' ativa' : ''}${v.id === 'atrasadas' && cont[v.id] ? ' alerta' : ''}">${v.nome}<span class="visao-n">${cont[v.id].toLocaleString('pt-BR')}</span></button>`;
            }).join('');
            document.querySelectorAll(`[id$="-${o.sufixo}"].lista-filtro`).forEach(el => el.classList.toggle('ativo', !!el.value));
            const ordem = _valor('ordem-' + o.sufixo) || 'prioridade';
            _ordenar(lista, ordem);
            renderPaginated({ tableId: o.tableId, items: lista, rowFn: d => criarLinhaDemanda(d, o.origem), colspan: o.colspan,
                emptyMsg: o.emptyMsg, filterKey: o.filterKey + '|' + visao.id + '|' + ordem, rerender: o.rerender });
            _sincronizarSelecao(o.chave);
        }

        window.renderizarApenasDemandas = function() {
            const mes = _valor('filtro-mes-demanda'), dia = _valor('filtro-dia-demanda'), status = _valor('filtro-status-demanda');
            const texto = _valor('filtro-texto-demanda').toUpperCase(), serv = _valor('filtro-servico-demanda'), prio = _valor('filtro-prioridade-demanda');
            const base = [];
            let cPend = 0, cAnd = 0, cConc = 0;
            for (let i = 0, len = demandas.length; i < len; i++) {
                const d = demandas[i];
                if (mes && !(d.data || '').startsWith(mes)) continue;
                if (dia && (d.data || '') !== dia) continue;
                if (status && d.status !== status) continue;
                if (texto && !(d.titulo + ' ' + d.setor + ' ' + d.solicitante + ' ' + (d.contratada || '')).toUpperCase().includes(texto)) continue;
                if (serv && getCategoriaCached(d) !== serv) continue;
                if (prio && d.prioridade !== prio) continue;
                base.push(d);
                if (d.status === 'Pendente') cPend++;
                else if (d.status === 'Em Andamento') cAnd++;
                else cConc++;
            }
            document.getElementById('dash-demanda-total').innerText = base.length;
            document.getElementById('dash-demanda-pendente').innerText = cPend;
            document.getElementById('dash-demanda-andamento').innerText = cAnd;
            document.getElementById('dash-demanda-concluido').innerText = cConc;
            // Contadores sempre atualizados; a lista só é redesenhada com a aba visível.
            if (!secaoVisivel('demandas')) return;
            _desenharLista({ chave: 'demandas', sufixo: 'demanda', base, origem: undefined, tableId: 'tabela-demandas', colspan: 11,
                emptyMsg: 'Nenhuma demanda encontrada.', filterKey: [mes, dia, status, texto, serv, prio].join('|'), rerender: window.renderizarApenasDemandas });
        }

        window.renderizarAbasEspecificas = function() {
            function renderizarAba(prefixo, categoriaAlvo) {
                const mes = _valor(`filtro-mes-${prefixo}`), dia = _valor(`filtro-dia-${prefixo}`);
                const busca = _valor(`filtro-busca-${prefixo}`).toUpperCase(), status = _valor(`filtro-status-${prefixo}`), prio = _valor(`filtro-prioridade-${prefixo}`);
                const base = [];
                let cPend = 0, cAnd = 0, cConc = 0;
                for (let i = 0, len = demandas.length; i < len; i++) {
                    const d = demandas[i];
                    if (getCategoriaCached(d) !== categoriaAlvo) continue;
                    if (mes && !(d.data || '').startsWith(mes)) continue;
                    if (dia && (d.data || '') !== dia) continue;
                    if (busca && !(d.titulo + ' ' + d.setor + ' ' + d.solicitante).toUpperCase().includes(busca)) continue;
                    if (status && d.status !== status) continue;
                    if (prio && d.prioridade !== prio) continue;
                    base.push(d);
                    if (d.status === 'Pendente') cPend++;
                    else if (d.status === 'Em Andamento') cAnd++;
                    else cConc++;
                }
                // Sempre atualiza os cards (independente de qual aba está visível)
                document.getElementById(`dash-${prefixo}-total`).innerText = base.length;
                document.getElementById(`dash-${prefixo}-pendente`).innerText = cPend;
                document.getElementById(`dash-${prefixo}-andamento`).innerText = cAnd;
                document.getElementById(`dash-${prefixo}-concluido`).innerText = cConc;
                // Só redesenha a lista da aba visível (desempenho)
                if (secaoVisivel(prefixo)) {
                    _desenharLista({ chave: prefixo, sufixo: prefixo, base, origem: prefixo, tableId: `tabela-${prefixo}`, colspan: 10,
                        emptyMsg: 'Nenhum registro.', filterKey: [mes, dia, busca, status, prio].join('|'), rerender: window.renderizarAbasEspecificas });
                }
            }
            renderizarAba('predial', 'PREDIAL');
            renderizarAba('ar', 'AR');
            renderizarAba('limpeza', 'LIMPEZA');
        }

        function _redesenhar(chave) {
            if (chave === 'demandas') window.renderizarApenasDemandas(); else window.renderizarAbasEspecificas();
        }
        function _tabelaDaLista(chave) { return document.getElementById(chave === 'demandas' ? 'tabela-demandas' : 'tabela-' + chave); }

        // ── Seleção em lote ──
        function _sincronizarSelecao(chave) {
            const tabela = _tabelaDaLista(chave);
            if (tabela) {
                const caixas = [...tabela.querySelectorAll('tbody .sel-linha')];
                const marcadas = caixas.filter(c => c.checked).length;
                const todas = tabela.querySelector('.sel-todas');
                if (todas) { todas.checked = caixas.length > 0 && marcadas === caixas.length; todas.indeterminate = marcadas > 0 && marcadas < caixas.length; }
            }
            const barra = document.querySelector(`.lista-lote[data-lista="${chave}"]`);
            if (!barra) return;
            const n = _estadoLista(chave).sel.size;
            if (!n) { barra.hidden = true; barra.innerHTML = ''; return; }
            const modulo = chave;   // 'demandas' | 'predial' | 'ar' | 'limpeza' (mesmas chaves das permissões)
            barra.hidden = false;
            barra.innerHTML = `<span class="lote-n">${n === 1 ? '1 demanda selecionada' : n + ' demandas selecionadas'}</span><span class="lote-espaco"></span>`
                + (pode(modulo, 'editar') ? `<button type="button" data-lote="concluir">Concluir</button>`
                    + `<select data-lote="prioridade" aria-label="Mudar a prioridade das selecionadas"><option value="">Mudar prioridade</option><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select>` : '')
                + (pode(modulo, 'exportar') ? `<button type="button" data-lote="exportar">Exportar</button>` : '')
                + `<button type="button" data-lote="limpar" class="lote-limpar">Limpar seleção</button>`;
        }

        async function _acaoLote(chave, acao, valor) {
            const est = _estadoLista(chave);
            const itens = demandas.filter(d => est.sel.has(String(d.id)));
            if (acao === 'limpar') { est.sel.clear(); _redesenhar(chave); return; }
            if (acao === 'exportar') { exportarExcel(chave, itens); return; }
            let alvo = [], upd = null, texto = '';
            if (acao === 'concluir') {
                alvo = itens.filter(d => d.status !== 'Concluído');
                if (!alvo.length) { showToast('As demandas selecionadas já estão concluídas.', 'info'); return; }
                if (!confirm(`Concluir ${alvo.length === 1 ? '1 demanda' : alvo.length + ' demandas'} com encerramento agora?`)) return;
                texto = 'Concluiu em lote';
            } else if (acao === 'prioridade' && valor) {
                alvo = itens.filter(d => d.prioridade !== valor);
                if (!alvo.length) { _redesenhar(chave); return; }
                if (!confirm(`Mudar a prioridade de ${alvo.length === 1 ? '1 demanda' : alvo.length + ' demandas'} para ${valor}?`)) { _redesenhar(chave); return; }
                upd = { prioridade: valor };
                texto = 'Mudou prioridade para ' + valor + ' em lote';
            } else return;
            let falhas = 0;
            const agora = DateUtils.getNowDatabaseISO();
            for (const d of alvo) {
                const mudanca = upd || { status: 'Concluído', data_fim: agora, data_inicio_atendimento: d.data_inicio_atendimento || agora };
                const { error } = await sb.from('demandas').update(mudanca).eq('id', d.id);
                if (error) { falhas++; continue; }
                syncSheets('demandas', 'upsert', { ...d, ...mudanca });
            }
            const ok = alvo.length - falhas;
            if (ok) registrarLog('Edição', 'Demandas', `${texto}: ${alvo.map(d => d.id).join(', ')}`);
            est.sel.clear();
            carregarDados();
            if (falhas) showToast(`${falhas} de ${alvo.length} não foram salvas. Tente de novo.`, 'error', 5000);
            else showToast(acao === 'concluir' ? `${ok === 1 ? '1 demanda concluída' : ok + ' demandas concluídas'}.` : `Prioridade alterada em ${ok === 1 ? '1 demanda' : ok + ' demandas'}.`, 'success');
        }

        // ── Menu de ações da linha (⋯) ──
        let _menuAberto = null;
        function _fecharMenuLinha(devolverFoco) {
            if (!_menuAberto) return;
            const { menu, botao } = _menuAberto;
            _menuAberto = null;
            menu.remove();
            botao.setAttribute('aria-expanded', 'false');
            if (devolverFoco && document.contains(botao)) botao.focus();
        }
        function _abrirMenuLinha(botao) {
            if (_menuAberto && _menuAberto.botao === botao) { _fecharMenuLinha(true); return; }
            _fecharMenuLinha();
            const id = Number(botao.dataset.id), origem = botao.dataset.origem || undefined;
            const d = demandas.find(x => x.id == id); if (!d) return;
            const modulo = origem || 'demandas';
            const itens = [];
            if (d.status !== 'Concluído' && pode(modulo, 'editar'))
                itens.push(['fas fa-arrow-right', d.status === 'Pendente' ? 'Iniciar atendimento' : 'Concluir', () => avancarStatus(id, origem)]);
            if (pode(modulo, 'editar')) itens.push(['fas fa-pen', 'Editar', () => editarDemanda(id, origem)]);
            if (pode(modulo, 'editar')) itens.push(['fas fa-calendar-days', 'Alterar datas', () => abrirModalDatas(id, origem, botao)]);
            itens.push(['fas fa-print', 'Imprimir O.S.', () => abrirModalImpressao(id)]);
            itens.push(['fab fa-whatsapp', 'Enviar por WhatsApp', () => enviarWhatsAppDemanda(id)]);
            if (pode(modulo, 'excluir')) itens.push(['fas fa-trash', 'Excluir', () => deletarDemanda(id), 'perigo']);
            const menu = document.createElement('div');
            menu.className = 'menu-linha no-print';
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', 'Ações da demanda ' + id);
            menu.innerHTML = itens.map((it, i) => `<button type="button" role="menuitem" data-i="${i}" class="${it[3] || ''}"><i class="${it[0]}" aria-hidden="true"></i>${it[1]}</button>`).join('');
            document.body.appendChild(menu);
            const r = botao.getBoundingClientRect();
            let top = r.bottom + 4;
            if (top + menu.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 4);
            menu.style.top = top + 'px';
            menu.style.left = Math.max(8, r.right - menu.offsetWidth) + 'px';
            menu.addEventListener('click', (e) => {
                const b = e.target.closest('[data-i]'); if (!b) return;
                const acao = itens[b.dataset.i][2];
                _fecharMenuLinha();
                acao();
            });
            botao.setAttribute('aria-expanded', 'true');
            _menuAberto = { menu, botao };
            menu.querySelector('button')?.focus();
        }

        // ── Datas do atendimento: definir ou corrigir início e conclusão ──
        // Regras: conclusão preenchida = Concluído; início sem conclusão tira de
        // Pendente; apagar uma data que existia reabre a demanda. Datas não podem
        // estar no futuro, nem antes da abertura, e a conclusão não vem antes do início.
        let _datasDevolverFoco = null;
        function _statusPelasDatas(d, ini, fim) {
            if (fim) return 'Concluído';
            if (d.status === 'Concluído') return d.data_fim ? (ini ? 'Em Andamento' : 'Pendente') : 'Concluído';
            if (ini) return d.status === 'Pendente' ? 'Em Andamento' : d.status;
            return (d.data_inicio_atendimento && d.status === 'Em Andamento') ? 'Pendente' : d.status;
        }
        function _conferirDatas() {
            const d = demandas.find(x => x.id == _valor('datas-demanda-id'));
            const aviso = document.getElementById('datas-aviso'), botao = document.getElementById('btn-salvar-datas');
            if (!d || !aviso) return null;
            const ini = _valor('datas-inicio'), fim = _valor('datas-fim');
            const abertura = d.data ? `${d.data}T${String(d.hora || '00:00').slice(0, 5)}` : '';
            const agora = DateUtils.getToInput();
            let erro = '';
            if ((ini && ini > agora) || (fim && fim > agora)) erro = 'As datas não podem estar no futuro.';
            else if (ini && abertura && ini < abertura) erro = `O início não pode ser antes da abertura (${_diaCompletoLocal(abertura)}).`;
            else if (fim && abertura && fim < abertura) erro = `A conclusão não pode ser antes da abertura (${_diaCompletoLocal(abertura)}).`;
            else if (ini && fim && fim < ini) erro = 'A conclusão não pode ser antes do início.';
            let texto = erro;
            if (!erro) {
                const novo = _statusPelasDatas(d, ini, fim);
                const nomes = { 'Pendente': 'Pendente', 'Em Andamento': 'Em andamento', 'Concluído': 'Concluída' };
                texto = novo !== d.status ? `Ao salvar, a demanda fica ${nomes[novo]}.` : '';
                if (fim && !ini) texto = (texto ? texto + ' ' : '') + 'Sem início informado, o início fica igual à conclusão.';
            }
            aviso.textContent = texto;
            aviso.classList.toggle('erro', !!erro);
            if (botao) botao.disabled = !!erro;
            return erro ? null : { d, ini, fim };
        }
        window.abrirModalDatas = function(id, origem, gatilho) {
            const d = demandas.find(x => x.id == id); if (!d) return;
            if (!pode(origem || 'demandas', 'editar')) { showToast('Você não tem permissão para alterar esta demanda.', 'error'); return; }
            _fecharMenuLinha();
            _datasDevolverFoco = gatilho || document.activeElement;
            document.getElementById('datas-demanda-id').value = id;
            document.getElementById('datas-origem').value = origem || '';
            document.getElementById('datas-info').innerHTML = `<strong>${esc(d.titulo)}</strong><br>Aberta em ${formatarData(d.data)}${d.hora ? ' às ' + esc(String(d.hora).slice(0, 5)) : ''}`;
            const iniEl = document.getElementById('datas-inicio'), fimEl = document.getElementById('datas-fim');
            iniEl.value = DateUtils.isoParaInputBRT(d.data_inicio_atendimento);
            fimEl.value = DateUtils.isoParaInputBRT(d.data_fim);
            const agora = DateUtils.getToInput();
            const abertura = d.data ? `${d.data}T${String(d.hora || '00:00').slice(0, 5)}` : '';
            [iniEl, fimEl].forEach(el => { el.max = agora; if (abertura) el.min = abertura; else el.removeAttribute('min'); });
            _conferirDatas();
            document.getElementById('modal-datas-demanda').style.display = 'flex';
            if (!window.matchMedia('(max-width: 900px)').matches) iniEl.focus();
        };
        window.fecharModalDatas = function() {
            document.getElementById('modal-datas-demanda').style.display = 'none';
            const volta = _datasDevolverFoco;
            _datasDevolverFoco = null;
            if (volta && document.contains(volta)) volta.focus({ preventScroll: true });
        };
        window.limparDataDemanda = function(idCampo) {
            const el = document.getElementById(idCampo);
            el.value = '';
            _conferirDatas();
            el.focus();
        };
        window.salvarDatasDemanda = async function() {
            const ok = _conferirDatas(); if (!ok) return;
            const { d, ini, fim } = ok;
            if (!pode(_valor('datas-origem') || 'demandas', 'editar')) return;
            const iniAntes = DateUtils.isoParaInputBRT(d.data_inicio_atendimento), fimAntes = DateUtils.isoParaInputBRT(d.data_fim);
            if (ini === iniAntes && fim === fimAntes) { fecharModalDatas(); return; }
            // Data que não foi mexida mantém o valor original do banco (com os segundos)
            const isoFim = fim ? (fim === fimAntes ? d.data_fim : DateUtils.toDatabaseISO(fim)) : null;
            const isoIni = ini ? (ini === iniAntes ? d.data_inicio_atendimento : DateUtils.toDatabaseISO(ini)) : isoFim;
            const upd = { data_inicio_atendimento: isoIni, data_fim: isoFim, status: _statusPelasDatas(d, ini, fim) };
            const botao = document.getElementById('btn-salvar-datas');
            botao.disabled = true;
            const { error } = await sb.from('demandas').update(upd).eq('id', d.id);
            botao.disabled = false;
            if (error) { alert('Erro: ' + error.message); return; }
            registrarLog('Edição', 'Demandas', `Alterou as datas da demanda ID: ${d.id}`);
            syncSheets('demandas', 'upsert', { ...d, ...upd });
            fecharModalDatas();
            showToast('Datas salvas.', 'success');
            await carregarDados();
            // A lista foi redesenhada: o foco volta para a mesma demanda (ou para a aba ativa, se ela saiu da visão)
            if (document.activeElement === document.body || !document.contains(document.activeElement)) {
                const volta = document.querySelector(`.tabela-refinada .btn-mais[data-id="${d.id}"]`) || document.querySelector('.section.active .lista-visoes .visao.ativa');
                if (volta) volta.focus({ preventScroll: true });
            }
        };
        document.addEventListener('input', (e) => { if (e.target.matches('#datas-inicio, #datas-fim')) _conferirDatas(); });
        document.addEventListener('change', (e) => { if (e.target.matches('#datas-inicio, #datas-fim')) _conferirDatas(); });

        // ── Densidade (compacta / confortável), lembrada no navegador ──
        function _aplicarDensidade(dens, salvar) {
            document.documentElement.classList.toggle('densidade-confortavel', dens === 'confortavel');
            document.querySelectorAll('.lista-densidade button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dens === dens)));
            if (salvar) { try { localStorage.setItem('dzel.densidade', dens); } catch (e) {} }
        }
        try { _aplicarDensidade(localStorage.getItem('dzel.densidade') || 'compacta', false); } catch (e) { _aplicarDensidade('compacta', false); }

        // ── Eventos da lista (delegados) ──
        document.addEventListener('click', (e) => {
            if (_menuAberto && !e.target.closest('.menu-linha') && !e.target.closest('.btn-mais')) _fecharMenuLinha();
            const aba = e.target.closest('.lista-visoes .visao');
            if (aba) {
                const chave = aba.parentElement.dataset.lista;
                _estadoLista(chave).visao = aba.dataset.visao;
                try { localStorage.setItem('dzel.visao.' + chave, aba.dataset.visao); } catch (err) {}
                _redesenhar(chave);
                return;
            }
            const dens = e.target.closest('.lista-densidade button');
            if (dens) { _aplicarDensidade(dens.dataset.dens, true); return; }
            const data = e.target.closest('.tabela-refinada .btn-data');
            if (data) { abrirModalDatas(Number(data.dataset.id), data.dataset.origem || undefined, data); return; }
            const mais = e.target.closest('.btn-mais');
            if (mais) { _abrirMenuLinha(mais); return; }
            const lote = e.target.closest('.lista-lote button[data-lote]');
            if (lote) _acaoLote(lote.closest('.lista-lote').dataset.lista, lote.dataset.lote);
        });
        document.addEventListener('change', (e) => {
            const alvo = e.target;
            if (alvo.matches('.tabela-refinada .sel-linha')) {
                const chave = alvo.closest('table').id === 'tabela-demandas' ? 'demandas' : alvo.closest('table').id.replace('tabela-', '');
                const sel = _estadoLista(chave).sel;
                if (alvo.checked) sel.add(alvo.dataset.id); else sel.delete(alvo.dataset.id);
                alvo.closest('tr').classList.toggle('linha-sel', alvo.checked);
                _sincronizarSelecao(chave);
            } else if (alvo.matches('.tabela-refinada .sel-todas')) {
                const tabela = alvo.closest('table');
                const chave = tabela.id === 'tabela-demandas' ? 'demandas' : tabela.id.replace('tabela-', '');
                const sel = _estadoLista(chave).sel;
                tabela.querySelectorAll('tbody .sel-linha').forEach(c => {
                    c.checked = alvo.checked;
                    c.closest('tr').classList.toggle('linha-sel', alvo.checked);
                    if (alvo.checked) sel.add(c.dataset.id); else sel.delete(c.dataset.id);
                });
                _sincronizarSelecao(chave);
            } else if (alvo.matches('.lista-lote select[data-lote="prioridade"]')) {
                _acaoLote(alvo.closest('.lista-lote').dataset.lista, 'prioridade', alvo.value);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (!_menuAberto) return;
            const botoes = [..._menuAberto.menu.querySelectorAll('button')];
            const i = botoes.indexOf(document.activeElement);
            if (e.key === 'Escape') { e.preventDefault(); _fecharMenuLinha(true); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); botoes[(i + 1) % botoes.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); botoes[(i - 1 + botoes.length) % botoes.length].focus(); }
            else if (e.key === 'Tab') _fecharMenuLinha();
        });
        window.addEventListener('resize', () => _fecharMenuLinha());
        // Fecha o menu só quando rola algo que move o botão ⋯ (página ou lista),
        // não quando rola outro elemento, como a pilha de avisos.
        document.addEventListener('scroll', (e) => {
            if (!_menuAberto) return;
            const alvo = e.target;
            if (alvo === document || alvo === document.documentElement || (alvo.contains && alvo.contains(_menuAberto.botao))) _fecharMenuLinha();
        }, true);

        window.avancarStatus = async function(id, origem) {
            const item = demandas.find(d => d.id == id); if(!item) return;
            // Nas abas técnicas, concluir abre modal para escolher data/hora do encerramento
            if (item.status === 'Em Andamento' && (origem === 'predial' || origem === 'ar' || origem === 'limpeza')) {
                abrirModalConcluir(id);
                return;
            }
            let novoStatus = item.status, novaDataFim = item.data_fim, novaDataInicio = item.data_inicio_atendimento;
            if(item.status === 'Pendente') {
                novoStatus = 'Em Andamento';
                // Carimbo de 1ª resposta — só grava se ainda não existir
                if (!novaDataInicio) novaDataInicio = DateUtils.getNowDatabaseISO();
            }
            else if(item.status === 'Em Andamento') { novoStatus = 'Concluído'; novaDataFim = DateUtils.getNowDatabaseISO(); }
            await sb.from('demandas').update({ status: novoStatus, data_fim: novaDataFim, data_inicio_atendimento: novaDataInicio }).eq('id', id);
            syncSheets('demandas', 'upsert', {...item, status: novoStatus, data_fim: novaDataFim, data_inicio_atendimento: novaDataInicio});
            carregarDados();
        }

        window.deletarDemanda = async function(id) {
            if(confirm('Excluir?')) {
                const item = demandas.find(d => d.id == id);
                await sb.from('demandas').delete().eq('id', id);
                syncSheets('demandas', 'delete', {id});
                registrarLog('Exclusão', 'Demandas', `Removeu demanda: ${item ? item.titulo : id}`);
                if(document.getElementById('demanda-id-edit').value == id) cancelarEdicaoDemanda(); carregarDados();
            }
        }

        // ---- VISITANTES ----
