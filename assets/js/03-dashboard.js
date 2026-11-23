        // ════════════════════════════════════════════════════════════════
        // PAINEL — resumo das demandas, calculado no navegador a partir das
        // demandas já carregadas. Respeita o escopo do usuário
        // (demandasEscopoDash). Usa só HTML e as variáveis do tema, então
        // muda de cor junto com o tema e não depende do Chart.js.
        // ════════════════════════════════════════════════════════════════
        const _PN_CATS = [
            { cat: 'PREDIAL', nome: 'Predial',         classe: 'predial',   aba: 'predial' },
            { cat: 'AR',      nome: 'Ar condicionado', classe: 'ar',        aba: 'ar' },
            { cat: 'LIMPEZA', nome: 'Limpeza',         classe: 'limpeza',   aba: 'limpeza' },
            { cat: 'RAMAL',   nome: 'Telefonia',       classe: 'telefonia', aba: null },
            { cat: 'OUTROS',  nome: 'Outros serviços', classe: 'outros',    aba: null }
        ];
        // Ordem das cores no gráfico por mês (igual ao canvas)
        const _PN_SERIE = ['PREDIAL', 'LIMPEZA', 'AR', 'RAMAL', 'OUTROS'];
        const _PN_NOME_SERIE = { PREDIAL: 'Predial', LIMPEZA: 'Limpeza', AR: 'Ar condicionado', RAMAL: 'Telefonia', OUTROS: 'Outros' };
        // Serviço gravado em "contratada" → nome e cor no Painel
        const _PN_SERVICOS = {
            'MANUTENÇÃO PREDIAL': ['Predial', 'predial'], 'LIMPEZA': ['Limpeza', 'limpeza'], 'AR CONDICIONADO': ['Ar condicionado', 'ar'],
            'TELEFONIA': ['Telefonia', 'telefonia'], 'COPA': ['Copa', 'outros'], 'SEGURANÇA E ACESSO': ['Segurança e acesso', 'outros'],
            'SUPORTE TI': ['Suporte de TI', 'outros'], 'CARIMBOS': ['Carimbos', 'outros']
        };
        const _PN_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        // Andares da Sede: lado ímpar à esquerda (do fim para o começo) e lado par à direita
        const _PN_ANDARES = [
            { nome: '2º andar',      impar: [201, 243], par: [202, 244] },
            { nome: '1º andar',      impar: [101, 143], par: [100, 142] },
            { nome: 'Salas 30 a 69', impar: [31, 69],   par: [30, 68] },
            { nome: 'Salas 01 a 29', impar: [1, 29],    par: [2, 28] }
        ];
        const _PN_GRUPOS = [
            ['Banheiros e vestiários', /BANHEIR|VESTIAR|SANITAR|LAVABO|\bWC\b/],
            ['Teatro', /TEATRO|AUDITORIO/],
            ['Salão Nobre', /SALAO NOBRE/],
            ['Gabinete', /GABINETE|SECRETARIO|CERIMONIAL/],
            ['Área externa, garagem e portaria', /EXTERN|GARAGEM|ESTACIONAMENTO|PORTARIA|GUARITA|CANCELA|SAIDA|CALCADA|FACHADA|PATIO|JARDIM|TELHADO/],
            ['Corredores, halls, copas e recepção', /CORREDOR|HALL|COPA|RECEPCAO|BEBEDOURO|ESCADA|ELEVADOR|REFEITORIO|ENTRADA/]
        ];
        const _PN_UNIDADES = ['Arouche', 'Armênia', 'EFAPE', 'Endereços externos'];

        function _pnNorm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
        function _pnSalaValida(n) { return (n >= 1 && n <= 69) || (n >= 100 && n <= 143) || (n >= 201 && n <= 244); }
        // Onde fica a demanda: sala da Sede, grupo de locais da Sede ou outra unidade
        function _pnLocal(setor) {
            const s = _pnNorm(setor);
            if (/AROUCHE/.test(s)) return { un: 'Arouche' };
            if (/ARMENIA/.test(s)) return { un: 'Armênia' };
            if (/EFAPE/.test(s)) return { un: 'EFAPE' };
            if (/CASA VERDE|TENENTE PENA|ENDERECO/.test(s)) return { un: 'Endereços externos' };
            const m = s.match(/\bSALAS?\s*(\d{1,3})(?!\d)/) || s.match(/^(\d{1,3})(?!\d)(?!\s*[º°O]?\s*ANDAR)/);
            if (m) { const n = parseInt(m[1], 10); if (_pnSalaValida(n)) return { sala: n }; }
            for (const [nome, re] of _PN_GRUPOS) if (re.test(s)) return { grupo: nome };
            return { grupo: 'Outros locais da Sede' };
        }
        function _pnHoje() { return DateUtils.getNowBRT(); }
        function _pnChaveMes(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'); }
        function _pnNomeMes(chave, comAno = true) {
            const [y, m] = chave.split('-');
            const nome = _PN_MESES[parseInt(m, 10) - 1] || '';
            return nome.charAt(0).toUpperCase() + nome.slice(1) + (comAno ? ' de ' + y : '');
        }
        function _pnDiaMes(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
        function _pnNum(n) { return Number(n || 0).toLocaleString('pt-BR'); }
        function _pnDiasUteis(horas) { return Math.floor((horas || 0) / 24); }
        function _pnTexto(t) { return t === 1 ? '1 dia útil' : _pnNum(t) + ' dias úteis'; }
        // Duração em horas úteis → [valor, unidade] para os números grandes
        function _pnDuracao(horas) {
            if (horas == null || isNaN(horas)) return ['—', ''];
            if (horas < 24) return [String(Math.max(1, Math.round(horas))), Math.round(horas) === 1 ? 'hora útil' : 'horas úteis'];
            return [(horas / 24).toFixed(1).replace('.', ','), 'dias úteis'];
        }
        function _pnPodeVerGeral() { return pode('demandas', 'ver'); }
        // Aba onde a demanda pode ser aberta pelo usuário (geral ou a técnica dele)
        function _pnAbaDe(d) {
            if (_pnPodeVerGeral()) return 'demandas';
            const c = _PN_CATS.find(x => x.cat === getCategoriaCached(d));
            return c && c.aba && pode(c.aba, 'ver') ? c.aba : null;
        }
        function _pnPrimeiraAbaDemandas() {
            if (_pnPodeVerGeral()) return 'demandas';
            const c = _PN_CATS.find(x => x.aba && pode(x.aba, 'ver'));
            return c ? c.aba : null;
        }

        // ── Seletor de mês: do mês atual até o primeiro mês com demanda ──
        function _pnPreencherMeses(lista) {
            const sel = document.getElementById('dash-filtro-mes');
            if (!sel) return '';
            const atual = _pnChaveMes(_pnHoje());
            let primeiro = atual;
            lista.forEach(d => { const k = (d.data || '').slice(0, 7); if (/^\d{4}-\d{2}$/.test(k) && k < primeiro) primeiro = k; });
            const opcoes = [];
            let [y, m] = atual.split('-').map(Number);
            for (let i = 0; i < 60; i++) {
                const k = y + '-' + String(m).padStart(2, '0');
                opcoes.push(k);
                if (k <= primeiro) break;
                m--; if (m === 0) { m = 12; y--; }
            }
            const assinatura = opcoes.join(',');
            if (sel.dataset.opcoes !== assinatura) {
                const anterior = sel.dataset.opcoes ? sel.value : null;
                sel.innerHTML = opcoes.map(k => `<option value="${k}">${_pnNomeMes(k)}</option>`).join('') + '<option value="">Todo o período</option>';
                sel.dataset.opcoes = assinatura;
                // Padrão: último mês fechado (ou o atual, se ainda não houver anterior)
                const padrao = opcoes[1] || opcoes[0];
                const manter = sel.dataset.escolhido === '1' && anterior !== null && (anterior === '' || opcoes.includes(anterior));
                sel.value = manter ? anterior : padrao;
            }
            return sel.value;
        }

        function _pnCardAberto(abertas) {
            const el = document.getElementById('pn-aberto'); if (!el) return;
            const total = abertas.length;
            const andamento = abertas.filter(d => d.status === 'Em Andamento').length;
            const pendentes = total - andamento;
            let vencidas = 0, maisAntiga = 0;
            abertas.forEach(d => { const i = idadeAberta(d); if (i == null) return; if (i > metaSLA(d)) vencidas++; if (i > maisAntiga) maisAntiga = i; });
            let frase;
            if (!total) frase = 'Nenhuma demanda esperando conclusão neste momento.';
            else {
                frase = vencidas === total ? (total === 1 ? 'Já passou do prazo de SLA.' : 'Todas já passaram do prazo de SLA.')
                      : vencidas === 0 ? 'Todas estão dentro do prazo de SLA.'
                      : (vencidas === 1 ? '1 já passou do prazo de SLA.' : _pnNum(vencidas) + ' já passaram do prazo de SLA.');
                const dias = _pnDiasUteis(maisAntiga);
                frase += total === 1 ? ` Está aberta há ${dias ? _pnTexto(dias) : 'menos de 1 dia útil'}.`
                                     : ` A mais antiga está aberta há ${dias ? _pnTexto(dias) : 'menos de 1 dia útil'}.`;
            }
            const porCat = {}; abertas.forEach(d => { const c = getCategoriaCached(d); porCat[c] = (porCat[c] || 0) + 1; });
            const chips = _PN_CATS.filter(c => porCat[c.cat]).map(c =>
                `<button type="button" class="pn-chip" onclick="painelIrCategoria('${c.cat}')"><span class="pn-ponto ${c.classe}" aria-hidden="true"></span>${c.nome} <b>${_pnNum(porCat[c.cat])}</b></button>`).join('');
            const pA = total ? andamento * 100 / total : 0;
            el.innerHTML = `
                <h3 class="pn-rotulo">Em aberto agora</h3>
                <div class="pn-aberto-corpo">
                    <div class="pn-num">${_pnNum(total)}</div>
                    <div class="pn-aberto-txt"><strong>${total === 1 ? 'demanda esperando conclusão' : 'demandas esperando conclusão'}</strong><p>${frase}</p></div>
                </div>
                ${total ? `<div class="pn-barra" role="img" aria-label="${andamento} em andamento e ${pendentes} pendentes">${andamento ? `<span style="width:${pA}%"></span>` : ''}${pendentes ? `<span class="pen" style="width:${100 - pA}%"></span>` : ''}</div>
                <div class="pn-legenda"><span><i aria-hidden="true"></i>${_pnNum(andamento)} em andamento</span><span><i class="pen" aria-hidden="true"></i>${_pnNum(pendentes)} ${pendentes === 1 ? 'pendente' : 'pendentes'}</span></div>
                <div class="pn-chips">${chips}</div>` : ''}`;
        }

        function _pnCardMes(lista, mes) {
            const el = document.getElementById('pn-mes'); if (!el) return;
            const hoje = _pnHoje();
            const atual = _pnChaveMes(hoje);
            const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            const doMes = lista.filter(d => !mes || (d.data || '').startsWith(mes));
            const concluidasNoMes = lista.filter(d => {
                if (d.status !== 'Concluído') return false;
                if (!mes) return true;
                const f = _parseFim(d); return f && _pnChaveMes(f) === mes;
            }).length;
            const m = computeDashboardSLA(doMes);
            const titulo = mes ? _pnNomeMes(mes) : 'Todo o período';
            const marca = !mes ? 'desde o primeiro registro' : mes === _pnChaveMes(ant) ? 'último mês fechado' : mes === atual ? 'até o dia ' + hoje.getDate() : '';
            const [tma, tmaU] = _pnDuracao(m.tma);
            const [tpr, tprU] = _pnDuracao(m.tmpr);
            el.innerHTML = `
                <div class="pn-topo"><h3 class="pn-rotulo">${titulo}</h3><span class="pn-kpi-sub">${marca}</span></div>
                <div class="pn-mes-grade">
                    <div><div class="pn-kpi-rot">Demandas abertas</div><div class="pn-kpi-val">${_pnNum(doMes.length)}</div><div class="pn-kpi-sub">${_pnNum(concluidasNoMes)} ${concluidasNoMes === 1 ? 'concluída' : 'concluídas'} ${mes ? 'no mês' : 'no total'}</div></div>
                    <div><div class="pn-kpi-rot">SLA cumprido</div><div class="pn-kpi-val">${m.slaPct == null ? '—' : m.slaPct + '%'}</div><div class="pn-kpi-sub">${m.concluidasValidas ? 'medido em ' + _pnNum(m.concluidasValidas) + (m.concluidasValidas === 1 ? ' concluída' : ' concluídas') : 'sem demandas concluídas'}</div></div>
                    <div><div class="pn-kpi-rot">Tempo médio de atendimento</div><div class="pn-kpi-val">${tma}${tmaU ? `<small>${tmaU}</small>` : ''}</div><div class="pn-kpi-sub">da abertura à conclusão</div></div>
                    <div><div class="pn-kpi-rot">Tempo de 1ª resposta</div><div class="pn-kpi-val">${tpr}${tprU ? `<small>${tprU}</small>` : ''}</div><div class="pn-kpi-sub">${m.respCount ? 'em ' + _pnNum(m.respCount) + (m.respCount === 1 ? ' demanda com registro' : ' demandas com registro') : 'sem início de atendimento registrado'}</div></div>
                </div>`;
        }

        function _pnCardSede(lista, abertas) {
            const el = document.getElementById('pn-sede'); if (!el) return;
            const ano = String(_pnHoje().getFullYear());
            const salas = {}, grupos = {}, unidades = {};
            const somar = (alvo, chave, campo) => { alvo[chave] = alvo[chave] || { t: 0, a: 0 }; alvo[chave][campo]++; };
            const registrar = (d, campo) => {
                const l = _pnLocal(d.setor);
                if (l.sala) somar(salas, l.sala, campo); else if (l.un) somar(unidades, l.un, campo); else somar(grupos, l.grupo, campo);
            };
            lista.forEach(d => { if ((d.data || '').startsWith(ano)) registrar(d, 't'); });
            abertas.forEach(d => registrar(d, 'a'));
            const nivel = t => t >= 20 ? 'j4' : t >= 10 ? 'j3' : t >= 5 ? 'j2' : t >= 1 ? 'j1' : '';
            const janelas = ([ini, fim], inverter) => {
                const nums = []; for (let n = ini; n <= fim; n += 2) nums.push(n);
                if (inverter) nums.reverse();
                return nums.map(n => {
                    const s = salas[n] || { t: 0, a: 0 };
                    const dica = `Sala ${n}: ${s.t === 1 ? '1 demanda' : s.t + ' demandas'} em ${ano}${s.a ? ', ' + s.a + ' em aberto' : ''}`;
                    return `<button type="button" class="pn-jan ${s.a ? 'acesa' : nivel(s.t)}" data-sala="${n}" title="${dica}" aria-label="${dica}"></button>`;
                }).join('');
            };
            let salasAbertas = 0; Object.values(salas).forEach(s => { if (s.a) salasAbertas++; });
            const andares = _PN_ANDARES.map(a => {
                let t = 0, ab = 0;
                for (let n = Math.min(a.impar[0], a.par[0]); n <= Math.max(a.impar[1], a.par[1]); n++) { if (salas[n]) { t += salas[n].t; ab += salas[n].a; } }
                return `<div class="pn-andar">
                    <div class="pn-janelas impar">${janelas(a.impar, true)}</div>
                    <div class="pn-andar-rot"><b>${a.nome}</b>${_pnNum(t)} ${t === 1 ? 'demanda' : 'demandas'}<br><span class="${ab ? 'pn-ab' : 'pn-ok'}">${ab ? ab + ' em aberto' : 'nada em aberto'}</span></div>
                    <div class="pn-janelas par">${janelas(a.par, false)}</div>
                </div>`;
            }).join('');
            const linha = (nome, g) => `<div class="pn-local"><span title="${esc(nome)}">${esc(nome)}</span><b>${_pnNum(g.t)}</b><span class="${g.a ? 'pn-ab' : 'pn-ok'}">${g.a ? g.a + ' em aberto' : 'tudo concluído'}</span></div>`;
            const listaGrupos = Object.entries(grupos).filter(([, g]) => g.t || g.a)
                .sort((x, y) => (x[0] === 'Outros locais da Sede') - (y[0] === 'Outros locais da Sede') || y[1].t - x[1].t)
                .map(([n, g]) => linha(n, g)).join('');
            const listaUn = _PN_UNIDADES.filter(n => unidades[n] && (unidades[n].t || unidades[n].a)).map(n => linha(n, unidades[n])).join('');
            el.innerHTML = `
                <div class="pn-topo"><h3 class="pn-titulo">A Sede, sala por sala</h3><span class="pn-kpi-sub">${salasAbertas === 1 ? '1 sala com demanda em aberto' : _pnNum(salasAbertas) + ' salas com demanda em aberto'}</span></div>
                <div class="pn-sede-corpo">
                    <div>
                        <p class="pn-desc">Cada janela é uma sala. Quanto mais clara, mais demandas em ${ano}. As amarelas têm demanda em aberto. Clique numa sala para ver as demandas dela.</p>
                        <div class="pn-lados"><span>Lado ímpar</span><span>Lado par</span></div>
                        ${andares}
                        <div class="pn-chao"></div>
                        <div class="pn-escala"><span><i></i>nenhuma</span><span><i class="j1"></i>1 a 4</span><span><i class="j2"></i>5 a 9</span><span><i class="j3"></i>10 a 19</span><span><i class="j4"></i>20 ou mais</span><span><i class="acesa"></i>com demanda em aberto</span></div>
                    </div>
                    <div class="pn-locais">
                        ${listaGrupos ? `<h4>Fora das salas numeradas</h4>${listaGrupos}` : ''}
                        ${listaUn ? `<div class="pn-grupo"><h4>Outras unidades</h4>${listaUn}</div>` : ''}
                    </div>
                </div>`;
        }

        function _pnCardFila(abertas) {
            const el = document.getElementById('pn-fila'); if (!el) return;
            const peso = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
            const ordenadas = abertas.map(d => ({ d, idade: idadeAberta(d) || 0 }))
                .sort((x, y) => ((peso[x.d.prioridade] ?? 3) - (peso[y.d.prioridade] ?? 3)) || (y.idade - x.idade));
            const itens = ordenadas.slice(0, 5).map(({ d, idade }) => {
                const pri = d.prioridade || 'Baixa';
                const cls = pri === 'Alta' ? 'alta' : pri === 'Média' ? 'media' : 'baixa';
                const serv = _PN_SERVICOS[(d.contratada || '').trim().toUpperCase()];
                const servNome = serv ? serv[0] : (d.contratada || '').trim();
                const dias = _pnDiasUteis(idade);
                return `<button type="button" class="pn-fila-item" onclick="painelAbrirDemanda(${Number(d.id)})">
                    <div><span class="pn-fila-tit">${esc(d.titulo || 'Sem descrição')}</span>
                        <span class="pn-fila-meta">${d.setor ? `<span class="pn-local-chip">${esc(d.setor)}</span>` : ''}<span class="pn-pri-txt ${cls}">${pri}</span><span>${esc(servNome)}</span></span></div>
                    <span class="pn-pri ${cls}">${pri}</span>
                    <span class="pn-fila-status">${d.status === 'Em Andamento' ? 'Em andamento' : esc(d.status || 'Pendente')}</span>
                    <span class="pn-du"><b>${dias ? _pnTexto(dias) : 'menos de 1 dia'}</b><span>desde ${_pnDiaMes(d.data)}</span></span>
                </button>`;
            }).join('');
            el.innerHTML = `
                <div class="pn-topo"><h3 class="pn-titulo">Fila de atenção</h3>${abertas.length ? `<button type="button" class="pn-link" onclick="painelVerAbertas()">Ver as ${_pnNum(abertas.length)} em aberto</button>` : ''}</div>
                <p class="pn-desc">Prioridade alta primeiro, depois as mais antigas.</p>
                <div class="pn-lista">${itens || '<p class="pn-vazio">Nenhuma demanda em aberto.</p>'}</div>`;
        }

        function _pnCardServicos(lista) {
            const el = document.getElementById('pn-servicos'); if (!el) return;
            const ano = String(_pnHoje().getFullYear());
            const doAno = lista.filter(d => (d.data || '').startsWith(ano));
            const m = computeDashboardSLA(doAno);
            let fora = 0;
            const linhas = m.contratadas.map(c => {
                const chave = c.nome.trim().toUpperCase();
                const conhecido = _PN_SERVICOS[chave];
                if (!conhecido && c.total < 5) { fora += c.total; return ''; }
                const nome = conhecido ? conhecido[0] : chave.charAt(0) + chave.slice(1).toLowerCase();
                const classe = conhecido ? conhecido[1] : 'outros';
                const sla = c.slaPct;
                const nivel = sla == null ? '' : sla >= 90 ? '' : sla >= 70 ? 'medio' : 'baixo';
                return `<tr><td><span class="pn-ponto ${classe}" aria-hidden="true"></span>${esc(nome)}</td><td>${_pnNum(c.total)}</td>
                    <td class="${c.abertas ? 'pn-ab' : 'pn-ok'}">${_pnNum(c.abertas)}</td><td>${formatarDuracao(c.tma)}</td>
                    <td>${sla == null ? '—' : `<span class="pn-sla"><span class="pn-sla-barra" aria-hidden="true"><i class="${nivel}" style="width:${sla}%"></i></span><b>${sla}%</b></span>`}</td></tr>`;
            }).join('');
            el.innerHTML = `
                <h3 class="pn-titulo">Desempenho por serviço em ${ano}</h3>
                ${linhas ? `<table class="pn-tab"><thead><tr><th>Serviço</th><th>Total</th><th>Abertas</th><th title="Tempo médio de atendimento">TMA</th><th>SLA</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p class="pn-vazio">Nenhuma demanda em ' + ano + '.</p>'}
                <p class="pn-nota">TMA em dias úteis. Prazo de SLA: prioridade alta 1 dia útil, média 3, baixa 7.${fora ? (fora === 1 ? ' Um registro ficou de fora porque o serviço não está entre os cadastrados.' : ` ${fora} registros ficaram de fora porque o serviço não está entre os cadastrados.`) : ''}</p>`;
        }

        function _pnCardMeses(lista) {
            const el = document.getElementById('pn-meses'); if (!el) return;
            const hoje = _pnHoje();
            const ano = hoje.getFullYear();
            const meses = [];
            for (let i = 0; i <= hoje.getMonth(); i++) meses.push({ chave: ano + '-' + String(i + 1).padStart(2, '0'), cats: {}, total: 0, lista: [] });
            const idx = {}; meses.forEach((m, i) => idx[m.chave] = i);
            lista.forEach(d => {
                const i = idx[(d.data || '').slice(0, 7)]; if (i == null) return;
                const c = getCategoriaCached(d);
                meses[i].cats[c] = (meses[i].cats[c] || 0) + 1; meses[i].total++; meses[i].lista.push(d);
            });
            const max = Math.max(1, ...meses.map(m => m.total));
            const ALT = 200;
            const n = meses.length;
            const colunas = meses.map(m => {
                const partes = _PN_SERIE.filter(c => m.cats[c]).map(c => {
                    const cls = _PN_CATS.find(x => x.cat === c).classe;
                    return `<i class="${cls}" style="height:${Math.max(2, m.cats[c] * ALT / max)}px" title="${_PN_NOME_SERIE[c]}: ${m.cats[c]}"></i>`;
                }).join('');
                const desc = m.total + (m.total === 1 ? ' demanda aberta em ' : ' demandas abertas em ') + _pnNomeMes(m.chave);
                return `<div class="pn-col" role="img" aria-label="${desc}">${m.total ? `<span class="pn-col-total">${_pnNum(m.total)}</span><div class="pn-pilha">${partes}</div>` : ''}</div>`;
            }).join('');
            const eixo = meses.map(m => `<span>${_PN_MESES[parseInt(m.chave.slice(5), 10) - 1].slice(0, 3)}</span>`).join('');
            const slas = meses.map(m => {
                const s = m.total ? computeDashboardSLA(m.lista).slaPct : null;
                return `<span>${s == null ? '—' : s + '%'}<i aria-hidden="true"><b style="width:${s || 0}%"></b></i></span>`;
            }).join('');
            const serie = _PN_SERIE.map(c => `<span><span class="pn-ponto ${_PN_CATS.find(x => x.cat === c).classe}" aria-hidden="true"></span>${_PN_NOME_SERIE[c]}</span>`).join('');
            el.innerHTML = `
                <h3 class="pn-titulo">Demandas abertas por mês em ${ano}</h3>
                <div class="pn-serie">${serie}</div>
                <div class="pn-barras" style="--n:${n}">${colunas}</div>
                <div class="pn-eixo" style="--n:${n}">${eixo}</div>
                <div class="pn-sla-tit">SLA cumprido em cada mês</div>
                <div class="pn-sla-mes" style="--n:${n}">${slas}</div>
                <p class="pn-nota">${_pnNomeMes(_pnChaveMes(hoje), false)} conta até o dia ${hoje.getDate()}.</p>`;
        }

        // Movimento dos outros controles no mesmo mês (só os módulos que o usuário vê)
        function _pnCardOutros(mes) {
            const el = document.getElementById('pn-outros'); if (!el) return;
            const no = (v) => !mes || (v || '').startsWith(mes);
            const cel = [];
            if (pode('visitantes', 'ver')) cel.push(['Recepção', _pnNum(visitantes.filter(v => no(v.entrada)).length), 'visitantes registrados']);
            if (pode('veiculos', 'ver')) {
                const f = frota.filter(v => no(v.hora_inicial));
                cel.push(['Garagem', _pnNum(f.length), `${_pnNum(f.filter(v => v.tipo === 'servidor').length)} de servidores, ${_pnNum(f.filter(v => v.tipo === 'visitante').length)} de visitantes`]);
            }
            if (pode('eventos', 'ver')) {
                const ev = eventos.filter(v => no(v.data));
                cel.push(['Eventos', _pnNum(ev.length), _pnNum(ev.reduce((s, e) => s + (parseInt(e.publico) || 0), 0)) + ' pessoas de público']);
            }
            if (pode('crachas', 'ver')) cel.push(['Crachás', _pnNum(crachas.filter(c => no(c.data_solicitacao)).length), 'pedidos de crachá']);
            if (!cel.length) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <h3 class="pn-titulo">Outros controles ${mes ? 'em ' + _pnNomeMes(mes).toLowerCase() : 'no período todo'}</h3>
                <div class="pn-outros-grade">${cel.map(([r, v, s]) => `<div class="pn-outro"><div class="pn-kpi-rot">${r}</div><div class="pn-kpi-val">${v}</div><div class="pn-kpi-sub">${s}</div></div>`).join('')}</div>`;
        }

        // Contadores de demandas em aberto no menu lateral
        window._atualizarContadoresMenu = function() {
            if (typeof demandas === 'undefined' || !currentUserData) return;
            const abertas = demandas.filter(d => d.status !== 'Concluído');
            const porCat = {}; abertas.forEach(d => { const c = getCategoriaCached(d); porCat[c] = (porCat[c] || 0) + 1; });
            const pinta = (aba, n) => {
                const btn = document.getElementById('tab-' + aba); if (!btn) return;
                let b = btn.querySelector('.tab-contador');
                if (!n) { if (b) b.remove(); return; }
                if (!b) { b = document.createElement('span'); b.className = 'tab-contador'; btn.appendChild(b); }
                b.textContent = n > 999 ? '999+' : n;
                b.setAttribute('aria-label', n + ' em aberto');
            };
            pinta('demandas', abertas.length);
            pinta('predial', porCat.PREDIAL || 0);
            pinta('ar', porCat.AR || 0);
            pinta('limpeza', porCat.LIMPEZA || 0);
        };

        async function renderizarDashboard() {
            atualizarTodosKPIs();
            if (!document.getElementById('pn-aberto')) return;
            aplicarEscopoDashboardUI();
            const uniSel = (document.getElementById('dash-filtro-unidade') || {}).value || '';
            const lista = (demandasEscopoDash() || []).filter(d => !uniSel || unidadeDe(d) === uniSel);
            const abertas = lista.filter(d => d.status !== 'Concluído');
            const mes = _pnPreencherMeses(lista);
            const btnNova = document.getElementById('pn-btn-nova');
            if (btnNova) btnNova.style.display = _pnPrimeiraAbaDemandas() && (pode('demandas', 'editar') || ['predial', 'ar', 'limpeza'].some(a => pode(a, 'editar'))) ? '' : 'none';
            const sub = document.getElementById('pn-subtitulo');
            if (sub) {
                const cats = dashCategoriasPermitidas();
                sub.textContent = cats === null ? 'Sede e demais unidades, com os dados do banco atualizados agora'
                    : 'Somente ' + (cats.length ? cats.map(c => (_PN_CATS.find(x => x.cat === c) || {}).nome).join(', ').toLowerCase() : 'as áreas liberadas para você') + ', com os dados do banco atualizados agora';
            }
            _pnCardAberto(abertas);
            _pnCardMes(lista, mes);
            _pnCardSede(lista, abertas);
            _pnCardFila(abertas);
            _pnCardServicos(lista);
            _pnCardMeses(lista);
            _pnCardOutros(mes);
        }

        // ── Ações do Painel ──
        window.painelNovaDemanda = function() {
            const aba = _pnPrimeiraAbaDemandas(); if (!aba) return;
            switchTab(aba);
            setTimeout(() => novoRegistro(aba), 0);
        };
        window.painelVerAbertas = function() {
            const aba = _pnPrimeiraAbaDemandas(); if (!aba) return;
            switchTab(aba);
            const b = document.querySelector(`.lista-visoes[data-lista="${aba}"] [data-visao="abertas"]`);
            if (b && !b.classList.contains('ativa')) b.click();
        };
        window.painelAbrirDemanda = function(id) {
            const d = demandas.find(x => x.id == id); if (!d) return;
            const aba = _pnAbaDe(d); if (!aba) return;
            if (window.matchMedia('(max-width: 900px)').matches && window.abrirDetalheDemanda) { abrirDetalheDemanda(d.id, aba === 'demandas' ? undefined : aba); return; }
            switchTab(aba);
            editarDemanda(d.id, aba === 'demandas' ? undefined : aba);
        };
        window.painelIrCategoria = function(cat) {
            const c = _PN_CATS.find(x => x.cat === cat);
            if (c && c.aba && pode(c.aba, 'ver')) { switchTab(c.aba); return; }
            if (!_pnPodeVerGeral()) return;
            switchTab('demandas');
            const f = document.getElementById('filtro-servico-demanda');
            if (f && [...f.options].some(o => o.value === cat)) { f.value = cat; f.dispatchEvent(new Event('change', { bubbles: true })); }
        };
        window.painelVerSala = function(n) {
            if (!_pnPodeVerGeral()) return;
            switchTab('demandas');
            const todas = document.querySelector('.lista-visoes[data-lista="demandas"] [data-visao="todas"]');
            if (todas) todas.click();
            const i = document.getElementById('filtro-texto-demanda');
            if (i) { i.value = 'Sala ' + n; i.dispatchEvent(new Event('input', { bubbles: true })); window.renderizarApenasDemandas?.(); }
        };
        document.addEventListener('click', (e) => {
            const j = e.target.closest('#pn-sede .pn-jan');
            if (j) painelVerSala(Number(j.dataset.sala));
        });
