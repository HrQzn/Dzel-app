        async function iniciarCamera() {
            const video = document.getElementById('webcam-video');
            const imgPreview = document.getElementById('vis-preview');
            const btnCapturar = document.getElementById('btn-capturar-cam');
            const btnIniciar = document.getElementById('btn-iniciar-cam');
            try {
                streamGeral = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                video.srcObject = streamGeral; video.style.display = "block"; imgPreview.style.display = "none"; btnCapturar.style.display = "inline-block"; btnIniciar.style.display = "none";
            } catch (err) { alert("Erro ao acessar câmera: " + err.message); }
        }

        function capturarFoto() {
            const video = document.getElementById('webcam-video');
            const canvas = document.getElementById('webcam-canvas');
            const imgPreview = document.getElementById('vis-preview');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d'); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('vis-foto-base64').value = dataUrl; imgPreview.src = dataUrl; pararCamera();
        }

        function pararCamera() {
            const video = document.getElementById('webcam-video');
            const imgPreview = document.getElementById('vis-preview');
            const btnCapturar = document.getElementById('btn-capturar-cam');
            const btnIniciar = document.getElementById('btn-iniciar-cam');
            if(streamGeral) { streamGeral.getTracks().forEach(track => track.stop()); streamGeral = null; }
            video.style.display = "none"; imgPreview.style.display = "block"; btnCapturar.style.display = "none"; btnIniciar.style.display = "inline-block";
        }

        async function exportarExcel(tipo) {
            if (!pode(tipo, 'exportar')) { alert('Você não tem permissão para exportar estes dados.'); return; }
            await ensureXLSX(); // Carrega SheetJS sob demanda (~500KB)
            let data = []; let nomeArquivo = "";
            if (tipo === 'demandas') { data = demandas; nomeArquivo = "Relatorio_Demandas_Geral.xlsx"; }
            else if (tipo === 'predial') { data = demandas.filter(d => getCategoriaDemanda(d) === 'PREDIAL'); nomeArquivo = "Relatorio_Predial.xlsx"; }
            else if (tipo === 'ar') { data = demandas.filter(d => getCategoriaDemanda(d) === 'AR'); nomeArquivo = "Relatorio_ArCondicionado.xlsx"; }
            else if (tipo === 'limpeza') { data = demandas.filter(d => getCategoriaDemanda(d) === 'LIMPEZA'); nomeArquivo = "Relatorio_Limpeza.xlsx"; }
            else if (tipo === 'visitantes') { data = visitantes; nomeArquivo = "Relatorio_Visitantes.xlsx"; }
            else if (tipo === 'frota') { data = frota; nomeArquivo = "Relatorio_Frota.xlsx"; }
            else if (tipo === 'eventos') { data = eventos; nomeArquivo = "Relatorio_Eventos.xlsx"; }
            else if (tipo === 'crachas') { data = crachas; nomeArquivo = "Relatorio_Crachas.xlsx"; }
            else if (tipo === 'ocorrencias') { data = ocorrencias; nomeArquivo = "Relatorio_Ocorrencias.xlsx"; }
            if(data.length === 0) return alert("Não há dados para exportar.");
            if (['demandas', 'predial', 'ar', 'limpeza'].includes(tipo)) {
                data = data.map(d => ({ ID: d.id, NUMERO_OS: d.numero_os, TITULO: d.titulo, SETOR: d.setor, SOLICITANTE: d.solicitante, CONTRATADA: d.contratada, PRIORIDADE: d.prioridade, DATA_ABERTURA: d.data, HORA_ABERTURA: d.hora, STATUS: d.status, DATA_FIM: d.data_fim }));
            } else {
                data = data.map(item => { const novo = {...item}; if(novo.foto) novo.foto = "(Imagem Salva)"; return novo; });
            }
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Dados");
            XLSX.writeFile(wb, nomeArquivo);
            registrarLog('Exportação', tipo, 'Gerou relatório Excel');
        }

        async function salvarDemandaEspecifica(prefixo, contratadaFixa) {
            const idEdicao = document.getElementById(`${prefixo}-id-edit`).value;
            const numero_os = document.getElementById(`${prefixo}-numero-os`).value.toUpperCase();
            const titulo = document.getElementById(`${prefixo}-titulo`).value.toUpperCase();
            const setor = document.getElementById(`${prefixo}-setor`).value.toUpperCase();
            const solicitante = document.getElementById(`${prefixo}-solicitante`).value.toUpperCase();
            const prioridade = document.getElementById(`${prefixo}-prioridade`).value;
            const dataInput = document.getElementById(`${prefixo}-data`).value;
            const horaInput = document.getElementById(`${prefixo}-hora`).value;

            // ── EDIÇÃO (na própria aba, sem ir para a aba geral) ──
            if (idEdicao) {
                const itemAntigo = demandas.find(d => d.id == idEdicao);
                const novoStatus = document.getElementById(`${prefixo}-status-edit`).value;
                const upd = {
                    numero_os, titulo, setor, solicitante, prioridade,
                    data: dataInput, hora: horaInput, status: novoStatus,
                    // a aba não edita contratada — preserva a original
                    contratada: (itemAntigo && itemAntigo.contratada) ? itemAntigo.contratada : contratadaFixa.toUpperCase(),
                    data_inicio_atendimento: (itemAntigo && itemAntigo.data_inicio_atendimento) || null,
                    data_fim: null
                };
                if (!upd.data_inicio_atendimento && (novoStatus === 'Em Andamento' || novoStatus === 'Concluído')) {
                    upd.data_inicio_atendimento = DateUtils.getNowDatabaseISO();
                }
                if (novoStatus === 'Concluído') {
                    const dataFimManual = document.getElementById(`${prefixo}-data-fim`).value;
                    if (dataFimManual) {
                        // Usuário escolheu o horário do encerramento — converter para ISO UTC
                        upd.data_fim = DateUtils.toDatabaseISO(dataFimManual);
                    } else if (itemAntigo && itemAntigo.status === 'Concluído' && itemAntigo.data_fim) {
                        upd.data_fim = itemAntigo.data_fim;
                    } else {
                        upd.data_fim = DateUtils.getNowDatabaseISO();
                    }
                }
                const { error } = await sb.from('demandas').update(upd).eq('id', idEdicao);
                if (error) { alert('Erro: ' + error.message); return; }
                const nomeAba = prefixo === 'predial' ? 'Predial' : prefixo === 'ar' ? 'Ar Condicionado' : 'Limpeza';
                registrarLog('Edição', nomeAba, `Alterou demanda ID: ${idEdicao}`);
                syncSheets('demandas', 'upsert', { ...(itemAntigo || {}), ...upd, id: Number(idEdicao) });
                cancelarEdicaoDemandaEspecifica(prefixo);
                carregarDados();
                return;
            }

            const novaDemanda = { numero_os, titulo, setor, solicitante, contratada: contratadaFixa.toUpperCase(), prioridade, data: dataInput, hora: horaInput, status: 'Pendente', data_fim: null };
            const { data: insertData, error } = await sb.from('demandas').insert(novaDemanda).select().single();
            if(error) alert('Erro: ' + error.message);
            else {
                const nomeAba = prefixo === 'predial' ? 'Predial' : prefixo === 'ar' ? 'Ar Condicionado' : 'Limpeza';
                registrarLog('Criação', nomeAba, `Nova O.S. registrada: ${titulo} (${contratadaFixa})`);
                syncSheets('demandas', 'insert', insertData || novaDemanda);
                alert('Solicitação Registrada!');
                document.getElementById(`form-${prefixo}`).reset();
                const brt = DateUtils.getToInput();
                document.getElementById(`${prefixo}-data`).value = brt.slice(0, 10);
                document.getElementById(`${prefixo}-hora`).value = brt.slice(11, 16);
                carregarDados();
            }
        }

        document.getElementById('form-predial').addEventListener('submit', (e) => { e.preventDefault(); salvarDemandaEspecifica('predial', 'MANUTENÇÃO PREDIAL'); });
        document.getElementById('form-ar').addEventListener('submit', (e) => { e.preventDefault(); salvarDemandaEspecifica('ar', 'AR CONDICIONADO'); });
        document.getElementById('form-limpeza').addEventListener('submit', (e) => { e.preventDefault(); salvarDemandaEspecifica('limpeza', 'LIMPEZA'); });

        // ── Edição de demanda DENTRO da aba técnica (predial/ar/limpeza) ──
        function editarDemandaEspecifica(d, prefixo) {
            document.getElementById(`${prefixo}-id-edit`).value = d.id;
            document.getElementById(`${prefixo}-numero-os`).value = d.numero_os || '';
            document.getElementById(`${prefixo}-titulo`).value = d.titulo;
            document.getElementById(`${prefixo}-setor`).value = d.setor;
            document.getElementById(`${prefixo}-solicitante`).value = d.solicitante;
            document.getElementById(`${prefixo}-prioridade`).value = d.prioridade;
            document.getElementById(`${prefixo}-data`).value = d.data;
            document.getElementById(`${prefixo}-hora`).value = d.hora || '00:00';
            const sel = document.getElementById(`${prefixo}-status-edit`);
            sel.style.display = 'block'; sel.value = d.status;
            // Encerramento: mostrar se Concluído e preencher com data_fim existente
            const wrapEnc = document.getElementById(`${prefixo}-encerramento-wrap`);
            const inputFim = document.getElementById(`${prefixo}-data-fim`);
            if (d.status === 'Concluído') {
                wrapEnc.style.display = 'block';
                if (d.data_fim) {
                    const dtFim = new Date(d.data_fim);
                    dtFim.setMinutes(dtFim.getMinutes() - dtFim.getTimezoneOffset());
                    inputFim.value = dtFim.toISOString().slice(0, 16);
                } else { inputFim.value = ''; }
            } else { wrapEnc.style.display = 'none'; inputFim.value = ''; }
            const tit = document.getElementById(`titulo-form-${prefixo}`);
            if (tit) { if (!tit.dataset.original) tit.dataset.original = tit.innerHTML; tit.innerHTML = '<i class="fas fa-edit"></i> Editando O.S. ' + d.id; }
            const btn = document.getElementById(`btn-submit-${prefixo}`);
            if (btn) {
                if (!btn.dataset.originalText) { btn.dataset.originalText = btn.innerText; btn.dataset.originalBg = btn.style.background; }
                btn.innerText = 'Salvar Alterações';
                btn.style.background = 'linear-gradient(135deg, var(--edit), #d97706)';
            }
            document.getElementById(`btn-cancel-${prefixo}`).style.display = 'inline-flex';
            document.getElementById(prefixo).scrollIntoView({ behavior: 'smooth' });
        }

        // Mostra/esconde o campo de hora de encerramento conforme o status escolhido
        window.toggleEncerramentoEspecifico = function(prefixo) {
            const sel  = document.getElementById(`${prefixo}-status-edit`);
            const wrap = document.getElementById(`${prefixo}-encerramento-wrap`);
            if (wrap) wrap.style.display = (sel.value === 'Concluído' && sel.style.display !== 'none') ? 'block' : 'none';
        }

        // ── Modal "Concluir Demanda" (abas técnicas) — data/hora editável ──
        function abrirModalConcluir(id) {
            const d = demandas.find(i => i.id == id); if (!d) return;
            document.getElementById('concluir-demanda-id').value = id;
            document.getElementById('concluir-info-demanda').innerHTML =
                `<strong>${esc(d.titulo)}</strong>${d.numero_os ? ' — O.S. ' + esc(d.numero_os) : ''}<br><small style="color:var(--text-muted)">Aberta em: ${formatarData(d.data)} ${esc(d.hora)}</small>`;
            document.getElementById('concluir-hora').value = DateUtils.getToInput();
            document.getElementById('modal-concluir-demanda').style.display = 'flex';
        }
        window.fecharModalConcluir = function() {
            document.getElementById('modal-concluir-demanda').style.display = 'none';
        }
        window.confirmarConclusaoDemanda = async function() {
            const id = document.getElementById('concluir-demanda-id').value;
            const horaLocal = document.getElementById('concluir-hora').value;
            if (!horaLocal) { alert('Informe a data e hora do encerramento.'); return; }
            const item = demandas.find(d => d.id == id); if (!item) return;
            const upd = { status: 'Concluído', data_fim: DateUtils.toDatabaseISO(horaLocal) };
            const { error } = await sb.from('demandas').update(upd).eq('id', id);
            if (error) { alert('Erro: ' + error.message); return; }
            registrarLog('Edição', 'Demandas', `Concluiu demanda ID: ${id}`);
            syncSheets('demandas', 'upsert', { ...item, ...upd });
            fecharModalConcluir();
            carregarDados();
        }

        window.cancelarEdicaoDemandaEspecifica = function(prefixo) {
            document.getElementById(`${prefixo}-id-edit`).value = '';
            document.getElementById(`form-${prefixo}`).reset();
            const brt = DateUtils.getToInput();
            document.getElementById(`${prefixo}-data`).value = brt.slice(0, 10);
            document.getElementById(`${prefixo}-hora`).value = brt.slice(11, 16);
            document.getElementById(`${prefixo}-status-edit`).style.display = 'none';
            const wrapEnc = document.getElementById(`${prefixo}-encerramento-wrap`);
            if (wrapEnc) { wrapEnc.style.display = 'none'; document.getElementById(`${prefixo}-data-fim`).value = ''; }
            const tit = document.getElementById(`titulo-form-${prefixo}`);
            if (tit && tit.dataset.original) tit.innerHTML = tit.dataset.original;
            const btn = document.getElementById(`btn-submit-${prefixo}`);
            if (btn && btn.dataset.originalText) { btn.innerText = btn.dataset.originalText; btn.style.background = btn.dataset.originalBg; }
            document.getElementById(`btn-cancel-${prefixo}`).style.display = 'none';
        }

        const formDemanda = document.getElementById('form-demanda');
        formDemanda.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('demanda-id-edit').value;
            const novaDemanda = {
                numero_os: document.getElementById('demanda-numero-os').value.toUpperCase(),
                titulo: document.getElementById('demanda-titulo').value.toUpperCase(),
                setor: document.getElementById('demanda-setor').value.toUpperCase(),
                solicitante: document.getElementById('demanda-solicitante').value.toUpperCase(),
                contratada: document.getElementById('demanda-contratada').value.toUpperCase(),
                prioridade: document.getElementById('demanda-prioridade').value,
                data: document.getElementById('demanda-data').value,
                hora: document.getElementById('demanda-hora').value,
                status: idEdicao ? document.getElementById('demanda-status-edit').value : 'Pendente',
                data_fim: null
            };
            let error = null;
            if(idEdicao) {
                const itemAntigo = demandas.find(d => d.id == idEdicao);
                const dataFimManual = document.getElementById('demanda-data-fim').value;
                // ── Carimbo de 1ª resposta (data_inicio_atendimento) ──
                // Preserva o que já existir; senão grava agora ao sair de Pendente.
                novaDemanda.data_inicio_atendimento = (itemAntigo && itemAntigo.data_inicio_atendimento) || null;
                if (!novaDemanda.data_inicio_atendimento &&
                    (novaDemanda.status === 'Em Andamento' || novaDemanda.status === 'Concluído')) {
                    novaDemanda.data_inicio_atendimento = DateUtils.getNowDatabaseISO();
                }
                if (novaDemanda.status === 'Concluído') {
                    if (dataFimManual) {
                        // Usuário preencheu horário manual — converter para ISO UTC
                        novaDemanda.data_fim = DateUtils.toDatabaseISO(dataFimManual);
                    } else if (!itemAntigo || itemAntigo.status !== 'Concluído') {
                        // Primeira vez concluindo sem horário manual — usar agora
                        novaDemanda.data_fim = DateUtils.getNowDatabaseISO();
                    } else if (itemAntigo && itemAntigo.data_fim) {
                        // Já estava concluído — manter data_fim existente
                        novaDemanda.data_fim = itemAntigo.data_fim;
                    }
                } else if (itemAntigo && itemAntigo.data_fim) {
                    novaDemanda.data_fim = itemAntigo.data_fim;
                }
                registrarLog('Edição', 'Demandas', `Alterou demanda ID: ${idEdicao}`);
                const res = await sb.from('demandas').update(novaDemanda).eq('id', idEdicao); error = res.error;
                if(!error) syncSheets('demandas', 'upsert', novaDemanda);
            } else {
                const res = await sb.from('demandas').insert(novaDemanda); error = res.error;
                if(!error) { registrarLog('Criação', 'Demandas', `Nova O.S. Gerada`); syncSheets('demandas', 'insert', novaDemanda); }
            }
            if(error) alert('Erro: ' + error.message); else { cancelarEdicaoDemanda(); carregarDados(); }
        });

        window.editarDemanda = function(id, origem) {
            const d = demandas.find(item => item.id == id); if (!d) return;
            // Edição vinda das abas técnicas acontece na própria aba — não leva
            // o usuário à aba geral (que exporia demandas de outras áreas)
            if (origem === 'predial' || origem === 'ar' || origem === 'limpeza') { editarDemandaEspecifica(d, origem); return; }
            if(!document.getElementById('demandas').classList.contains('active')) { switchTab('demandas'); }
            document.getElementById('demanda-id-edit').value = d.id;
            document.getElementById('demanda-numero-os').value = d.numero_os || '';
            document.getElementById('demanda-titulo').value = d.titulo;
            document.getElementById('demanda-setor').value = d.setor;
            document.getElementById('demanda-solicitante').value = d.solicitante;
            document.getElementById('demanda-contratada').value = d.contratada || '';
            document.getElementById('demanda-prioridade').value = d.prioridade;
            document.getElementById('demanda-data').value = d.data;
            document.getElementById('demanda-hora').value = d.hora || '00:00';
            document.getElementById('titulo-form-demanda').innerHTML = '<i class="fas fa-edit"></i> Editando O.S. ' + d.id;
            const btn = document.getElementById('btn-submit-demanda'); btn.innerText = "Salvar"; btn.style.background = "linear-gradient(135deg, var(--edit), #d97706)";
            document.getElementById('btn-cancel-demanda').style.display = "block";
            const selStatus = document.getElementById('demanda-status-edit'); selStatus.style.display = "block"; selStatus.value = d.status;
            // Encerramento: mostrar se Concluído e preencher com data_fim existente
            const wrapEnc = document.getElementById('demanda-encerramento-wrap');
            const inputFim = document.getElementById('demanda-data-fim');
            if (d.status === 'Concluído') {
                wrapEnc.style.display = 'block';
                if (d.data_fim) {
                    const dtFim = new Date(d.data_fim);
                    dtFim.setMinutes(dtFim.getMinutes() - dtFim.getTimezoneOffset());
                    inputFim.value = dtFim.toISOString().slice(0, 16);
                } else { inputFim.value = ''; }
            } else { wrapEnc.style.display = 'none'; inputFim.value = ''; }
            document.getElementById('demandas').scrollIntoView({behavior: 'smooth'});
        }

        window.cancelarEdicaoDemanda = function() {
            document.getElementById('demanda-id-edit').value = ""; formDemanda.reset();
            document.getElementById('demanda-data').value = DateUtils.getToInput().slice(0, 10);
            document.getElementById('demanda-hora').value = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            document.getElementById('titulo-form-demanda').innerHTML = '<i class="fas fa-plus-circle"></i> Nova Solicitação (Geral)';
            const btn = document.getElementById('btn-submit-demanda'); btn.innerText = "Registrar Demanda"; btn.style.background = "linear-gradient(135deg, var(--accent), #6366f1)";
            document.getElementById('btn-cancel-demanda').style.display = "none"; document.getElementById('demanda-status-edit').style.display = "none";
            document.getElementById('demanda-encerramento-wrap').style.display = "none";
            document.getElementById('demanda-data-fim').value = "";
        }

        window.toggleEncerramento = function() {
            const status = document.getElementById('demanda-status-edit').value;
            const wrap = document.getElementById('demanda-encerramento-wrap');
            wrap.style.display = (status === 'Concluído') ? 'block' : 'none';
            if (status !== 'Concluído') document.getElementById('demanda-data-fim').value = "";
        }

        /* =====================================================
           IMPRESSÃO DE O.S. — COMPATÍVEL COM MOBILE (Android/iOS)
           Estratégia dupla:
           1. Tenta window.open com URL absoluta para imagens (Android Chrome)
           2. Fallback: overlay full-screen + window.print() (iOS Safari)
        ===================================================== */
        window.abrirModalImpressao = function(id) {
            osPrintAtualId = id;
            document.getElementById('print-input-descricao').value = "";
            document.getElementById('print-input-materiais').value = "";
            document.getElementById('modal-print').style.display = "flex";
        }

        window.fecharModalImpressao = function() {
            document.getElementById('modal-print').style.display = "none";
        }

        window.executarAcaoOS = async function(modo) {
            const desc = document.getElementById('print-input-descricao').value;
            const mat  = document.getElementById('print-input-materiais').value;
            if (modo === 'pdf') {
                await gerarPDFOS(osPrintAtualId, desc, mat);
            } else {
                fecharModalImpressao();
                const pw = window.open('', '_blank');
                const html = gerarHTMLOS(osPrintAtualId, desc, mat);
                if (pw && !pw.closed) {
                    pw.document.open();
                    pw.document.write(html);
                    pw.document.close();
                } else {
                    imprimirViaOverlay(html);
                }
            }
        }

        /* Mantém compatibilidade */
        window.executarImpressao = function() { executarAcaoOS('print'); }

        /* ================================================================
           GERAÇÃO DE PDF — jsPDF puro (sem html2canvas)
           Desenha a O.S. com coordenadas explícitas → layout perfeito
           em qualquer dispositivo (Android, iOS, Desktop).
        ================================================================ */
