        function criarLinhaTabela(d) {
            let badgeClass = d.status === 'Pendente' ? 'bg-pendente' : (d.status === 'Em Andamento' ? 'bg-andamento' : 'bg-concluido');
            let tempoStr = calcularTempoDecorrido(d.data, d.hora, d.data_fim);
            let tempoDisplay = (d.status === 'Concluído') ? `<span class="time-badge"><i class="fas fa-stopwatch"></i> ${tempoStr}</span>` : `<span class="time-badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a"><i class="fas fa-hourglass-half"></i> ${tempoStr}</span>`;
            let btnAvancar = (d.status !== 'Concluído' && pode('demandas', 'editar')) ? `<button onclick="avancarStatus(${d.id})" class="action-btn btn-check" title="Avançar status" aria-label="Avançar status da demanda"><i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : '';
            let btnWA    = `<button onclick="enviarWhatsAppDemanda(${d.id})" class="action-btn btn-whatsapp" title="Enviar WhatsApp" aria-label="Enviar demanda por WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i></button>`;
            let btnPrint = `<button onclick="abrirModalImpressao(${d.id})" class="action-btn btn-print" title="Imprimir O.S." aria-label="Imprimir ordem de serviço"><i class="fas fa-print" aria-hidden="true"></i></button>`;
            let btnEdit  = (pode('demandas', 'editar')) ? `<button onclick="editarDemanda(${d.id})" class="action-btn btn-edit" title="Editar" aria-label="Editar registro"><i class="fas fa-pen" aria-hidden="true"></i></button>` : '';
            let btnDel   = (pode('demandas', 'excluir')) ? `<button onclick="deletarDemanda(${d.id})" class="action-btn btn-delete" title="Excluir" aria-label="Excluir registro"><i class="fas fa-trash" aria-hidden="true"></i></button>` : '';
            const contratadaDisplay = d.contratada ? `<br><span style="color:var(--accent);font-size:0.75rem;font-weight:600;"><i class="fas fa-hard-hat"></i> ${esc(d.contratada)}</span>` : '';
            return `<tr><td><strong style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;">${formatarData(d.data)}</strong><br><small style="color:var(--text-muted)">${esc(d.hora)}</small></td><td><span class="badge bg-saiu">${esc(d.prioridade)}</span></td><td><strong>${esc(d.titulo)}</strong><br><small style="color:var(--text-muted)">${esc(d.solicitante)} · ${esc(d.setor)}</small>${contratadaDisplay}</td><td><span class="badge ${badgeClass}">${esc(d.status)}</span></td><td>${tempoDisplay}</td><td style="min-width:160px">${btnAvancar}${btnWA}${btnPrint}${btnEdit}${btnDel}</td></tr>`;
        }

        function criarLinhaTabelaSimples(d, prefixo) {
            let badgeClass = d.status === 'Pendente' ? 'bg-pendente' : (d.status === 'Em Andamento' ? 'bg-andamento' : 'bg-concluido');
            let tempoStr = calcularTempoDecorrido(d.data, d.hora, d.data_fim);
            let tempoDisplay = (d.status === 'Concluído') ? `<span class="time-badge"><i class="fas fa-stopwatch"></i> ${tempoStr}</span>` : `<span class="time-badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a"><i class="fas fa-hourglass-half"></i> ${tempoStr}</span>`;
            let btnAvancar = (d.status !== 'Concluído' && pode(prefixo, 'editar')) ? `<button onclick="avancarStatus(${d.id}, '${prefixo}')" class="action-btn btn-check" title="Avançar status" aria-label="Avançar status da demanda"><i class="fas fa-arrow-right" aria-hidden="true"></i></button>` : '';
            let btnWA2   = `<button onclick="enviarWhatsAppDemanda(${d.id})" class="action-btn btn-whatsapp" title="WhatsApp" aria-label="Enviar demanda por WhatsApp"><i class="fab fa-whatsapp" aria-hidden="true"></i></button>`;
            let btnPrint = `<button onclick="abrirModalImpressao(${d.id})" class="action-btn btn-print" title="Imprimir O.S." aria-label="Imprimir ordem de serviço"><i class="fas fa-print" aria-hidden="true"></i></button>`;
            let btnEdit  = (pode(prefixo, 'editar')) ? `<button onclick="editarDemanda(${d.id}, '${prefixo}')" class="action-btn btn-edit" title="Editar" aria-label="Editar registro"><i class="fas fa-pen" aria-hidden="true"></i></button>` : '';
            let btnDel   = (pode(prefixo, 'excluir')) ? `<button onclick="deletarDemanda(${d.id})" class="action-btn btn-delete" title="Excluir" aria-label="Excluir registro"><i class="fas fa-trash" aria-hidden="true"></i></button>` : '';
            return `<tr><td><strong style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;">${formatarData(d.data)}</strong><br><small style="color:var(--text-muted)">${esc(d.hora)}</small></td><td><strong>${esc(d.titulo)}</strong><br><small style="color:var(--text-muted)">Prioridade: ${esc(d.prioridade)}</small></td><td>${esc(d.solicitante)}<br><small style="color:var(--text-muted)">${esc(d.setor)}</small></td><td><span class="badge ${badgeClass}">${esc(d.status)}</span></td><td>${tempoDisplay}</td><td style="min-width:170px">${btnAvancar}${btnWA2}${btnPrint}${btnEdit}${btnDel}</td></tr>`;
        }

        window.renderizarApenasDemandas = function() {
            const filtroMes = document.getElementById('filtro-mes-demanda').value;
            const filtroDia = document.getElementById('filtro-dia-demanda').value;
            const filtroStatus = document.getElementById('filtro-status-demanda').value;
            const filtroTexto = document.getElementById('filtro-texto-demanda').value.toUpperCase();
            const lista = [];
            let cPend = 0, cAnd = 0, cConc = 0;
            for (let i = 0, len = demandas.length; i < len; i++) {
                const d = demandas[i];
                if (filtroMes && !(d.data||'').startsWith(filtroMes)) continue;
                if (filtroDia && (d.data||'') !== filtroDia) continue;
                if (filtroStatus && d.status !== filtroStatus) continue;
                if (filtroTexto && !(d.titulo + ' ' + d.setor + ' ' + d.solicitante + ' ' + (d.contratada||'')).toUpperCase().includes(filtroTexto)) continue;
                lista.push(d);
                if (d.status === 'Pendente') cPend++;
                else if (d.status === 'Em Andamento') cAnd++;
                else cConc++;
            }
            document.getElementById('dash-demanda-total').innerText = lista.length;
            document.getElementById('dash-demanda-pendente').innerText = cPend;
            document.getElementById('dash-demanda-andamento').innerText = cAnd;
            document.getElementById('dash-demanda-concluido').innerText = cConc;
            // Contadores acima são sempre atualizados; o HTML da tabela só é
            // reconstruído quando a aba está visível (evita trabalho de DOM à toa).
            if (!secaoVisivel('demandas')) return;
            renderPaginated({ tableId: 'tabela-demandas', items: lista, rowFn: criarLinhaTabela, colspan: 6, emptyMsg: 'Nenhuma demanda encontrada.', filterKey: filtroMes + '|' + filtroDia + '|' + filtroStatus + '|' + filtroTexto, rerender: window.renderizarApenasDemandas });
        }

        window.renderizarAbasEspecificas = function() {
            function renderizarAba(prefixo, categoriaAlvo) {
                const mes = document.getElementById(`filtro-mes-${prefixo}`).value;
                const dia = document.getElementById(`filtro-dia-${prefixo}`).value;
                const busca = document.getElementById(`filtro-busca-${prefixo}`).value.toUpperCase();
                const status = document.getElementById(`filtro-status-${prefixo}`).value;
                const listaFinal = [];
                let cPend = 0, cAnd = 0, cConc = 0;
                for (let i = 0, len = demandas.length; i < len; i++) {
                    const d = demandas[i];
                    if (getCategoriaCached(d) !== categoriaAlvo) continue;
                    if (mes && !(d.data||'').startsWith(mes)) continue;
                    if (dia && (d.data||'') !== dia) continue;
                    if (busca && !(d.titulo + ' ' + d.setor + ' ' + d.solicitante).toUpperCase().includes(busca)) continue;
                    if (status && d.status !== status) continue;
                    listaFinal.push(d);
                    if (d.status === 'Pendente') cPend++;
                    else if (d.status === 'Em Andamento') cAnd++;
                    else cConc++;
                }
                // Sempre atualiza os cards (independente de qual aba está visível)
                document.getElementById(`dash-${prefixo}-total`).innerText = listaFinal.length;
                document.getElementById(`dash-${prefixo}-pendente`).innerText = cPend;
                document.getElementById(`dash-${prefixo}-andamento`).innerText = cAnd;
                document.getElementById(`dash-${prefixo}-concluido`).innerText = cConc;
                // Só reconstrói a tabela DOM se a aba estiver visível (performance)
                if (secaoVisivel(prefixo)) {
                    renderPaginated({ tableId: `tabela-${prefixo}`, items: listaFinal, rowFn: (d) => criarLinhaTabelaSimples(d, prefixo), colspan: 6, emptyMsg: 'Nenhum registro.', filterKey: mes + '|' + dia + '|' + busca + '|' + status, rerender: window.renderizarAbasEspecificas });
                }
            }
            // Sempre atualiza os cards das 3 abas (mantém KPIs sincronizados)
            // Só reconstrói o innerHTML da tabela da aba visível (performance)
            renderizarAba('predial', 'PREDIAL');
            renderizarAba('ar', 'AR');
            renderizarAba('limpeza', 'LIMPEZA');
        }

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
