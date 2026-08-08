        async function carregarDados() {
            if (!currentUserData) return;
            _ultimaCargaIniciada = Date.now();
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
            if (admin) { keys.push('logs'); promises.push(sb.from('logs_auditoria').select('*').order('id', { ascending: false }).limit(50).then(r => r.error ? null : (r.data || []))); }
            const results = await Promise.all(promises);
            const activeTab = document.querySelector('.section.active')?.id || '';
            let falhas = 0;
            results.forEach((data, index) => {
                const key = keys[index];
                // fetchAll devolve null quando a busca falhou (rede/RLS). Nesse caso
                // preserva o que já estava em memória em vez de esvaziar a tela.
                if (data === null || data === undefined) { falhas++; return; }
                if(key === 'demandas')    { demandas = data; _catCache = new WeakMap(); }
                if(key === 'visitantes')  { visitantes = data; }
                if(key === 'frota')       { frota = data; }
                if(key === 'eventos')     { eventos = data; }
                if(key === 'crachas')     { crachas = data; }
                if(key === 'ocorrencias') { ocorrencias = data; }
                if(key === 'logs')        { logs = data; if(activeTab === 'auditoria') renderizarLogs(); }
            });
            _dadosCarregados = true;
            // Atualiza TODOS os cards/KPIs sempre, independente da aba ativa
            atualizarTodosKPIs();
            if(activeTab === 'dashboard') { renderizarDashboard(); }
            if (falhas) showToast('Não foi possível atualizar todos os dados. Verifique a conexão.', 'warning', 5000);
            // 1ª carga concluída e renderizada → revela o app já populado (some o splash
            // de boot). Idempotente: nas recargas de CRUD/realtime é no-op.
            if (typeof _esconderBootSplash === 'function') _esconderBootSplash();
        }
        // Momento em que o último carregarDados() começou — o realtime usa isso
        // para descartar eventos que a recarga local com certeza já trouxe
        // (evita baixar todas as tabelas duas vezes na mesma gravação).
        var _ultimaCargaIniciada = 0;

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

        // ════════════════════════════════════════════════════════════════
        // atualizarTodosKPIs — mantém cards e KPIs sincronizados após
        // qualquer gravação/exclusão/evento de realtime. NÃO depende do Chart.js.
        //
        // Os cards de cada aba (Demandas, Predial, AR, Limpeza, Recepção,
        // Garagem, Eventos, Crachás, Ocorrências) pertencem à própria aba e são
        // calculados pelo renderizador dela, respeitando os filtros daquela tela.
        // Antes eles eram recalculados aqui usando o filtro de mês do DASHBOARD:
        // bastava um CRUD/realtime para os números de uma aba passarem a
        // contradizer a tabela logo abaixo deles. Cada renderizador só reconstrói
        // o HTML da tabela quando sua aba está visível, então o custo é o mesmo.
        // ════════════════════════════════════════════════════════════════
        function atualizarTodosKPIs() {
            try {
                window.renderizarApenasDemandas?.();
                window.renderizarAbasEspecificas?.();
                window.renderizarApenasVisitantes?.();
                window.renderizarApenasFrota?.();
                window.renderizarApenasEventos?.();
                window.renderizarApenasCrachas?.();
                window.renderizarApenasOcorrencias?.();

                // "Total de Veículos no Período" pertence ao Dashboard e segue
                // o filtro de mês dele (não o da aba Garagem).
                const filtroMes = (document.getElementById('dash-filtro-mes') || {}).value || '';
                const elGar = document.getElementById('total-garagem-label');
                if (elGar) elGar.innerText = frota.filter(f => !filtroMes || (f.hora_inicial||'').startsWith(filtroMes)).length;
            } catch(err) { console.warn('atualizarTodosKPIs:', err); }
        }

        // ════════════════════════════════════════════════════════════════
        // renderizarKPIsOperacionais — KPIs de SLA/backlog/aging + tabelas
        // NÃO depende do Chart.js. Roda sempre que o dashboard é exibido.
        // ════════════════════════════════════════════════════════════════
