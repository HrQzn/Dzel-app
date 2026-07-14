        function renderizarKPIsOperacionais() {
            try {
                const filtroMes = (document.getElementById('dash-filtro-mes') || {}).value || '';
                const listaDemandas = demandasEscopoDash().filter(d => !filtroMes || (d.data||'').startsWith(filtroMes));
                const m = computeDashboardSLA(listaDemandas);

                const e = id => document.getElementById(id);
                const setHTML = (id, html) => { const el = e(id); if (el) el.innerHTML = html; };
                const setTxt  = (id, val)  => { const el = e(id); if (el) el.innerText = val; };

                // ── KPI: TMA ──
                setTxt('kpi-tma', formatarDuracao(m.tma));
                setHTML('kpi-tma-sub', m.tma == null
                    ? 'Sem conclusões com tempo registrado'
                    : `Média de ${m.concluidasValidas} concluída(s)`);

                // ── KPI: Tempo de 1ª Resposta ──
                setTxt('kpi-tmpr', formatarDuracao(m.tmpr));
                setHTML('kpi-tmpr-sub', m.tmpr == null
                    ? 'Aguardando demandas com atendimento iniciado'
                    : `Média de ${m.respCount} demanda(s) atendida(s)`);

                // ── KPI: SLA % (cor por faixa) ──
                setTxt('kpi-sla-pct', m.slaPct == null ? '—' : m.slaPct + '%');
                setHTML('kpi-sla-sub', m.slaPct == null
                    ? 'Sem dados de prazo'
                    : `Meta: A 1d · M 3d · B 7d (úteis)`);
                // cor do valor + ícone conforme desempenho
                const corSLA = m.slaPct == null ? 'var(--text-primary)'
                    : m.slaPct >= 90 ? 'var(--success)'
                    : m.slaPct >= 70 ? 'var(--warning)'
                    : 'var(--danger)';
                const fundoSLA = m.slaPct == null ? '#f0fdf4'
                    : m.slaPct >= 90 ? '#f0fdf4'
                    : m.slaPct >= 70 ? '#fefce8'
                    : '#fef2f2';
                const elPct = e('kpi-sla-pct'); if (elPct) elPct.style.color = corSLA;
                const elIcoEl = e('kpi-sla-iconel'); if (elIcoEl) elIcoEl.style.color = corSLA;
                const elIco = e('kpi-sla-icon'); if (elIco) elIco.style.background = fundoSLA;

                // ── KPI: Backlog / Vencidas ──
                setTxt('kpi-backlog',  m.backlog);
                setTxt('kpi-vencidas', m.vencidas);

                // ── Aging ──
                setHTML('kpi-aging-02', `${m.bucket02} <small>demandas</small>`);
                setHTML('kpi-aging-37', `${m.bucket37} <small>demandas</small>`);
                setHTML('kpi-aging-7',  `${m.bucket7} <small>demandas</small>`);
                if (m.maisAntigaItem) {
                    setHTML('kpi-mais-antiga', `${Math.floor(m.maisAntigaDias)} <small>dias úteis</small>`);
                    const os = m.maisAntigaItem.numero_os ? `O.S. ${m.maisAntigaItem.numero_os}` : (m.maisAntigaItem.titulo || '').slice(0,30);
                    setTxt('kpi-mais-antiga-os', os || 'em aberto');
                } else {
                    setHTML('kpi-mais-antiga', `— <small>dias úteis</small>`);
                    setTxt('kpi-mais-antiga-os', 'nenhuma demanda em aberto');
                }

                // ── Contexto / volume (com sufixo <small>) ──
                const listaFrota      = frota.filter(f => !filtroMes || (f.hora_inicial||'').startsWith(filtroMes));
                const listaVisitantes = visitantes.filter(v => !filtroMes || (v.entrada||'').startsWith(filtroMes));
                const listaEventos    = eventos.filter(ev => !filtroMes || (ev.data||'').startsWith(filtroMes));
                const listaCrachas    = crachas.filter(c => !filtroMes || (c.data_solicitacao||'').startsWith(filtroMes));
                const publicoEventos  = listaEventos.reduce((s, ev) => s + (parseInt(ev.publico) || 0), 0);
                const totalGeral = listaFrota.length + listaVisitantes.length + listaDemandas.length + listaEventos.length + listaCrachas.length;
                setHTML('kpi-total-geral',  totalGeral.toLocaleString('pt-BR') + ' <small>registros</small>');
                setHTML('kpi-total-eventos',listaEventos.length + ' <small>eventos</small>');
                setHTML('kpi-publico-eventos', publicoEventos.toLocaleString('pt-BR') + ' participantes');
                setHTML('kpi-total-crachas', listaCrachas.length + ' <small>solicitações</small>');

                // ── Tabela: Performance por Contratada ──
                const tbC = document.querySelector('#tabela-contratadas tbody');
                if (tbC) {
                    if (!m.contratadas.length) {
                        tbC.innerHTML = '<tr><td colspan="5" class="dash-empty">Nenhuma demanda no período.</td></tr>';
                    } else {
                        tbC.innerHTML = m.contratadas.slice(0, 10).map(c => {
                            const corP = c.slaPct == null ? '#64748b' : c.slaPct >= 90 ? '#059669' : c.slaPct >= 70 ? '#ca8a04' : '#dc2626';
                            const bgP  = c.slaPct == null ? '#f1f5f9' : c.slaPct >= 90 ? '#dcfce7' : c.slaPct >= 70 ? '#fef9c3' : '#fee2e2';
                            const slaTxt = c.slaPct == null ? '—' : c.slaPct + '%';
                            return `<tr>
                                <td style="font-weight:600;color:var(--text-primary);">${esc(c.nome)}</td>
                                <td style="text-align:center;">${c.total}</td>
                                <td style="text-align:center;">${c.abertas}</td>
                                <td style="text-align:center;font-family:'JetBrains Mono',monospace;">${formatarDuracao(c.tma)}</td>
                                <td style="text-align:center;"><span class="dash-badge" style="color:${corP};background:${bgP};">${slaTxt}</span></td>
                            </tr>`;
                        }).join('');
                    }
                }

                // ── Tabela: Demandas mais antigas em aberto ──
                const tbA = document.querySelector('#tabela-antigas tbody');
                if (tbA) {
                    if (!m.topAntigas.length) {
                        tbA.innerHTML = '<tr><td colspan="5" class="dash-empty">Nenhuma demanda em aberto. 🎉</td></tr>';
                    } else {
                        const corPrio = p => p === 'Alta' ? '#dc2626' : p === 'Média' ? '#ca8a04' : '#059669';
                        const bgPrio  = p => p === 'Alta' ? '#fee2e2' : p === 'Média' ? '#fef9c3' : '#dcfce7';
                        tbA.innerHTML = m.topAntigas.map(x => {
                            const d = x.d; const dias = Math.floor(x.idade/24);
                            const venceu = x.idade > metaSLA(d);
                            const prio = d.prioridade || 'Baixa';
                            return `<tr>
                                <td style="font-weight:600;">${esc(d.numero_os) || '—'}</td>
                                <td style="color:var(--text-primary);">${esc((d.titulo||'').slice(0,45))}${(d.titulo||'').length>45?'…':''}</td>
                                <td>${esc((d.setor||'').slice(0,25))}</td>
                                <td style="text-align:center;"><span class="dash-badge" style="color:${corPrio(prio)};background:${bgPrio(prio)};">${prio}</span></td>
                                <td style="text-align:center;font-weight:700;color:${venceu?'var(--danger)':'var(--text-secondary)'};">${dias}${venceu?' ⚠':''}</td>
                            </tr>`;
                        }).join('');
                    }
                }
            } catch(err) { console.warn('renderizarKPIsOperacionais:', err); }
        }

        async function renderizarDashboard() {
            // Atualiza cards/KPIs primeiro (sem depender do Chart.js)
            atualizarTodosKPIs();
            renderizarKPIsOperacionais();
            // Gráficos só renderizam quando Chart.js estiver disponível
            if (typeof Chart === 'undefined') return;
            ensureChartReady();
            const filtroMes = document.getElementById('dash-filtro-mes').value;
            aplicarEscopoDashboardUI();
            const escCats = dashCategoriasPermitidas();
            const semRestricao = escCats === null;
            const listaDemandas   = demandasEscopoDash().filter(d => !filtroMes || (d.data||'').startsWith(filtroMes));
            const listaFrota      = frota.filter(f => !filtroMes || (f.hora_inicial||'').startsWith(filtroMes));
            let counts = { 'AR': 0, 'PREDIAL': 0, 'LIMPEZA': 0, 'RAMAL': 0, 'OUTROS': 0 };
            listaDemandas.forEach(d => { const cat = getCategoriaCached(d); counts[cat] = (counts[cat] || 0) + 1; });
            const totalFrota = listaFrota.length;
            const isMobile = window.innerWidth <= 900;

            // ── Gráfico: Volume por Setor (apenas setores do escopo do usuário) ──
            const ctxVolume = document.getElementById('chartVolumeSetor').getContext('2d');
            if (chartVolume) chartVolume.destroy();
            const dadosSetor = [];
            if (semRestricao || pode('veiculos', 'ver'))      dadosSetor.push({ label: 'Garagem', valor: totalFrota });
            if (semRestricao || pode('visitantes', 'ver'))    dadosSetor.push({ label: 'Recepção', valor: visitantes.filter(v => !filtroMes || (v.entrada||'').startsWith(filtroMes)).length });
            if (semRestricao || escCats.includes('LIMPEZA'))  dadosSetor.push({ label: 'Limpeza/Copa', valor: counts['LIMPEZA'] });
            if (semRestricao || escCats.includes('PREDIAL'))  dadosSetor.push({ label: 'Manut. Predial', valor: counts['PREDIAL'] });
            if (semRestricao || pode('crachas', 'ver'))       dadosSetor.push({ label: 'Crachás', valor: crachas.filter(c => !filtroMes || (c.data_solicitacao||'').startsWith(filtroMes)).length });
            if (semRestricao)                                 dadosSetor.push({ label: 'Ramais', valor: counts['RAMAL'] });
            if (semRestricao || escCats.includes('AR'))       dadosSetor.push({ label: 'Ar Cond.', valor: counts['AR'] });
            dadosSetor.sort((a, b) => b.valor - a.valor);
            chartVolume = new Chart(ctxVolume, {
                type: 'bar',
                data: { labels: dadosSetor.map(d => d.label), datasets: [{ label: 'Volume', data: dadosSetor.map(d => d.valor), backgroundColor: '#3b82f6', borderRadius: 6, barThickness: isMobile ? 14 : 18 }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: isMobile ? 30 : 40, left: isMobile ? 0 : 0 } }, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#64748b', font: { weight: 'bold', size: isMobile ? 10 : 11 }, formatter: (value) => value > 0 ? value : '' } }, scales: { x: { display: false, grace: '15%' }, y: { grid: { display: false }, ticks: { font: { size: isMobile ? 11 : 12, family: 'Plus Jakarta Sans' }, color: '#64748b' } } } }
            });

            // ── Gráfico: Tendência Mensal (linha) ──
            const tend = computeTendencia();
            const ctxTend = document.getElementById('chartTendencia').getContext('2d');
            if (chartTendencia) chartTendencia.destroy();
            chartTendencia = new Chart(ctxTend, {
                type: 'line',
                data: { labels: tend.map(t => t.label), datasets: [
                    { label: 'Aberturas', data: tend.map(t => t.abertas), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 2.5, tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#3b82f6' },
                    { label: 'Conclusões', data: tend.map(t => t.concluidas), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 2.5, tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#10b981' }
                ] },
                options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { font: { size: isMobile ? 11 : 12 }, padding: 12, usePointStyle: true } }, datalabels: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: isMobile ? 10 : 11 }, color: '#64748b' } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#94a3b8', precision: 0 } } } }
            });

            // ── Gráfico: Distribuição por Prioridade (doughnut) ──
            const slaData = computeDashboardSLA(listaDemandas);
            const ctxPrio = document.getElementById('chartPrioridade').getContext('2d');
            if (chartPrioridade) chartPrioridade.destroy();
            chartPrioridade = new Chart(ctxPrio, {
                type: 'doughnut',
                data: { labels: ['Alta', 'Média', 'Baixa'], datasets: [{ data: [slaData.prio['Alta'], slaData.prio['Média'], slaData.prio['Baixa']], backgroundColor: ['#ef4444', '#f59e0b', '#10b981'], borderWidth: 0, cutout: '62%' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: isMobile ? 11 : 12 }, padding: 10, usePointStyle: true } }, datalabels: { color: '#fff', font: { weight: 'bold', size: isMobile ? 11 : 12 }, formatter: (value, ctx) => { let sum = 0; ctx.chart.data.datasets[0].data.forEach(d => sum += d); return sum === 0 || value === 0 ? '' : (value * 100 / sum).toFixed(0) + '%'; } } } }
            });

            // ── Gráfico: Garagem Perfil (doughnut) — oculto p/ usuário restrito sem permissão ──
            if (!semRestricao && !pode('veiculos', 'ver')) return;
            const qtdServidor = listaFrota.filter(f => f.tipo === 'servidor').length;
            const qtdVisitante = listaFrota.filter(f => f.tipo === 'visitante').length;
            document.getElementById('total-garagem-label').innerText = totalFrota;
            const ctxGaragem = document.getElementById('chartGaragemPerfil').getContext('2d');
            if (chartGaragem) chartGaragem.destroy();
            chartGaragem = new Chart(ctxGaragem, {
                type: 'doughnut',
                data: { labels: ['Servidores', 'Visitantes'], datasets: [{ data: [qtdServidor || 0, qtdVisitante || 0], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0, cutout: '65%' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: isMobile ? 11 : 12 }, padding: 10 } }, datalabels: { color: '#fff', font: { weight: 'bold', size: isMobile ? 11 : 12 }, formatter: (value, ctx) => { let sum = 0; ctx.chart.data.datasets[0].data.forEach(d => sum += d); return sum === 0 ? "" : (value * 100 / sum).toFixed(0) + "%"; } } } }
            });
        }

