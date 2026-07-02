        async function carregarDados() {
            const p = currentUserData.perms || {};
            const admin = currentUserData.isAdmin;
            // Skeleton apenas no 1º carregamento (não nos reloads de CRUD/realtime)
            if (!_skeletonMostrado) {
                _skeletonMostrado = true;
                for (const id in _TABELA_COLSPAN) mostrarSkeleton(id, _TABELA_COLSPAN[id]);
            }
            const promises = []; const keys = [];
            if (admin || p.demandas?.ver || p.predial?.ver || p.limpeza?.ver || p.ar?.ver) { keys.push('demandas'); promises.push(fetchAll('demandas', 'id', false)); }
            if (admin || p.visitantes?.ver) { keys.push('visitantes'); promises.push(fetchAll('visitantes', 'id', false)); }
            if (admin || p.veiculos?.ver) { keys.push('frota'); promises.push(fetchAll('frota', 'id', false)); }
            if (admin || p.eventos?.ver) { keys.push('eventos'); promises.push(fetchAll('eventos', 'data', false)); }
            if (admin || p.crachas?.ver) { keys.push('crachas'); promises.push(fetchAll('crachas', 'id', false)); }
            if (admin || p.ocorrencias?.ver) { keys.push('ocorrencias'); promises.push(fetchAll('ocorrencias', 'data_hora', false)); }
            if (admin) { keys.push('logs'); promises.push(sb.from('logs_auditoria').select('*').order('id', { ascending: false }).limit(50).then(r => r.data || [])); }
            const results = await Promise.all(promises);
            const activeTab = document.querySelector('.section.active')?.id || '';
            results.forEach((data, index) => {
                const key = keys[index];
                if(data && data.length !== undefined) {
                    if(key === 'demandas')    { demandas = data; _catCache = new WeakMap(); window.renderizarApenasDemandas(); window.renderizarAbasEspecificas(); }
                    if(key === 'visitantes')  { visitantes = data; if(activeTab === 'visitantes') window.renderizarApenasVisitantes(); }
                    if(key === 'frota')       { frota = data; if(activeTab === 'veiculos') window.renderizarApenasFrota(); }
                    if(key === 'eventos')     { eventos = data; if(activeTab === 'eventos') window.renderizarApenasEventos(); }
                    if(key === 'crachas')     { crachas = data; if(activeTab === 'crachas') window.renderizarApenasCrachas(); }
                    if(key === 'ocorrencias') { ocorrencias = data; if(activeTab === 'ocorrencias') window.renderizarApenasOcorrencias(); }
                    if(key === 'logs')        { logs = data; if(activeTab === 'auditoria') renderizarLogs(); }
                }
            });
            // Atualiza TODOS os cards/KPIs sempre, independente da aba ativa
            atualizarTodosKPIs();
            if(activeTab === 'dashboard') { renderizarDashboard(); }
        }

        function getCategoriaDemanda(d) {
            const texto = (d.titulo + " " + d.setor).toUpperCase();
            const contratada = (d.contratada || "").toUpperCase();
            if (contratada.includes("AR CONDICIONADO") || texto.includes("AR CONDICIONADO")) return 'AR';
            if (contratada.includes("PREDIAL") || texto.includes("PREDIAL") || texto.includes("ELÉTRICA") || texto.includes("PINTURA") || texto.includes("PORTA") || texto.includes("FECHADURA")) return 'PREDIAL';
            if (contratada.includes("LIMPEZA") || texto.includes("LIMPEZA") || texto.includes("COPA") || texto.includes("CAFÉ") || texto.includes("ÁGUA")) return 'LIMPEZA';
            if (contratada.includes("RAMAL") || contratada.includes("TELEFONIA") || texto.includes("RAMAL") || texto.includes("TELEFONE") || texto.includes("TELEFONIA")) return 'RAMAL';
            return 'OUTROS';
        }

        // ════════════════════════════════════════════════════════════════
        // SLA / TEMPO DE ATENDIMENTO
        // Metas em HORAS ÚTEIS (seg–sex, 24h por dia útil). 1 dia útil = 24h.
        // ► Para ajustar os prazos, altere SLA_METAS abaixo.
        // ► Para usar apenas horário de expediente (ex: 8h–18h) em vez de
        //   dia cheio, troque a lógica de horasUteis() (ver comentário lá).
        // ════════════════════════════════════════════════════════════════
        const SLA_METAS = { 'Alta': 24, 'Média': 72, 'Baixa': 168 }; // 1, 3, 7 dias úteis
        const SLA_META_PADRAO = 72; // usado quando a prioridade não está definida

        // Converte data + hora de abertura em objeto Date (hora local BRT)
        function _parseAbertura(d) {
            if (!d || !d.data) return null;
            const hora = (d.hora && /^\d{1,2}:\d{2}/.test(d.hora)) ? d.hora.slice(0,5) : '00:00';
            const dt = new Date(`${d.data}T${hora}:00`);
            return isNaN(dt.getTime()) ? null : dt;
        }
        // Converte data_fim (ISO) em objeto Date
        function _parseFim(d) {
            if (!d || !d.data_fim) return null;
            const dt = new Date(d.data_fim);
            return isNaN(dt.getTime()) ? null : dt;
        }
        // Horas úteis entre dois instantes — conta apenas seg–sex (exclui sáb/dom)
        function horasUteis(inicio, fim) {
            if (!(inicio instanceof Date) || !(fim instanceof Date)) return null;
            if (isNaN(inicio) || isNaN(fim) || fim <= inicio) return null;
            if ((fim - inicio) > 1000*60*60*24*400) return null; // ignora spans absurdos (dado ruim)
            let totalMs = 0;
            let cursor = new Date(inicio);
            while (cursor < fim) {
                const proxMeiaNoite = new Date(cursor);
                proxMeiaNoite.setHours(24, 0, 0, 0);
                const segFim = proxMeiaNoite < fim ? proxMeiaNoite : fim;
                const dow = cursor.getDay(); // 0=dom … 6=sáb
                // ► Para contar só expediente (ex: 8h–18h), em vez da linha abaixo,
                //   recorte [segInicio,segFim] dentro de 8h–18h antes de somar.
                if (dow !== 0 && dow !== 6) totalMs += (segFim - cursor);
                cursor = segFim;
            }
            return totalMs / 3600000;
        }
        function metaSLA(d) {
            return SLA_METAS[d.prioridade] != null ? SLA_METAS[d.prioridade] : SLA_META_PADRAO;
        }
        // Tempo de resolução (concluídas) em horas úteis
        function tempoResolucao(d) {
            if (d.status !== 'Concluído') return null;
            return horasUteis(_parseAbertura(d), _parseFim(d));
        }
        // Converte data_inicio_atendimento (ISO) em Date
        function _parseInicioAtend(d) {
            if (!d || !d.data_inicio_atendimento) return null;
            const dt = new Date(d.data_inicio_atendimento);
            return isNaN(dt.getTime()) ? null : dt;
        }
        // Tempo de 1ª resposta (abertura → início do atendimento) em horas úteis
        // Só existe para demandas que já saíram de "Pendente" após a criação do campo.
        function tempoPrimeiraResposta(d) {
            const ini = _parseInicioAtend(d);
            if (!ini) return null;
            return horasUteis(_parseAbertura(d), ini);
        }
        // Idade (abertas) em horas úteis até agora
        function idadeAberta(d) {
            if (d.status === 'Concluído') return null;
            return horasUteis(_parseAbertura(d), DateUtils.getNowBRT());
        }
        // Formata duração em horas úteis → "Xh" ou "X,Xd" (dias úteis)
        function formatarDuracao(horas) {
            if (horas == null || isNaN(horas)) return '—';
            if (horas < 1)  return '<1h';
            if (horas < 24) return Math.round(horas) + 'h';
            return (horas/24).toFixed(1).replace('.', ',') + 'd';
        }

        // Calcula todos os indicadores de SLA/backlog para uma lista de demandas
        function computeDashboardSLA(lista) {
            const abertas    = lista.filter(d => d.status !== 'Concluído');
            const concluidas = lista.filter(d => d.status === 'Concluído');

            const concluidasValidas = concluidas.filter(d => tempoResolucao(d) != null);
            const tempos = concluidasValidas.map(tempoResolucao);
            const tma = tempos.length ? tempos.reduce((a,b)=>a+b,0)/tempos.length : null;

            // Tempo médio de 1ª resposta — sobre demandas que têm o carimbo
            const respTempos = lista.map(tempoPrimeiraResposta).filter(t => t != null);
            const tmpr = respTempos.length ? respTempos.reduce((a,b)=>a+b,0)/respTempos.length : null;

            const dentro = concluidasValidas.filter(d => tempoResolucao(d) <= metaSLA(d)).length;
            const slaPct = concluidasValidas.length ? Math.round(dentro*100/concluidasValidas.length) : null;

            const backlog  = abertas.length;
            const vencidas = abertas.filter(d => { const i = idadeAberta(d); return i != null && i > metaSLA(d); }).length;

            let bucket02=0, bucket37=0, bucket7=0, maisAntigaDias=0, maisAntigaItem=null;
            abertas.forEach(d => {
                const i = idadeAberta(d); if (i == null) return;
                const dias = i/24;
                if (dias <= 2) bucket02++; else if (dias <= 7) bucket37++; else bucket7++;
                if (dias > maisAntigaDias) { maisAntigaDias = dias; maisAntigaItem = d; }
            });

            const topAntigas = abertas
                .map(d => ({ d, idade: idadeAberta(d) }))
                .filter(x => x.idade != null)
                .sort((a,b) => b.idade - a.idade)
                .slice(0,5);

            const mapaContr = {};
            lista.forEach(d => {
                const c = ((d.contratada || '').trim()) || 'NÃO INFORMADA';
                if (!mapaContr[c]) mapaContr[c] = { total:0, abertas:0, tempos:[], dentro:0, comMeta:0 };
                const g = mapaContr[c];
                g.total++;
                if (d.status !== 'Concluído') g.abertas++;
                else { const t = tempoResolucao(d); if (t != null) { g.tempos.push(t); g.comMeta++; if (t <= metaSLA(d)) g.dentro++; } }
            });
            const contratadas = Object.entries(mapaContr).map(([nome,g]) => ({
                nome, total:g.total, abertas:g.abertas,
                tma: g.tempos.length ? g.tempos.reduce((a,b)=>a+b,0)/g.tempos.length : null,
                slaPct: g.comMeta ? Math.round(g.dentro*100/g.comMeta) : null
            })).sort((a,b) => b.total - a.total);

            const prio = { 'Alta':0, 'Média':0, 'Baixa':0 };
            lista.forEach(d => { if (prio[d.prioridade] != null) prio[d.prioridade]++; else prio['Baixa']++; });

            return { tma, tmpr, slaPct, backlog, vencidas, bucket02, bucket37, bucket7,
                     maisAntigaDias, maisAntigaItem, topAntigas, contratadas, prio,
                     concluidasValidas: concluidasValidas.length, respCount: respTempos.length };
        }

        // Tendência dos últimos 6 meses (sempre sobre o total, ignora filtro de mês)
        function computeTendencia() {
            const meses = [];
            const base = DateUtils.getNowBRT();
            for (let i=5; i>=0; i--) {
                const dt = new Date(base.getFullYear(), base.getMonth()-i, 1);
                const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
                const label = dt.toLocaleDateString('pt-BR', { month:'short' }).replace('.','');
                meses.push({ key, label, abertas:0, concluidas:0 });
            }
            const idx = {}; meses.forEach((m,i)=> idx[m.key]=i);
            demandasEscopoDash().forEach(d => {
                if (d.data) { const k = d.data.slice(0,7); if (idx[k]!=null) meses[idx[k]].abertas++; }
                if (d.status === 'Concluído' && d.data_fim) {
                    const f = _parseFim(d);
                    if (f) { const k = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}`; if (idx[k]!=null) meses[idx[k]].concluidas++; }
                }
            });
            return meses;
        }

        // Helper: atualiza KPI cards de Predial / AR / Limpeza sem recriar gráficos
        function _atualizarKPIsAbas(lista) {
            const fil = (cat, st) => lista.filter(d => getCategoriaDemanda(d) === cat && (!st || d.status === st)).length;
            const e = id => document.getElementById(id);
            [['predial','PREDIAL'],['ar','AR'],['limpeza','LIMPEZA']].forEach(([pfx,cat]) => {
                if (e(`dash-${pfx}-total`))     e(`dash-${pfx}-total`).innerText     = fil(cat);
                if (e(`dash-${pfx}-pendente`))  e(`dash-${pfx}-pendente`).innerText  = fil(cat,'Pendente');
                if (e(`dash-${pfx}-andamento`)) e(`dash-${pfx}-andamento`).innerText = fil(cat,'Em Andamento');
                if (e(`dash-${pfx}-concluido`)) e(`dash-${pfx}-concluido`).innerText = fil(cat,'Concluído');
            });
        }

        // ════════════════════════════════════════════════════════════════
        // atualizarTodosKPIs — atualiza TODOS os cards/KPIs do Dashboard
        // NÃO depende do Chart.js. Roda sempre após qualquer save/delete.
        // ════════════════════════════════════════════════════════════════
        function atualizarTodosKPIs() {
            try {
                const filtroMes = (document.getElementById('dash-filtro-mes') || {}).value || '';
                const listaDemandas   = demandasEscopoDash().filter(d => !filtroMes || (d.data||'').startsWith(filtroMes));
                const listaFrota      = frota.filter(f => !filtroMes || (f.hora_inicial||'').startsWith(filtroMes));
                const listaVisitantes = visitantes.filter(v => !filtroMes || (v.entrada||'').startsWith(filtroMes));
                const listaEventos    = eventos.filter(e => !filtroMes || (e.data||'').startsWith(filtroMes));
                const listaCrachas    = crachas.filter(c => !filtroMes || (c.data_solicitacao||'').startsWith(filtroMes));

                const totalFrota      = listaFrota.length;
                const totalVisitantes = listaVisitantes.length;
                const totalEventos    = listaEventos.length;
                const totalCrachas    = listaCrachas.length;
                const publicoEventos  = listaEventos.reduce((s, e) => s + (parseInt(e.publico) || 0), 0);

                let counts = { 'AR': 0, 'PREDIAL': 0, 'LIMPEZA': 0, 'RAMAL': 0, 'OUTROS': 0 };
                listaDemandas.forEach(d => { const cat = getCategoriaDemanda(d); counts[cat] = (counts[cat] || 0) + 1; });

                const totalManutencao = counts['PREDIAL'] + counts['AR'];
                const totalGeral = totalFrota + totalVisitantes + listaDemandas.length + totalEventos + totalCrachas;

                const e = id => document.getElementById(id);
                const set = (id, val) => { const el = e(id); if (el) el.innerText = val; };

                // ── KPIs do topo do Dashboard (TMA, SLA, backlog, volume) ──
                // são calculados em renderizarKPIsOperacionais() (precisam de SLA).

                // ── Cards Demandas (Geral) ──
                const dPend = listaDemandas.filter(d => d.status === 'Pendente').length;
                const dAnd  = listaDemandas.filter(d => d.status === 'Em Andamento').length;
                const dConc = listaDemandas.filter(d => d.status === 'Concluído').length;
                set('dash-demanda-total',    listaDemandas.length);
                set('dash-demanda-pendente', dPend);
                set('dash-demanda-andamento',dAnd);
                set('dash-demanda-concluido',dConc);

                // ── Cards Predial ──
                const pList = listaDemandas.filter(d => getCategoriaDemanda(d) === 'PREDIAL');
                set('dash-predial-total',    pList.length);
                set('dash-predial-pendente', pList.filter(d => d.status === 'Pendente').length);
                set('dash-predial-andamento',pList.filter(d => d.status === 'Em Andamento').length);
                set('dash-predial-concluido',pList.filter(d => d.status === 'Concluído').length);

                // ── Cards AR ──
                const aList = listaDemandas.filter(d => getCategoriaDemanda(d) === 'AR');
                set('dash-ar-total',    aList.length);
                set('dash-ar-pendente', aList.filter(d => d.status === 'Pendente').length);
                set('dash-ar-andamento',aList.filter(d => d.status === 'Em Andamento').length);
                set('dash-ar-concluido',aList.filter(d => d.status === 'Concluído').length);

                // ── Cards Limpeza ──
                const lList = listaDemandas.filter(d => getCategoriaDemanda(d) === 'LIMPEZA');
                set('dash-limpeza-total',    lList.length);
                set('dash-limpeza-pendente', lList.filter(d => d.status === 'Pendente').length);
                set('dash-limpeza-andamento',lList.filter(d => d.status === 'Em Andamento').length);
                set('dash-limpeza-concluido',lList.filter(d => d.status === 'Concluído').length);

                // ── Cards Visitantes ──
                set('dash-visitantes-ativos', listaVisitantes.filter(v => v.status === 'Ativo').length);
                set('dash-visitantes-total',  listaVisitantes.length);

                // ── Cards Frota ──
                set('dash-frota-total',       totalFrota);
                set('dash-frota-estacionados',listaFrota.filter(f => f.status === 'Aberto').length);
                set('dash-servidor-count',    listaFrota.filter(f => f.tipo === 'servidor').length);
                set('dash-visitante-count',   listaFrota.filter(f => f.tipo === 'visitante').length);
                const elGar = e('total-garagem-label'); if (elGar) elGar.innerText = totalFrota;

                // ── Cards Eventos ──
                set('dash-eventos-qtd',     totalEventos);
                set('dash-eventos-interno', listaEventos.filter(ev => ev.tipo === 'Interno').length);
                set('dash-eventos-externo', listaEventos.filter(ev => ev.tipo === 'Externo').length);
                set('dash-eventos-publico', publicoEventos);

                // ── Cards Crachás ──
                set('dash-cracha-solicitado',   listaCrachas.filter(c => c.status === 'Solicitado').length);
                set('dash-cracha-confeccionado',listaCrachas.filter(c => c.status === 'Confeccionado').length);
                set('dash-cracha-entregue',     listaCrachas.filter(c => c.status === 'Entregue').length);

                // ── Cards Ocorrências ──
                set('dash-oco-total',     ocorrencias.length);
                set('dash-oco-abertas',   ocorrencias.filter(o => o.status === 'Aberta').length);
                set('dash-oco-tratativa', ocorrencias.filter(o => o.status === 'Em Tratativa').length);
                set('dash-oco-encerradas',ocorrencias.filter(o => o.status === 'Encerrada').length);

            } catch(err) { console.warn('atualizarTodosKPIs:', err); }
        }

        // ════════════════════════════════════════════════════════════════
        // renderizarKPIsOperacionais — KPIs de SLA/backlog/aging + tabelas
        // NÃO depende do Chart.js. Roda sempre que o dashboard é exibido.
        // ════════════════════════════════════════════════════════════════
