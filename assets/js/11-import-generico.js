        // ════════════════════════════════════════════════════════════════
        // IMPORTAÇÃO GENÉRICA — Recepção, Garagem, Eventos e Crachás
        // Mesma mecânica da importação de Demandas (10-import.js): upload →
        // seleção de aba → mapeamento de colunas → pré-visualização → gravação.
        // Diferença proposital: NENHUM campo é obrigatório aqui — o que não
        // vier preenchido na planilha fica em branco ou recebe um valor
        // padrão, e nenhuma linha é bloqueada por falta de dado.
        // ════════════════════════════════════════════════════════════════
        const ImportGenerico = (() => {
            let workbook = null;
            let sheetData = [];
            let headers = [];
            let mapping = {};
            let preview = [];
            let selecionadas = new Set();
            let cfg = null;

            // ─────────── CONFIGURAÇÃO POR ABA ───────────
            const CONFIGS = {
                visitantes: {
                    tabela: 'visitantes',
                    titulo: 'Recepção de Visitantes',
                    secaoLog: 'Visitantes',
                    campos: {
                        nome:        { label: 'Nome Completo',           tipo: 'texto', aliases: ['nome','visitante','nome completo','nome do visitante'] },
                        doc:         { label: 'Documento (RG/CPF)',      tipo: 'texto', aliases: ['documento','doc','rg','cpf','rg cpf','identidade'] },
                        empresa:     { label: 'Empresa',                 tipo: 'texto', aliases: ['empresa','organizacao','organização'] },
                        contato:     { label: 'E-mail / Telefone',       tipo: 'texto', aliases: ['contato','telefone','celular','email','e-mail'] },
                        responsavel: { label: 'Responsável (Anfitrião)', tipo: 'texto', aliases: ['responsavel','responsável','anfitriao','anfitrião','visitado','pessoa responsavel'] },
                        finalidade:  { label: 'Finalidade da Visita',    tipo: 'texto', aliases: ['finalidade','motivo','assunto','objetivo'] },
                        entrada:     { label: 'Data/Hora Entrada',       tipo: 'datahora', padrao: 'agora', aliases: ['entrada','data entrada','data/hora entrada','data','hora entrada','data e hora'] },
                        saida:       { label: 'Data/Hora Saída',         tipo: 'datahora', aliases: ['saida','saída','data saida','data/hora saida','data de saida'] }
                    },
                    montarLinha(v) {
                        return {
                            foto: null,
                            nome: v.nome, doc: v.doc, empresa: v.empresa, contato: v.contato,
                            responsavel: v.responsavel, finalidade: v.finalidade,
                            entrada: v.entrada || DateUtils.getNowDatabaseISO(),
                            saida: v.saida || null,
                            status: v.saida ? 'Saiu' : 'Ativo'
                        };
                    },
                    colunas: [
                        { key: 'nome', label: 'Visitante' },
                        { key: 'doc', label: 'Documento' },
                        { key: 'empresa', label: 'Empresa' },
                        { key: 'responsavel', label: 'Responsável' },
                        { key: 'entrada', label: 'Entrada', formatar: 'datahora' },
                        { key: 'status', label: 'Status' }
                    ]
                },
                frota: {
                    tabela: 'frota',
                    titulo: 'Controle de Garagem',
                    secaoLog: 'Garagem',
                    campos: {
                        tipo:         { label: 'Tipo (Servidor/Visitante)', tipo: 'opcao', padrao: 'servidor', aliases: ['tipo','tipo de acesso','categoria'],
                                        mapear: (n) => n.includes('visit') ? 'visitante' : (n.includes('servidor') ? 'servidor' : '') },
                        carro:        { label: 'Veículo (Modelo/Placa)',    tipo: 'texto', aliases: ['veiculo','veículo','carro','modelo placa','placa','modelo'] },
                        motorista:    { label: 'Condutor',                  tipo: 'texto', aliases: ['motorista','condutor','nome do condutor','nome'] },
                        setor:        { label: 'Setor',                     tipo: 'texto', aliases: ['setor','local','empresa/setor','empresa'] },
                        contato:      { label: 'Ramal / Contato',           tipo: 'texto', aliases: ['contato','ramal'] },
                        destino:      { label: 'Obs / Destino',             tipo: 'texto', aliases: ['destino','obs','observacao','observação'] },
                        hora_inicial: { label: 'Hora Entrada',              tipo: 'datahora', padrao: 'agora', aliases: ['entrada','hora entrada','data/hora entrada','data entrada'] },
                        hora_final:   { label: 'Hora Saída',                tipo: 'datahora', aliases: ['saida','saída','hora saida','data/hora saida'] }
                    },
                    montarLinha(v) {
                        return {
                            tipo: v.tipo || 'servidor', carro: v.carro, motorista: v.motorista, setor: v.setor,
                            contato: v.contato, destino: v.destino,
                            hora_inicial: v.hora_inicial || DateUtils.getNowDatabaseISO(),
                            hora_final: v.hora_final || null,
                            status: v.hora_final ? 'Fechado' : 'Aberto'
                        };
                    },
                    colunas: [
                        { key: 'motorista', label: 'Condutor' },
                        { key: 'carro', label: 'Veículo' },
                        { key: 'setor', label: 'Setor' },
                        { key: 'tipo', label: 'Tipo' },
                        { key: 'hora_inicial', label: 'Entrada', formatar: 'datahora' },
                        { key: 'status', label: 'Status' }
                    ]
                },
                eventos: {
                    tabela: 'eventos',
                    titulo: 'Gestão de Eventos',
                    secaoLog: 'Eventos',
                    campos: {
                        tipo:        { label: 'Tipo (Interno/Externo)', tipo: 'opcao', padrao: 'Interno', aliases: ['tipo','tipo de evento'],
                                       mapear: (n) => n.includes('extern') ? 'Externo' : (n.includes('intern') ? 'Interno' : '') },
                        nome:        { label: 'Nome do Evento',         tipo: 'texto', aliases: ['nome','evento','nome do evento','titulo','título','reuniao','reunião'] },
                        organizador: { label: 'Organizador',            tipo: 'texto', aliases: ['organizador','responsavel','responsável'] },
                        data:        { label: 'Data do Evento',         tipo: 'data', padrao: 'hoje', aliases: ['data','data do evento'] },
                        publico:     { label: 'Público Estimado',       tipo: 'numero', padrao: 0, aliases: ['publico','público','qtd pessoas','participantes','quantidade'] },
                        local:       { label: 'Local',                  tipo: 'texto', aliases: ['local','sala','auditorio','auditório'] },
                        coffee:      { label: 'Coffee Break',           tipo: 'booleano', padrao: false, aliases: ['coffee','coffee break'] },
                        obs:         { label: 'Observações',            tipo: 'texto', aliases: ['obs','observacoes','observações','solicitacoes','solicitações'] }
                    },
                    montarLinha(v) {
                        return { tipo: v.tipo || 'Interno', nome: v.nome, organizador: v.organizador, data: v.data, publico: v.publico || 0, local: v.local, coffee: !!v.coffee, obs: v.obs };
                    },
                    colunas: [
                        { key: 'nome', label: 'Evento' },
                        { key: 'tipo', label: 'Tipo' },
                        { key: 'organizador', label: 'Organizador' },
                        { key: 'local', label: 'Local' },
                        { key: 'data', label: 'Data', formatar: 'data' },
                        { key: 'publico', label: 'Público' }
                    ]
                },
                crachas: {
                    tabela: 'crachas',
                    titulo: 'Gestão de Crachás',
                    secaoLog: 'Crachás',
                    campos: {
                        nome:             { label: 'Nome do Colaborador', tipo: 'texto', aliases: ['nome','colaborador','nome do colaborador'] },
                        doc_identidade:   { label: 'RG ou CPF',           tipo: 'texto', aliases: ['doc','documento','rg','cpf','identidade','rg ou cpf'] },
                        setor:            { label: 'Setor',               tipo: 'texto', aliases: ['setor'] },
                        cargo:            { label: 'Cargo',               tipo: 'texto', aliases: ['cargo','funcao','função'] },
                        sala:             { label: 'Sala',                tipo: 'texto', aliases: ['sala'] },
                        ramal:            { label: 'Ramal',               tipo: 'texto', aliases: ['ramal'] },
                        tipo:             { label: 'Tipo de Crachá',      tipo: 'opcao', padrao: 'Definitivo', aliases: ['tipo','tipo de cracha','tipo de crachá'],
                                            mapear: (n) => n.includes('provis') ? 'Provisório' : (n.includes('cordao') || n.includes('cordão') || n.includes('presilha')) ? 'Cordão' : (n.includes('definitiv') ? 'Definitivo' : '') },
                        status:           { label: 'Status',              tipo: 'opcao', padrao: 'Solicitado', aliases: ['status','situacao','situação'],
                                            mapear: (n) => n.includes('entreg') ? 'Entregue' : ((n.includes('confeccion') || n.includes('pronto')) ? 'Confeccionado' : (n.includes('solicit') ? 'Solicitado' : '')) },
                        data_solicitacao: { label: 'Data Solicitação',    tipo: 'data', padrao: 'hoje', aliases: ['data','data solicitacao','data solicitação','data de solicitacao'] }
                    },
                    montarLinha(v) {
                        return {
                            nome: v.nome, doc_identidade: v.doc_identidade, setor: v.setor, cargo: v.cargo, sala: v.sala, ramal: v.ramal,
                            tipo: v.tipo || 'Definitivo', status: v.status || 'Solicitado',
                            data_solicitacao: v.data_solicitacao,
                            data_entrega: v.status === 'Entregue' ? new Date().toISOString() : null
                        };
                    },
                    colunas: [
                        { key: 'nome', label: 'Colaborador' },
                        { key: 'setor', label: 'Setor' },
                        { key: 'cargo', label: 'Cargo' },
                        { key: 'sala', label: 'Sala' },
                        { key: 'tipo', label: 'Tipo' },
                        { key: 'status', label: 'Status' }
                    ]
                }
            };

            // Normalização para comparar nomes de colunas
            const normalizar = (s) => String(s||'').toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
                .replace(/[^a-z0-9 ]/g,' ')
                .replace(/\s+/g,' ').trim();

            function autoDetectarMapeamento() {
                const map = {};
                const headersNorm = headers.map(h => ({ original: h, norm: normalizar(h) }));
                for (const [campo, def] of Object.entries(cfg.campos)) {
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

            // Converte data Excel ou string para {data:'YYYY-MM-DD', hora:'HH:MM', iso}
            // (mesma convenção BRT→UTC usada em DateUtils.toDatabaseISO, ver 10-import.js)
            function parseDataHora(valor) {
                if (valor === null || valor === undefined || valor === '') return null;
                let dt = null, utc = false;
                if (typeof valor === 'number') {
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

            // Converte o valor bruto da planilha conforme o tipo do campo.
            // Retorna '' quando não dá para interpretar — nunca lança erro nem bloqueia a linha.
            function tipoParaValor(def, bruto) {
                if (bruto === null || bruto === undefined || bruto === '') return '';
                switch (def.tipo) {
                    case 'datahora': { const dt = parseDataHora(bruto); return dt ? dt.iso : ''; }
                    case 'data':     { const dt = parseDataHora(bruto); return dt ? dt.data : ''; }
                    case 'numero':   { const n = parseFloat(String(bruto).replace(',', '.')); return isNaN(n) ? '' : n; }
                    case 'booleano': { const n = normalizar(bruto); return ['sim','s','true','1','x','ok'].includes(n); }
                    case 'opcao':    { const n = normalizar(bruto); return (def.mapear && def.mapear(n)) || ''; }
                    default:         return String(bruto).trim().toUpperCase();
                }
            }

            // Aplica o valor padrão do campo quando ele não veio preenchido —
            // é isso que garante que NENHUM campo seja obrigatório na importação.
            function comPadrao(def, valor) {
                const vazio = valor === '' || valor === null || valor === undefined;
                if (!vazio) return valor;
                if (def.padrao === 'agora') return DateUtils.getNowDatabaseISO();
                if (def.padrao === 'hoje') return DateUtils.getToInput().slice(0, 10);
                if (def.padrao !== undefined) return def.padrao;
                return def.tipo === 'booleano' ? false : (def.tipo === 'numero' ? 0 : '');
            }

            function construirPreview() {
                preview = sheetData.map((linha, idx) => {
                    const vals = {};
                    for (const [campo, def] of Object.entries(cfg.campos)) {
                        const bruto = mapping[campo] ? linha[mapping[campo]] : '';
                        vals[campo] = comPadrao(def, tipoParaValor(def, bruto));
                    }
                    return { _linha: idx + 2, _dados: cfg.montarLinha(vals) };
                });
                // Sem campos obrigatórios ⇒ todas as linhas já nascem selecionadas
                selecionadas = new Set(preview.map(p => p._linha));
            }

            // ─────────── INTERFACE ───────────
            function abrir(tabela) {
                if (!currentUserData || currentUserData.isAdmin !== true) {
                    alert('Apenas administradores podem importar planilhas.');
                    return;
                }
                cfg = CONFIGS[tabela];
                if (!cfg) return;
                document.getElementById('gimp-titulo').innerHTML = `<i class="fas fa-file-import" style="color:var(--excel)"></i> Importar Planilha — ${esc(cfg.titulo)}`;
                document.getElementById('gimp-desc').innerHTML = `Importe registros em massa a partir de um arquivo Excel ou CSV para <strong>${esc(cfg.titulo)}</strong>. As colunas são mapeadas automaticamente. <strong style="color:var(--text-secondary)">Nenhum campo é obrigatório</strong> — o que não vier preenchido fica em branco ou usa um valor padrão. Recurso exclusivo de administradores.`;
                document.getElementById('gimp-upload-hint').innerHTML = `<i class="fas fa-info-circle"></i> A primeira linha do arquivo deve conter os títulos das colunas. Colunas reconhecidas: ${Object.values(cfg.campos).map(c => esc(c.label)).join(', ')}.`;
                workbook = null; sheetData = []; headers = []; mapping = {}; preview = []; selecionadas = new Set();
                document.getElementById('gimp-file-input').value = '';
                document.getElementById('gimp-file-name').textContent = '';
                document.getElementById('modal-import-generico').style.display = 'flex';
                irParaEtapa('upload');
            }
            function fechar() {
                document.getElementById('modal-import-generico').style.display = 'none';
                workbook = null; sheetData = []; headers = []; mapping = {}; preview = []; selecionadas = new Set(); cfg = null;
                document.getElementById('gimp-file-input').value = '';
                document.getElementById('gimp-file-name').textContent = '';
            }
            function irParaEtapa(etapa) {
                ['upload','sheet','mapping','preview','progress','done'].forEach(e => {
                    const el = document.getElementById('gimp-step-'+e);
                    if (el) el.style.display = e === etapa ? 'block' : 'none';
                });
                const btnNext = document.getElementById('gimp-btn-next');
                const btnBack = document.getElementById('gimp-btn-back');
                const btnCancel = document.getElementById('gimp-btn-cancel');
                btnBack.style.display = ['mapping','preview'].includes(etapa) ? 'block' : 'none';
                btnNext.style.display = etapa === 'done' || etapa === 'progress' ? 'none' : 'block';
                btnCancel.style.display = etapa === 'progress' ? 'none' : 'block';
                btnCancel.textContent = etapa === 'done' ? 'Fechar' : 'Cancelar';
                if (etapa === 'upload')  { btnNext.disabled = true; btnNext.textContent = 'Próximo'; }
                if (etapa === 'sheet')   { btnNext.disabled = false; btnNext.textContent = 'Próximo'; }
                if (etapa === 'mapping') { btnNext.disabled = false; btnNext.textContent = 'Visualizar'; }
                if (etapa === 'preview') { btnNext.disabled = selecionadas.size === 0; btnNext.textContent = `Importar ${selecionadas.size} registro(s)`; }
            }

            async function processarArquivo(file) {
                document.getElementById('gimp-file-name').innerHTML = `<i class="fas fa-file-excel" style="color:var(--excel)"></i> ${esc(file.name)}`;
                await ensureXLSX();
                const buf = await file.arrayBuffer();
                workbook = XLSX.read(buf, { type:'array', cellDates:true });
                if (workbook.SheetNames.length > 1) {
                    const sel = document.getElementById('gimp-sheet-select');
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
                const container = document.getElementById('gimp-mapping-grid');
                container.innerHTML = Object.entries(cfg.campos).map(([campo, def]) => {
                    const sel = mapping[campo] || '';
                    const opcoes = ['<option value="">— Não importar —</option>']
                        .concat(headers.map(h => `<option value="${esc(h)}" ${h === sel ? 'selected' : ''}>${esc(h)}</option>`))
                        .join('');
                    return `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
                        <div style="flex:1;font-size:0.85rem;font-weight:600;color:var(--text-secondary)">${esc(def.label)}</div>
                        <div style="flex:1.2"><select data-campo="${campo}" class="gimp-map-select" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem">
                            ${opcoes}
                        </select></div>
                    </div>`;
                }).join('');
                container.querySelectorAll('.gimp-map-select').forEach(sel => {
                    sel.addEventListener('change', e => {
                        const c = e.target.dataset.campo;
                        if (e.target.value) mapping[c] = e.target.value;
                        else delete mapping[c];
                    });
                });
            }

            function atualizarBotaoImportar() {
                const btn = document.getElementById('gimp-btn-next');
                btn.disabled = selecionadas.size === 0;
                btn.textContent = `Importar ${selecionadas.size} registro(s)`;
            }

            function formatarValorCelula(coluna, valor) {
                if (coluna.formatar === 'datahora') return valor ? formatarDataHoraReal(valor) : '—';
                if (coluna.formatar === 'data') return valor ? formatarData(valor) : '—';
                if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
                return (valor === null || valor === undefined || valor === '') ? '—' : valor;
            }

            function renderPreviewTable() {
                document.getElementById('gimp-preview-summary').innerHTML =
                    `<strong>${preview.length}</strong> linha(s) lida(s) — todas prontas para importar. Nenhum campo é obrigatório: o que estiver em branco entra em branco ou com valor padrão.`;
                const theadCols = cfg.colunas.map(c => `<th style="padding:8px;text-align:left">${esc(c.label)}</th>`).join('');
                const tbody = preview.map(p => {
                    const checked = selecionadas.has(p._linha) ? 'checked' : '';
                    const tds = cfg.colunas.map(c => `<td>${esc(formatarValorCelula(c, p._dados[c.key]))}</td>`).join('');
                    return `<tr><td><input type="checkbox" data-linha="${p._linha}" ${checked}></td>${tds}</tr>`;
                }).join('');
                document.getElementById('gimp-preview-table').innerHTML = `
                    <div style="max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:8px">
                    <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
                        <thead style="position:sticky;top:0;background:#f8fafc;z-index:1">
                            <tr><th style="padding:8px"><input type="checkbox" id="gimp-chk-all" checked></th>${theadCols}</tr>
                        </thead>
                        <tbody>${tbody}</tbody>
                    </table></div>`;
                document.querySelectorAll('#gimp-preview-table input[type="checkbox"][data-linha]').forEach(chk => {
                    chk.addEventListener('change', e => {
                        const linha = parseInt(e.target.dataset.linha);
                        if (e.target.checked) selecionadas.add(linha); else selecionadas.delete(linha);
                        atualizarBotaoImportar();
                    });
                });
                document.getElementById('gimp-chk-all').addEventListener('change', e => {
                    const marcar = e.target.checked;
                    document.querySelectorAll('#gimp-preview-table input[type="checkbox"][data-linha]').forEach(chk => {
                        chk.checked = marcar;
                        const linha = parseInt(chk.dataset.linha);
                        if (marcar) selecionadas.add(linha); else selecionadas.delete(linha);
                    });
                    atualizarBotaoImportar();
                });
            }

            function renderPreview() {
                construirPreview();
                renderPreviewTable();
                return true;
            }

            async function executarImport() {
                irParaEtapa('progress');
                const linhasParaImportar = preview.filter(p => selecionadas.has(p._linha));
                const total = linhasParaImportar.length;
                const LOTE = 50;
                let inseridos = 0, falhas = 0;
                const erros = [];
                const barra = document.getElementById('gimp-progress');
                const txt = document.getElementById('gimp-progress-text');
                barra.max = total; barra.value = 0;
                const baseId = Date.now();

                for (let i = 0; i < total; i += LOTE) {
                    const fatia = linhasParaImportar.slice(i, i + LOTE);
                    const lote = fatia.map((p, j) => ({ id: baseId + i + j, ...p._dados }));
                    try {
                        const { data, error } = await sb.from(cfg.tabela).insert(lote).select();
                        if (error) {
                            falhas += lote.length;
                            erros.push(`Lote ${i/LOTE+1}: ${error.message}`);
                        } else {
                            inseridos += data.length;
                            data.forEach(d => { try { syncSheets(cfg.tabela, 'insert', d); } catch(e) {} });
                        }
                    } catch (e) {
                        falhas += lote.length;
                        erros.push(`Lote ${i/LOTE+1}: ${e.message}`);
                    }
                    barra.value = Math.min(i + LOTE, total);
                    txt.textContent = `${barra.value} de ${total} processados…`;
                }
                try { await registrarLog('Importação', cfg.secaoLog, `Importou ${inseridos} registro(s) via planilha`); } catch(e) {}
                document.getElementById('gimp-done-summary').innerHTML = `
                    <div style="text-align:center;padding:20px 0">
                        <i class="fas fa-${falhas===0?'check-circle':'exclamation-triangle'}" style="font-size:3rem;color:var(--${falhas===0?'success':'warning'});"></i>
                        <h4 style="margin-top:12px;color:var(--text-primary)">Importação concluída</h4>
                        <p style="margin-top:8px"><strong style="color:var(--success);font-size:1.4rem">${inseridos}</strong> registro(s) importado(s) com sucesso</p>
                        ${falhas?`<p style="color:var(--danger);margin-top:10px"><strong>${falhas}</strong> falha(s)</p><pre style="text-align:left;background:#fef2f2;padding:10px;border-radius:6px;font-size:0.75rem;max-height:120px;overflow:auto">${esc(erros.join('\n'))}</pre>`:''}
                    </div>`;
                irParaEtapa('done');
                if (typeof carregarDados === 'function') carregarDados();
            }

            // ─────────── HANDLERS PÚBLICOS ───────────
            return {
                init() {
                    document.getElementById('gimp-file-input').addEventListener('change', async e => {
                        const f = e.target.files[0];
                        if (!f) return;
                        try {
                            await processarArquivo(f);
                            document.getElementById('gimp-btn-next').disabled = false;
                        } catch (err) {
                            alert('Erro ao ler arquivo: ' + err.message);
                        }
                    });
                    document.getElementById('gimp-btn-next').addEventListener('click', () => {
                        const upload = document.getElementById('gimp-step-upload').style.display !== 'none';
                        const sheet = document.getElementById('gimp-step-sheet').style.display !== 'none';
                        const mapStep = document.getElementById('gimp-step-mapping').style.display !== 'none';
                        const prev = document.getElementById('gimp-step-preview').style.display !== 'none';
                        if (upload) {
                            if (workbook) {
                                if (workbook.SheetNames.length > 1) irParaEtapa('sheet');
                                else { carregarSheet(workbook.SheetNames[0]); }
                            }
                        } else if (sheet) {
                            carregarSheet(document.getElementById('gimp-sheet-select').value);
                        } else if (mapStep) {
                            if (renderPreview()) irParaEtapa('preview');
                        } else if (prev) {
                            executarImport();
                        }
                    });
                    document.getElementById('gimp-btn-back').addEventListener('click', () => {
                        const mapStep = document.getElementById('gimp-step-mapping').style.display !== 'none';
                        const prev = document.getElementById('gimp-step-preview').style.display !== 'none';
                        if (prev) irParaEtapa('mapping');
                        else if (mapStep) {
                            if (workbook && workbook.SheetNames.length > 1) irParaEtapa('sheet');
                            else irParaEtapa('upload');
                        }
                    });
                },
                abrir, fechar
            };
        })();

        window.abrirImportGenerico = (tabela) => ImportGenerico.abrir(tabela);
        window.fecharImportGenerico = () => ImportGenerico.fechar();
        ImportGenerico.init();
