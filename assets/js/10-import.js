        const ImportDemanda = (() => {
            // Estado
            let workbook = null;
            let sheetData = [];      // array de objetos {coluna: valor}
            let headers = [];        // nomes das colunas detectadas
            let mapping = {};        // {campoForm: nomeDaColunaPlanilha}
            let preview = [];        // linhas mapeadas {numero_os, titulo, ...}
            let selecionadas = new Set();

            // Campos do formulário e seus aliases (para detecção automática)
            const CAMPOS = {
                numero_os:    { label: 'Nº O.S.',              aliases: ['n da os','n° da os','nº da os','numero da os','número da os','numero os','os','numero','n os','nº os','n.o.s.'] },
                titulo:       { label: 'Descrição do Serviço', aliases: ['demanda','descricao','descrição','descricao do servico','descrição do serviço','servico','serviço','titulo','título','atividade'], required: true },
                setor:        { label: 'Local / Setor',        aliases: ['local','setor','local/setor','local setor','localizacao','localização','lugar'], required: true },
                solicitante:  { label: 'Solicitante',          aliases: ['responsavel','responsável','solicitante','nome do solicitante','solicitado por','requisitante'], required: true },
                contratada:   { label: 'Contratada',           aliases: ['contratada','empresa executante','empresa','executante','especialidade','equipe','tipo','tipo de servico','tipo de serviço','categoria'] },
                prioridade:   { label: 'Prioridade',           aliases: ['prioridade','urgencia','urgência'] },
                data_inicio:  { label: 'Data/Hora Início',     aliases: ['data/hora','data hora','data/hora (inicio)','data/hora (início)','data inicio','data início','data','data abertura','abertura','data e hora','dt inicio','dt início'], required: true },
                status:       { label: 'Status',               aliases: ['status','situacao','situação','estado'] },
                data_fim:     { label: 'Data/Hora Término',    aliases: ['data/hora (termino)','data/hora (término)','data termino','data término','data fim','dt fim','encerramento','conclusao','conclusão','data conclusao','data conclusão'] }
            };

            // ════════════════════════════════════════════════════════════
            // TIPOS DE SERVIÇO — o app categoriza a demanda pelo campo
            // "contratada" (+ palavras-chave do título/setor), então o valor
            // canônico escolhido aqui é gravado em contratada e a demanda
            // aparece automaticamente na aba correta (Predial/Ar/Limpeza).
            // ════════════════════════════════════════════════════════════
            const TIPOS_SERVICO = ['MANUTENÇÃO PREDIAL', 'AR CONDICIONADO', 'LIMPEZA', 'TELEFONIA'];
            const TIPO_CORES = {
                'MANUTENÇÃO PREDIAL': '#ef4444',
                'AR CONDICIONADO':    '#3b82f6',
                'LIMPEZA':            '#10b981',
                'TELEFONIA':          '#8b5cf6'
            };

            // Detecta o tipo de serviço da linha usando os mesmos critérios de
            // getCategoriaDemanda() — contratada primeiro, depois título/setor.
            function detectarTipoServico(p) {
                const c = p.contratada || '';
                const t = (p.titulo + ' ' + p.setor);
                const tem = (base, termos) => termos.some(k => base.includes(k));
                if (tem(c, ['AR CONDICIONADO','AR-COND','REFRIGERA']) || tem(t, ['AR CONDICIONADO','AR-COND','REFRIGERA'])) return 'AR CONDICIONADO';
                if (tem(c, ['PREDIAL','MANUTENCAO','MANUTENÇÃO']) || tem(t, ['PREDIAL','ELÉTRICA','ELETRICA','PINTURA','PORTA','FECHADURA','HIDRÁULIC','HIDRAULIC'])) return 'MANUTENÇÃO PREDIAL';
                if (tem(c, ['LIMPEZA','COPA']) || tem(t, ['LIMPEZA','COPA','CAFÉ','CAFE','ÁGUA','AGUA'])) return 'LIMPEZA';
                if (tem(c, ['TELEFONIA','RAMAL']) || tem(t, ['TELEFONIA','RAMAL','TELEFONE'])) return 'TELEFONIA';
                return '';
            }

            // Normalização para comparar nomes de colunas
            const normalizar = (s) => String(s||'').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                .replace(/[^a-z0-9 ]/g,' ')
                .replace(/\s+/g,' ').trim();

            // Detecta automaticamente qual coluna da planilha corresponde a cada campo
            function autoDetectarMapeamento() {
                const map = {};
                const headersNorm = headers.map(h => ({ original: h, norm: normalizar(h) }));
                for (const [campo, def] of Object.entries(CAMPOS)) {
                    let achou = headersNorm.find(h => h.norm === normalizar(campo));
                    if (!achou) {
                        for (const alias of def.aliases) {
                            const aliasNorm = normalizar(alias);
                            achou = headersNorm.find(h => h.norm === aliasNorm);
                            if (achou) break;
                        }
                    }
                    if (!achou) {
                        for (const alias of def.aliases) {
                            const aliasNorm = normalizar(alias);
                            achou = headersNorm.find(h => h.norm.includes(aliasNorm) || aliasNorm.includes(h.norm));
                            if (achou) break;
                        }
                    }
                    if (achou) map[campo] = achou.original;
                }
                return map;
            }

            // Converte data Excel ou string para {data:'YYYY-MM-DD', hora:'HH:MM', iso}.
            // O iso segue a convenção do app (DateUtils.toDatabaseISO): a hora da
            // planilha é tratada como hora local BRT → UTC somando 3h, independente
            // do fuso da máquina que estiver importando.
            function parseDataHora(valor) {
                if (valor === null || valor === undefined || valor === '') return null;
                let dt = null, utc = false;
                if (typeof valor === 'number') {
                    // Serial do Excel não tem fuso — converter via UTC evita deslocar
                    // a data/hora; arredonda ao minuto p/ eliminar erro de ponto flutuante
                    utc = true;
                    dt = new Date(Date.UTC(1899, 11, 30) + Math.round(valor * 1440) * 60000);
                } else if (valor instanceof Date) {
                    dt = valor;
                } else {
                    const s = String(valor).trim();
                    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
                    if (m) {
                        let ano = parseInt(m[3]); if (ano < 100) ano += 2000;
                        const mes = parseInt(m[2]) - 1;
                        const dia = parseInt(m[1]);
                        const hh = m[4] ? parseInt(m[4]) : 0;
                        const mm = m[5] ? parseInt(m[5]) : 0;
                        dt = new Date(ano, mes, dia, hh, mm);
                    } else {
                        m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
                        if (m) {
                            dt = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]),
                                m[4]?parseInt(m[4]):0, m[5]?parseInt(m[5]):0);
                        } else {
                            dt = new Date(s);
                        }
                    }
                }
                if (!dt || isNaN(dt.getTime())) return null;
                const ano = utc ? dt.getUTCFullYear() : dt.getFullYear();
                const mes = (utc ? dt.getUTCMonth() : dt.getMonth()) + 1;
                const dia = utc ? dt.getUTCDate()  : dt.getDate();
                const hh  = utc ? dt.getUTCHours() : dt.getHours();
                const mm  = utc ? dt.getUTCMinutes() : dt.getMinutes();
                const p2 = n => String(n).padStart(2, '0');
                return {
                    data: `${ano}-${p2(mes)}-${p2(dia)}`,
                    hora: `${p2(hh)}:${p2(mm)}`,
                    iso: new Date(Date.UTC(ano, mes - 1, dia, hh + 3, mm, 0)).toISOString()
                };
            }

            // Mapeia status de texto livre → valor do sistema
            function mapearStatus(valor) {
                const s = normalizar(valor);
                if (!s) return 'Pendente';
                if (s === 'ok' || s.includes('conclu') || s.includes('finaliz') || s.includes('encerr')) return 'Concluído';
                if (s.includes('andamento') || s.includes('execu') || s.includes('aguardando')) return 'Em Andamento';
                return 'Pendente';
            }

            // Mapeia prioridade de texto livre → valor do sistema
            function mapearPrioridade(valor) {
                const s = normalizar(valor);
                if (s.includes('alta') || s.includes('urgent')) return 'Alta';
                if (s.includes('media') || s.includes('médio')) return 'Média';
                return 'Baixa';
            }

            // Constrói a pré-visualização aplicando o mapeamento
            function construirPreview() {
                // O.S. já cadastradas no sistema — para avisar sobre possível duplicidade
                const osExistentes = new Set(
                    (typeof demandas !== 'undefined' ? demandas : [])
                        .filter(d => d.numero_os)
                        .map(d => String(d.numero_os).trim().toUpperCase())
                );
                const osNaPlanilha = new Set();
                preview = sheetData.map((linha, idx) => {
                    const get = (campo) => mapping[campo] ? linha[mapping[campo]] : '';
                    const dtIni = parseDataHora(get('data_inicio'));
                    const dtFim = parseDataHora(get('data_fim'));
                    const titulo = String(get('titulo')||'').trim();
                    const setor = String(get('setor')||'').trim();
                    const solicitante = String(get('solicitante')||'').trim();
                    const numero_os = String(get('numero_os')||'').trim().toUpperCase();
                    const erros = [];
                    const avisos = [];
                    if (!titulo) erros.push('Descrição vazia');
                    if (!setor) erros.push('Local vazio');
                    if (!solicitante) erros.push('Solicitante vazio');
                    if (!dtIni) erros.push('Data inválida');
                    if (numero_os) {
                        if (osExistentes.has(numero_os)) avisos.push('O.S. já existe no sistema');
                        else if (osNaPlanilha.has(numero_os)) avisos.push('O.S. repetida na planilha');
                        osNaPlanilha.add(numero_os);
                    }
                    const item = {
                        _linha: idx+2,
                        _erros: erros,
                        _avisos: avisos,
                        numero_os,
                        titulo: titulo.toUpperCase(),
                        setor: setor.toUpperCase(),
                        solicitante: solicitante.toUpperCase(),
                        contratada: String(get('contratada')||'').trim().toUpperCase(),
                        prioridade: mapping.prioridade ? mapearPrioridade(get('prioridade')) : 'Baixa',
                        data: dtIni ? dtIni.data : '',
                        hora: dtIni ? dtIni.hora : '',
                        status: mapping.status ? mapearStatus(get('status')) : 'Pendente',
                        data_fim: dtFim ? dtFim.iso : null
                    };
                    item._categoria = detectarTipoServico(item);
                    return item;
                });
                selecionadas = new Set(preview.filter(p => p._erros.length === 0).map(p => p._linha));
            }

            // ─────────── INTERFACE ───────────
            function abrir() {
                // Importação em massa é exclusiva de administradores
                if (!currentUserData || currentUserData.isAdmin !== true) {
                    alert('Apenas administradores podem importar planilhas.');
                    return;
                }
                document.getElementById('modal-import-demanda').style.display = 'flex';
                irParaEtapa('upload');
            }
            function fechar() {
                document.getElementById('modal-import-demanda').style.display = 'none';
                workbook = null; sheetData = []; headers = []; mapping = {}; preview = []; selecionadas = new Set();
                document.getElementById('import-file-input').value = '';
                document.getElementById('import-file-name').textContent = '';
                const catDefault = document.getElementById('import-cat-default');
                if (catDefault) catDefault.value = '';
            }
            function irParaEtapa(etapa) {
                ['upload','sheet','mapping','preview','progress','done'].forEach(e => {
                    const el = document.getElementById('import-step-'+e);
                    if (el) el.style.display = e === etapa ? 'block' : 'none';
                });
                const btnNext = document.getElementById('btn-import-next');
                const btnBack = document.getElementById('btn-import-back');
                const btnCancel = document.getElementById('btn-import-cancel');
                btnBack.style.display = ['mapping','preview'].includes(etapa) ? 'block' : 'none';
                btnNext.style.display = etapa === 'done' || etapa === 'progress' ? 'none' : 'block';
                // Durante a gravação não dá para cancelar (evita fechar no meio do lote)
                btnCancel.style.display = etapa === 'progress' ? 'none' : 'block';
                btnCancel.textContent = etapa === 'done' ? 'Fechar' : 'Cancelar';
                if (etapa === 'upload') { btnNext.disabled = true; btnNext.textContent = 'Próximo'; }
                if (etapa === 'sheet')   { btnNext.disabled = false; btnNext.textContent = 'Próximo'; }
                if (etapa === 'mapping') { btnNext.disabled = false; btnNext.textContent = 'Visualizar'; }
                if (etapa === 'preview') { btnNext.disabled = selecionadas.size === 0; btnNext.textContent = `Importar ${selecionadas.size} registro(s)`; }
            }

            async function processarArquivo(file) {
                document.getElementById('import-file-name').innerHTML = `<i class="fas fa-file-excel" style="color:var(--excel)"></i> ${esc(file.name)}`;
                await ensureXLSX();
                const buf = await file.arrayBuffer();
                workbook = XLSX.read(buf, { type:'array', cellDates:true });
                if (workbook.SheetNames.length > 1) {
                    const sel = document.getElementById('import-sheet-select');
                    sel.innerHTML = workbook.SheetNames.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
                    irParaEtapa('sheet');
                } else {
                    carregarSheet(workbook.SheetNames[0]);
                }
            }

            function carregarSheet(nomeSheet) {
                const ws = workbook.Sheets[nomeSheet];
                const matriz = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', blankrows:false });
                if (!matriz.length) { alert('A planilha está vazia.'); return; }
                let idxHeader = 0;
                for (let i = 0; i < Math.min(matriz.length, 10); i++) {
                    const txts = matriz[i].filter(c => typeof c === 'string' && c.trim().length > 0);
                    if (txts.length >= 3) { idxHeader = i; break; }
                }
                // Nomes de coluna únicos — colunas repetidas ganham sufixo (2), (3)…
                // para não sobrescreverem umas às outras no mapeamento
                const vistos = {};
                headers = matriz[idxHeader].map((h, i) => {
                    let nome = String(h||'').trim() || `Coluna ${i+1}`;
                    if (vistos[nome]) { vistos[nome]++; nome = `${nome} (${vistos[nome]})`; }
                    else vistos[nome] = 1;
                    return nome;
                });
                sheetData = matriz.slice(idxHeader+1)
                    .filter(linha => linha.some(c => c !== '' && c !== null && c !== undefined))
                    .map(linha => {
                        const obj = {};
                        headers.forEach((h, i) => { obj[h] = linha[i] !== undefined ? linha[i] : ''; });
                        return obj;
                    });
                if (!sheetData.length) { alert('Não há linhas de dados na planilha.'); return; }
                mapping = autoDetectarMapeamento();
                renderMapeamento();
                irParaEtapa('mapping');
            }

            function renderMapeamento() {
                const container = document.getElementById('import-mapping-grid');
                container.innerHTML = Object.entries(CAMPOS).map(([campo, def]) => {
                    const sel = mapping[campo] || '';
                    const req = def.required ? '<span style="color:var(--danger)">*</span>' : '';
                    const opcoes = ['<option value="">— Não importar —</option>']
                        .concat(headers.map(h => `<option value="${esc(h)}" ${h === sel ? 'selected' : ''}>${esc(h)}</option>`))
                        .join('');
                    return `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                        <div style="flex:1;font-size:0.85rem;font-weight:600;color:var(--text-secondary)">${def.label} ${req}</div>
                        <div style="flex:1.2"><select data-campo="${campo}" class="import-map-select" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem">
                            ${opcoes}
                        </select></div>
                    </div>`;
                }).join('');
                container.querySelectorAll('.import-map-select').forEach(sel => {
                    sel.addEventListener('change', e => {
                        const c = e.target.dataset.campo;
                        if (e.target.value) mapping[c] = e.target.value;
                        else delete mapping[c];
                    });
                });
            }

            // Resumo com contagem por tipo de serviço (linhas válidas)
            function atualizarResumoPreview() {
                const validas = preview.filter(p => p._erros.length === 0);
                const invalidas = preview.length - validas.length;
                const avisos = validas.filter(p => p._avisos.length > 0).length;
                const cont = {};
                validas.forEach(p => { const k = p._categoria || 'SEM CATEGORIA'; cont[k] = (cont[k]||0) + 1; });
                const ordem = TIPOS_SERVICO.concat(['SEM CATEGORIA']);
                const chips = ordem.filter(k => cont[k]).map(k => {
                    const cor = TIPO_CORES[k] || '#64748b';
                    return `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:10px;background:${cor}18;color:${cor};font-weight:700;font-size:0.72rem;border:1px solid ${cor}40">${esc(k)}: ${cont[k]}</span>`;
                }).join('');
                document.getElementById('import-preview-summary').innerHTML =
                    `<strong>${preview.length}</strong> linha(s) lida(s) — <span style="color:var(--success)"><strong>${validas.length}</strong> válida(s)</span>` +
                    (invalidas ? ` — <span style="color:var(--danger)"><strong>${invalidas}</strong> com erro</span>` : '') +
                    (avisos ? ` — <span style="color:var(--warning)"><strong>${avisos}</strong> com aviso</span>` : '') +
                    `<br><span style="font-size:0.75rem;color:var(--text-muted)">Por tipo de serviço:</span><br>${chips || '<small style="color:var(--text-muted)">—</small>'}`;
            }

            function atualizarBotaoImportar() {
                const btn = document.getElementById('btn-import-next');
                btn.disabled = selecionadas.size === 0;
                btn.textContent = `Importar ${selecionadas.size} registro(s)`;
            }

            // Desenha a tabela de pré-visualização a partir do estado atual
            // (sem reconstruir o preview — preserva categorias ajustadas à mão)
            function renderPreviewTable() {
                atualizarResumoPreview();
                const optsCat = (atual) => ['<option value="">Outros (manter planilha)</option>']
                    .concat(TIPOS_SERVICO.map(t => `<option value="${esc(t)}" ${t === atual ? 'selected' : ''}>${esc(t)}</option>`))
                    .join('');
                const tbody = preview.map(p => {
                    const checked = selecionadas.has(p._linha) ? 'checked' : '';
                    const cls = p._erros.length ? 'style="background:#fef2f2"' : (p._avisos.length ? 'style="background:#fffbeb"' : '');
                    const erroTxt = p._erros.length ? `<small style="color:var(--danger)">⚠ ${esc(p._erros.join(', '))}</small>` : '';
                    const avisoTxt = (!p._erros.length && p._avisos.length) ? `<small style="color:#b45309">⚠ ${esc(p._avisos.join(', '))}</small>` : '';
                    const catSel = p._erros.length
                        ? '<small style="color:var(--text-muted)">—</small>'
                        : `<select class="import-cat-select" data-linha="${p._linha}" style="width:100%;min-width:150px;padding:4px;border:1px solid var(--border);border-radius:6px;font-size:0.74rem">${optsCat(p._categoria)}</select>`;
                    return `<tr ${cls}>
                        <td><input type="checkbox" data-linha="${p._linha}" ${checked} ${p._erros.length?'disabled':''}></td>
                        <td>${esc(p.numero_os)||'—'}</td>
                        <td title="${esc(p.titulo)}">${esc(p.titulo.slice(0,40))}${p.titulo.length>40?'…':''} ${erroTxt}${avisoTxt}</td>
                        <td>${esc(p.setor)}</td>
                        <td>${esc(p.solicitante)}</td>
                        <td>${esc(p.contratada)||'—'}</td>
                        <td>${catSel}</td>
                        <td>${esc(p.data)||'—'} ${esc(p.hora)||''}</td>
                        <td>${esc(p.status)}</td>
                    </tr>`;
                }).join('');
                document.getElementById('import-preview-table').innerHTML = `
                    <div style="max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px">
                    <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
                        <thead style="position:sticky;top:0;background:#f8fafc;z-index:1">
                            <tr><th style="padding:8px"><input type="checkbox" id="chk-import-all" checked></th>
                            <th style="padding:8px;text-align:left">Nº O.S.</th>
                            <th style="padding:8px;text-align:left">Descrição</th>
                            <th style="padding:8px;text-align:left">Local</th>
                            <th style="padding:8px;text-align:left">Solicitante</th>
                            <th style="padding:8px;text-align:left">Contratada</th>
                            <th style="padding:8px;text-align:left">Tipo de Serviço</th>
                            <th style="padding:8px;text-align:left">Data/Hora</th>
                            <th style="padding:8px;text-align:left">Status</th></tr>
                        </thead>
                        <tbody>${tbody}</tbody>
                    </table></div>`;
                document.querySelectorAll('#import-preview-table input[type="checkbox"][data-linha]').forEach(chk => {
                    chk.addEventListener('change', e => {
                        const linha = parseInt(e.target.dataset.linha);
                        if (e.target.checked) selecionadas.add(linha); else selecionadas.delete(linha);
                        atualizarBotaoImportar();
                    });
                });
                document.getElementById('chk-import-all').addEventListener('change', e => {
                    const marcar = e.target.checked;
                    document.querySelectorAll('#import-preview-table input[type="checkbox"][data-linha]').forEach(chk => {
                        if (chk.disabled) return;
                        chk.checked = marcar;
                        const linha = parseInt(chk.dataset.linha);
                        if (marcar) selecionadas.add(linha); else selecionadas.delete(linha);
                    });
                    atualizarBotaoImportar();
                });
                // Ajuste manual do tipo de serviço por linha
                document.querySelectorAll('#import-preview-table .import-cat-select').forEach(sel => {
                    sel.addEventListener('change', e => {
                        const linha = parseInt(e.target.dataset.linha);
                        const item = preview.find(p => p._linha === linha);
                        if (item) item._categoria = e.target.value;
                        atualizarResumoPreview();
                    });
                });
            }

            function renderPreview() {
                const obrigatorios = ['titulo','setor','solicitante','data_inicio'];
                const faltando = obrigatorios.filter(c => !mapping[c]);
                if (faltando.length) {
                    alert('Mapeie os campos obrigatórios:\n• ' + faltando.map(c => CAMPOS[c].label).join('\n• '));
                    return false;
                }
                construirPreview();
                renderPreviewTable();
                return true;
            }

            // Aplica um tipo de serviço a todas as linhas ainda sem categoria
            function aplicarCategoriaPadrao(tipo) {
                if (!tipo) return;
                preview.forEach(p => { if (!p._erros.length && !p._categoria) p._categoria = tipo; });
                renderPreviewTable();
            }

            async function executarImport() {
                irParaEtapa('progress');
                const linhasParaImportar = preview.filter(p => selecionadas.has(p._linha));
                const total = linhasParaImportar.length;
                const LOTE = 50;
                let inseridos = 0, falhas = 0;
                const erros = [];
                const catCount = {};
                const barra = document.getElementById('import-progress');
                const txt = document.getElementById('import-progress-text');
                barra.max = total; barra.value = 0;

                for (let i = 0; i < total; i += LOTE) {
                    const lote = linhasParaImportar.slice(i, i + LOTE).map(p => ({
                        numero_os: p.numero_os || null,
                        titulo: p.titulo,
                        setor: p.setor,
                        solicitante: p.solicitante,
                        // Tipo de serviço escolhido vira a contratada canônica —
                        // é assim que a demanda entra na aba/dashboard corretos
                        contratada: p._categoria || p.contratada || null,
                        prioridade: p.prioridade,
                        data: p.data,
                        hora: p.hora,
                        status: p.status,
                        data_fim: p.data_fim
                    }));
                    try {
                        const { data, error } = await sb.from('demandas').insert(lote).select();
                        if (error) {
                            falhas += lote.length;
                            erros.push(`Lote ${i/LOTE+1}: ${error.message}`);
                        } else {
                            inseridos += data.length;
                            data.forEach(d => {
                                const k = TIPOS_SERVICO.includes(d.contratada) ? d.contratada : 'OUTROS';
                                catCount[k] = (catCount[k] || 0) + 1;
                                try { syncSheets('demandas', 'insert', d); } catch(e) {}
                            });
                        }
                    } catch (e) {
                        falhas += lote.length;
                        erros.push(`Lote ${i/LOTE+1}: ${e.message}`);
                    }
                    barra.value = Math.min(i + LOTE, total);
                    txt.textContent = `${barra.value} de ${total} processados…`;
                }
                try { await registrarLog('Importação', 'Demandas', `Importou ${inseridos} demanda(s) via planilha`); } catch(e) {}
                const ordem = TIPOS_SERVICO.concat(['OUTROS']);
                const linhasCat = ordem.filter(k => catCount[k]).map(k => {
                    const cor = TIPO_CORES[k] || '#64748b';
                    return `<span style="display:inline-block;margin:3px 4px;padding:3px 10px;border-radius:10px;background:${cor}18;color:${cor};font-weight:700;font-size:0.78rem;border:1px solid ${cor}40">${esc(k)}: ${catCount[k]}</span>`;
                }).join('');
                document.getElementById('import-done-summary').innerHTML = `
                    <div style="text-align:center;padding:20px 0">
                        <i class="fas fa-${falhas===0?'check-circle':'exclamation-triangle'}" style="font-size:3rem;color:var(--${falhas===0?'success':'warning'});"></i>
                        <h4 style="margin-top:12px;color:var(--text-primary)">Importação concluída</h4>
                        <p style="margin-top:8px"><strong style="color:var(--success);font-size:1.4rem">${inseridos}</strong> registro(s) importado(s) com sucesso</p>
                        ${linhasCat?`<p style="margin-top:10px;font-size:0.8rem;color:var(--text-muted)">Distribuição por tipo de serviço:</p><div style="margin-top:4px">${linhasCat}</div>`:''}
                        ${falhas?`<p style="color:var(--danger);margin-top:10px"><strong>${falhas}</strong> falha(s)</p><pre style="text-align:left;background:#fef2f2;padding:10px;border-radius:6px;font-size:0.75rem;max-height:120px;overflow:auto">${esc(erros.join('\n'))}</pre>`:''}
                    </div>`;
                irParaEtapa('done');
                if (typeof carregarDados === 'function') carregarDados();
            }

            // ─────────── HANDLERS PÚBLICOS ───────────
            return {
                init() {
                    document.getElementById('import-file-input').addEventListener('change', async e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        try {
                            await processarArquivo(f);
                            document.getElementById('btn-import-next').disabled = false;
                        } catch (err) {
                            alert('Erro ao ler arquivo: ' + err.message);
                        }
                    });
                    document.getElementById('btn-import-next').addEventListener('click', () => {
                        const upload = document.getElementById('import-step-upload').style.display !== 'none';
                        const sheet = document.getElementById('import-step-sheet').style.display !== 'none';
                        const mapStep = document.getElementById('import-step-mapping').style.display !== 'none';
                        const prev = document.getElementById('import-step-preview').style.display !== 'none';
                        if (upload) {
                            if (workbook) {
                                if (workbook.SheetNames.length > 1) irParaEtapa('sheet');
                                else { carregarSheet(workbook.SheetNames[0]); }
                            }
                        } else if (sheet) {
                            carregarSheet(document.getElementById('import-sheet-select').value);
                        } else if (mapStep) {
                            if (renderPreview()) irParaEtapa('preview');
                        } else if (prev) {
                            executarImport();
                        }
                    });
                    document.getElementById('btn-import-back').addEventListener('click', () => {
                        const mapStep = document.getElementById('import-step-mapping').style.display !== 'none';
                        const prev = document.getElementById('import-step-preview').style.display !== 'none';
                        if (prev) irParaEtapa('mapping');
                        else if (mapStep) {
                            if (workbook && workbook.SheetNames.length > 1) irParaEtapa('sheet');
                            else irParaEtapa('upload');
                        }
                    });
                    // Aplicar tipo de serviço às linhas sem categoria detectada
                    const catDefault = document.getElementById('import-cat-default');
                    if (catDefault) {
                        catDefault.addEventListener('change', e => {
                            aplicarCategoriaPadrao(e.target.value);
                            e.target.value = '';
                        });
                    }
                },
                abrir, fechar
            };
        })();

        window.abrirModalImport = () => ImportDemanda.abrir();
        window.fecharModalImport = () => ImportDemanda.fechar();
        // Inicializa quando o DOM estiver pronto
        ImportDemanda.init();
