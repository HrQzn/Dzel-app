        const formOco = document.getElementById('form-ocorrencia');
        formOco.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idEdicao = document.getElementById('ocorrencia-id-edit').value;
            const id = idEdicao || Date.now();
            const statusN = idEdicao ? document.getElementById('oco-status-edit').value : 'Aberta';
            const novaOco = {
                id,
                numero:      document.getElementById('oco-numero').value.toUpperCase(),
                unidade:     document.getElementById('oco-unidade').value.toUpperCase(),
                local:       document.getElementById('oco-local').value.toUpperCase(),
                contratada:  document.getElementById('oco-contratada').value.toUpperCase(),
                categoria:   document.getElementById('oco-categoria').value,
                gravidade:   document.getElementById('oco-gravidade').value,
                data_hora:   DateUtils.toDatabaseISO(document.getElementById('oco-data').value),
                responsavel: document.getElementById('oco-responsavel').value.toUpperCase(),
                descricao:   document.getElementById('oco-descricao').value.trim(),
                status:      statusN,
                data_encerramento: null
            };
            if (idEdicao) {
                const ant = ocorrencias.find(o => o.id == id);
                if (statusN === 'Encerrada' && (!ant || ant.status !== 'Encerrada'))
                    novaOco.data_encerramento = DateUtils.getNowDatabaseISO();
                else if (ant && ant.data_encerramento)
                    novaOco.data_encerramento = ant.data_encerramento;
                registrarLog('Edição', 'Ocorrências', `Alterou ocorrência: ${novaOco.numero || id}`);
            } else {
                registrarLog('Criação', 'Ocorrências', `Nova ocorrência: ${novaOco.categoria} — ${novaOco.unidade}`);
            }
            const { error } = await sb.from('ocorrencias').upsert(novaOco);
            if (error) alert('Erro: ' + error.message);
            else { syncSheets('ocorrencias','upsert',novaOco); cancelarEdicaoOcorrencia(); carregarDados(); }
        });

        window.editarOcorrencia = function(id) {
            const o = ocorrencias.find(i => i.id == id); if (!o) return;
            document.getElementById('ocorrencia-id-edit').value = o.id;
            document.getElementById('oco-numero').value      = o.numero || '';
            document.getElementById('oco-unidade').value     = o.unidade;
            document.getElementById('oco-local').value       = o.local;
            document.getElementById('oco-contratada').value  = o.contratada || '';
            document.getElementById('oco-categoria').value   = o.categoria;
            document.getElementById('oco-gravidade').value   = o.gravidade;
            document.getElementById('oco-responsavel').value = o.responsavel;
            document.getElementById('oco-descricao').value   = o.descricao;
            if (o.data_hora) {
                const dl = new Date(o.data_hora);
                dl.setMinutes(dl.getMinutes() - dl.getTimezoneOffset());
                document.getElementById('oco-data').value = dl.toISOString().slice(0, 16);
            }
            document.getElementById('titulo-form-ocorrencia').innerHTML = '<i class="fas fa-pen"></i> Editando Ocorrência';
            const btn = document.getElementById('btn-submit-oco');
            btn.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
            btn.style.background = 'linear-gradient(135deg, var(--edit), #d97706)';
            document.getElementById('btn-cancel-oco').style.display = 'block';
            document.getElementById('oco-status-edit').style.display = 'block';
            document.getElementById('oco-status-edit').value = o.status;
            document.getElementById('ocorrencias').scrollIntoView({ behavior: 'smooth' });
        };

        window.cancelarEdicaoOcorrencia = function() {
            document.getElementById('ocorrencia-id-edit').value = '';
            formOco.reset();
            document.getElementById('oco-data').value = DateUtils.getToInput();
            document.getElementById('titulo-form-ocorrencia').innerHTML = '<i class="fas fa-triangle-exclamation" style="color:var(--ocorrencia)"></i> Registrar Ocorrência';
            const btn = document.getElementById('btn-submit-oco');
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Registrar Ocorrência';
            btn.style.background = 'linear-gradient(135deg, var(--ocorrencia), #991b1b)';
            document.getElementById('btn-cancel-oco').style.display = 'none';
            document.getElementById('oco-status-edit').style.display = 'none';
        };

        window.deletarOcorrencia = async function(id) {
            if (!confirm('Excluir esta ocorrência?')) return;
            const item = ocorrencias.find(o => o.id == id);
            await sb.from('ocorrencias').delete().eq('id', id);
            syncSheets('ocorrencias','delete',{id});
            registrarLog('Exclusão', 'Ocorrências', `Removeu ocorrência: ${item ? (item.numero || item.categoria) : id}`);
            carregarDados();
        };

        window.renderizarApenasOcorrencias = function() {
            const mes   = document.getElementById('filtro-mes-oco').value;
            const dia   = document.getElementById('filtro-dia-oco').value;
            const termo = document.getElementById('filtro-busca-oco').value.toUpperCase();
            const stat  = document.getElementById('filtro-status-oco').value;
            const lista = ocorrencias.filter(o => {
                const bM = !mes  || (o.data_hora || '').startsWith(mes);
                const bD = !dia  || diaLocalISO(o.data_hora) === dia;
                const bS = !stat || o.status === stat;
                const bT = !termo || ((o.unidade||'')+(o.local||'')+(o.categoria||'')+(o.descricao||'')+(o.responsavel||'')+(o.numero||'')).toUpperCase().includes(termo);
                return bM && bD && bS && bT;
            });
            document.getElementById('dash-oco-total').innerText     = lista.length;
            document.getElementById('dash-oco-abertas').innerText   = lista.filter(o => o.status === 'Aberta').length;
            document.getElementById('dash-oco-tratativa').innerText = lista.filter(o => o.status === 'Em Tratativa').length;
            document.getElementById('dash-oco-encerradas').innerText= lista.filter(o => o.status === 'Encerrada').length;

            const gravClass = { 'Baixa':'bg-concluido', 'Média':'bg-andamento', 'Alta':'bg-pendente', 'Crítica':'bg-critica' };
            const statClass = { 'Aberta':'bg-aberta', 'Em Tratativa':'bg-tratativa', 'Encerrada':'bg-encerrada' };
            renderPaginated({
                tableId: 'tabela-ocorrencias', items: lista, colspan: 7,
                emptyMsg: 'Nenhuma ocorrência encontrada.',
                filterKey: mes + '|' + dia + '|' + termo + '|' + stat,
                rerender: window.renderizarApenasOcorrencias,
                rowFn: (o) => {
                const dataFmt = formatarDataHoraReal(o.data_hora);
                const tempo   = o.status === 'Encerrada' && o.data_encerramento
                    ? `<span class="time-badge"><i class="fas fa-flag-checkered"></i> ${calcularTempoOco(o.data_hora, o.data_encerramento)}</span>`
                    : `<span class="time-badge" style="background:#fef3c7;color:#92400e;border-color:#fde68a"><i class="fas fa-hourglass-half"></i> ${calcularTempoOco(o.data_hora)}</span>`;
                const titulo  = o.numero ? `<strong>#${esc(o.numero)} — ${esc(o.categoria)}</strong>` : `<strong>${esc(o.categoria)}</strong>`;
                const desc    = esc((o.descricao || '').substring(0, 55)) + ((o.descricao||'').length > 55 ? '…' : '');
                const btnWA   = `<button onclick="enviarWhatsAppOcorrencia(${o.id})" class="action-btn btn-whatsapp" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>`;
                const btnPDF  = `<button onclick="gerarPDFOcorrencia(${o.id})" class="action-btn btn-print" title="Baixar PDF"><i class="fas fa-file-pdf"></i></button>`;
                const btnPrint = `<button onclick="imprimirOcorrencia(${o.id})" class="action-btn btn-print" title="Imprimir R.O."><i class="fas fa-print"></i></button>`;
                const btnEdit = pode('ocorrencias','editar') ? `<button onclick="editarOcorrencia(${o.id})" class="action-btn btn-edit"><i class="fas fa-pen"></i></button>` : '';
                const btnDel  = pode('ocorrencias','excluir') ? `<button onclick="deletarOcorrencia(${o.id})" class="action-btn btn-delete"><i class="fas fa-trash"></i></button>` : '';
                return `<tr>
                    <td style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;white-space:nowrap">${dataFmt}</td>
                    <td><span class="badge ${gravClass[o.gravidade]||'bg-saiu'}">${esc(o.gravidade)}</span></td>
                    <td>${titulo}<br><small style="color:var(--text-muted)">${esc(o.unidade)} — ${esc(o.local)}</small></td>
                    <td>${desc}<br><small style="color:var(--text-muted)">Resp: ${esc(o.responsavel)}</small></td>
                    <td><span class="badge ${statClass[o.status]||'bg-saiu'}">${esc(o.status)}</span></td>
                    <td>${tempo}</td>
                    <td style="min-width:170px">${btnWA}${btnPrint}${btnPDF}${btnEdit}${btnDel}</td>
                </tr>`;
                }
            });
        };

        function calcularTempoOco(dataISOInicio, dataISOFim) {
            if (!dataISOInicio) return '--';
            const inicio = new Date(dataISOInicio);
            const fim    = dataISOFim ? new Date(dataISOFim) : new Date();
            return formatarTempo(fim - inicio);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // IMPRESSÃO HTML — REGISTRO DE OCORRÊNCIA
        // Layout IDÊNTICO ao gerarPDFOcorrencia:
        //   - Brasão ESQUERDA, textos centrados no PW inteiro
        //   - Tabela 190mm, OX=10mm, bordas #BFBFBF
        //   - Rows 12mm, colunas 95+95mm
        //   - Gap 4mm entre tabela e seção 2
        //   - Caixa descrição preenche resto da página (sem assinatura)
        //   - Rodapé "Documento gerado" no fim
        // ═══════════════════════════════════════════════════════════════════════
        function gerarHTMLOcorrencia(id) {
            const o = ocorrencias.find(i => i.id == id);
            if (!o) return '<html><body><p>Erro: Ocorrência não encontrada.</p></body></html>';

            const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            const dt       = o.data_hora ? new Date(o.data_hora) : new Date();
            const dataStr  = dt.toLocaleDateString('pt-BR');
            const horaStr  = dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
            const numero   = o.numero || String(o.id);
            const descricao = o.descricao || '';

            // Texto LITERAL — exatamente como digitado. Sem capitalizacao automatica.
            // O <div> usa white-space:pre-wrap (ver CSS .desc-box) para preservar
            // quebras de linha e topicos. Apenas escapamos HTML por seguranca.
            const descSentence = descricao
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            // Linha extra de encerramento
            let encRow = '';
            if (o.status === 'Encerrada' && o.data_encerramento) {
                const dtE = new Date(o.data_encerramento);
                encRow = `
              <tr>
                <td class="cell" style="width:95mm"><span class="lbl">Data / Hora de Abertura</span><span class="val">${dataStr}  ${horaStr}</span></td>
                <td class="cell" style="width:95mm"><span class="lbl">Data / Hora de Encerramento</span><span class="val">${dtE.toLocaleDateString('pt-BR')}  ${dtE.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></td>
              </tr>`;
            }

            // Altura da caixa de descrição (do DOCX): 163,5mm com a linha de
            // encerramento; sem ela, compensa os 11,7mm da linha ausente.
            const descMM = encRow ? 158 : 170;

            return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<base href="${baseHref}">
<title>R.O. ${esc(numero)}</title>
<style>
  /* Réplica fiel do DOCX RO_11_2026: tabela 190mm, alturas exatas */
  /* A4 margem 10mm: conteúdo de 190mm cabe em qualquer destino, sem escala. */
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; }
  body { font-family: Helvetica, Arial, sans-serif; color: #000; background: #fff; }
  .wrap { width: 190mm; margin: 0 auto; }

  table.ro { width: 190mm; border-collapse: collapse; table-layout: fixed; }
  table.ro td { border: 0.25mm solid #BFBFBF; }

  /* Cabeçalho 31.6mm — brasão esquerda, texto centro */
  td.hdr { height: 31.6mm; padding: 0; position: relative; }
  .hdr-brasao { position: absolute; left: 4mm; top: 50%; transform: translateY(-50%); width: 19mm; height: 21mm; object-fit: contain; }
  .hdr-textos { text-align: center; width: 100%; padding: 3mm 0; }
  .hdr-textos .gov   { font-size: 16pt; font-weight: bold; line-height: 1.2; }
  .hdr-textos .coord { font-size: 10pt; color: #545454; margin: 1px 0; }
  .hdr-textos .dzel  { font-size: 9pt; font-weight: bold; }
  .hdr-textos .sep   { border: none; border-top: 0.3mm solid #BFBFBF; margin: 3px auto; width: 90mm; }
  .hdr-textos .titulo { font-size: 9pt; font-weight: bold; letter-spacing: 0.5px; }

  td.sec { height: 7.2mm; background: #F2F2F2; vertical-align: middle; padding: 0 3mm; font-size: 8pt; font-weight: bold; color: #1E1E1E; }

  td.cell { height: 11.7mm; width: 95mm; vertical-align: top; padding: 1.5mm 3mm; }
  td.cell .lbl { display: block; font-size: 7pt; color: #626262; font-weight: normal; margin-bottom: 0.5mm; }
  td.cell .val { display: block; font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #000; }

  .sec-bar { width: 190mm; height: 7.2mm; background: #F2F2F2; border: 0.25mm solid #BFBFBF;
    display: flex; align-items: center; padding: 0 3mm; margin-top: 3mm;
    font-size: 8pt; font-weight: bold; color: #1E1E1E; }

  /* Caixa de descrição — altura fixa do DOCX (163.5mm c/ encerramento) */
  .desc-box { width: 190mm; border: 0.3mm solid #BFBFBF; border-top: none;
    padding: 8mm 6mm 6mm 6mm; font-size: 10pt; line-height: 5.6mm;
    text-align: left; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; }

  .footer { text-align: center; font-size: 7.5pt; font-style: italic; color: #8a8a8a; margin-top: 2.5mm; }

  /* Botão fechar (só tela) */
  #btn-fechar { position: fixed; top: 10px; right: 10px; background: #ef4444; color: white;
    border: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;
    font-weight: 700; cursor: pointer; z-index: 9999; font-family: inherit; }
  @media print { #btn-fechar { display: none !important; } }
</style>
</head>
<body>
<button id="btn-fechar" onclick="window.close()">\u2715 Fechar</button>

<div class="wrap">

  <table class="ro">
    <tr>
      <td class="hdr" colspan="2">
        <img class="hdr-brasao" src="brasao.jpg" alt="SP" onerror="this.style.display='none'">
        <div class="hdr-textos">
          <div class="gov">GOVERNO DO ESTADO DE S\u00C3O PAULO</div>
          <div class="coord">Coordenadoria Geral de Suporte Administrativo</div>
          <div class="dzel">Divis\u00E3o de Zeladoria (DZEL)</div>
          <hr class="sep">
          <div class="titulo">REGISTRO DE OCORR\u00CANCIA</div>
        </div>
      </td>
    </tr>

    <tr><td class="sec" colspan="2">1 - Dados do Registro</td></tr>

    <tr>
      <td class="cell" style="width:95mm"><span class="lbl">N\u00BA do Registro</span><span class="val">${esc(numero)}</span></td>
      <td class="cell" style="width:95mm"><span class="lbl">Status</span><span class="val">${esc(o.status) || '-'}</span></td>
    </tr>
    <tr>
      <td class="cell"><span class="lbl">Data / Hora de Abertura</span><span class="val">${dataStr}  ${horaStr}</span></td>
      <td class="cell"><span class="lbl">Tipo de Ocorr\u00EAncia</span><span class="val">${esc(o.categoria) || '-'}</span></td>
    </tr>
    <tr>
      <td class="cell"><span class="lbl">Respons\u00E1vel (Fiscal/Autor)</span><span class="val">${esc(o.responsavel) || '-'}</span></td>
      <td class="cell"><span class="lbl">Contratada</span><span class="val">${esc(o.contratada) || '-'}</span></td>
    </tr>
    <tr>
      <td class="cell"><span class="lbl">Unidade / Pr\u00E9dio</span><span class="val">${esc(o.unidade) || '-'}</span></td>
      <td class="cell"><span class="lbl">Setor / Local</span><span class="val">${esc(o.local) || '-'}</span></td>
    </tr>
    ${encRow}
  </table>

  <div class="sec-bar">2 - Descri\u00E7\u00E3o</div>

  <div class="desc-box" style="height:${descMM}mm;">${descSentence}</div>

  <div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>

</div>

<script>
  window.addEventListener('load', function() {
    var imgs = document.querySelectorAll('img');
    var loaded = 0;
    var total = imgs.length;
    function tryPrint() {
      loaded++;
      if (loaded >= total) { setTimeout(function(){ window.print(); }, 300); }
    }
    if (total === 0) { setTimeout(function(){ window.print(); }, 300); }
    else { imgs.forEach(function(img){ if(img.complete){ tryPrint(); } else { img.addEventListener('load', tryPrint); img.addEventListener('error', tryPrint); } }); }
  });
  window.addEventListener('afterprint', function() { try { window.close(); } catch(e) {} });
<\/script>
</body>
</html>`;
        }

        window.imprimirOcorrencia = function(id) {
            const html = gerarHTMLOcorrencia(id);
            const pw = window.open('', '_blank');
            if (pw && !pw.closed) {
                pw.document.open();
                pw.document.write(html);
                pw.document.close();
            } else {
                imprimirViaOverlay(html);
            }
        };

        // ═══════════════════════════════════════════════════════════════════════
        // PDF — REGISTRO DE OCORRÊNCIA  (v7 — pixel-perfect do DOCX de referência)
        // Specs extraídas via unpacked XML: trHeight, tcW, sz, color, shading
        // ═══════════════════════════════════════════════════════════════════════
        window.gerarPDFOcorrencia = async function(id) {
            const o = ocorrencias.find(i => i.id == id); if (!o) return;
            await ensureJsPDF(); // Carrega jsPDF sob demanda (~300KB)
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            // ── Dimensões exatas do DOCX de referência ───────────────────────
            // Página A4: 11910×16840 twips → 210×297mm
            // Margens: top=520, left/right=425 twips → top=9.2mm, lat=7.5mm
            // Tabela: indent=153 twips=2.7mm da margem → OX=10.2mm≈10mm
            //         largura=10772 twips → 190mm
            const OX      = 10;          // margem tabela esquerda
            const PW      = 190;         // largura útil da tabela
            const RX      = OX + PW;
            const PAGE_H  = 280;         // altura útil com margem inferior
            let   Y       = 9;           // top margin (520 twips)

            // ── Paleta (diretamente do DOCX) ─────────────────────────────────
            const BD  = [191,191,191];   // #BFBFBF — cor de todas as bordas
            const SEC = [242,242,242];   // #F2F2F2 — fundo cabeçalho de seção
            const LBL = [99, 99, 99];    // #636363 — cor dos labels
            const SEC_TXT = [30,30,30];  // #1E1E1E — texto seção
            const K   = [0,0,0];
            const W   = [255,255,255];

            // ── Sanitize ─────────────────────────────────────────────────────
            const s = v => String(v||'').normalize('NFD')
                .replace(/[\u0300-\u036f]/g,'').replace(/[^\x00-\x7F]/g,'');

            // Borda compartilhada entre células vizinhas (linha vertical fina)
            const vln = (x, y1, y2) => {
                pdf.setLineWidth(0.2); pdf.setDrawColor(...BD);
                pdf.line(x, y1, x, y2);
            };

            // ── Helper de célula (label cinza + valor bold) ───────────────────
            // trHeight=665 twips → 11.7mm. Label baseline: +4.5mm. Valor baseline: +9.5mm
            const pintaCell = (lbl, val, x, y, w, h) => {
                pdf.setFontSize(7); pdf.setFont('helvetica','normal');
                pdf.setTextColor(...LBL);
                pdf.text(s(lbl), x+3, y+4.5);
                const linhas = pdf.splitTextToSize(s(String(val||'-').toUpperCase()), w-6);
                pdf.setFontSize(9); pdf.setFont('helvetica','bold');
                pdf.setTextColor(...K);
                pdf.text(linhas[0]||'-', x+3, y+h-3);
            };

            // ── Construtores de linha da tabela ───────────────────────────────
            // Altura padrão: 665 twips × 25.4/1440 = 11.7mm → 12mm
            const ROW_H = 12;

            const row1 = (lbl, val, y, h=ROW_H) => {
                pdf.setFillColor(...W); pdf.setDrawColor(...BD);
                pdf.setLineWidth(0.25); pdf.rect(OX, y, PW, h, 'FD');
                pintaCell(lbl, val, OX, y, PW, h);
                return y + h;
            };

            const row2 = (l1,v1,l2,v2, y, h=ROW_H) => {
                const hw = PW/2;
                pdf.setFillColor(...W); pdf.setDrawColor(...BD);
                pdf.setLineWidth(0.25); pdf.rect(OX, y, PW, h, 'FD');
                vln(OX+hw, y, y+h);
                pintaCell(l1,v1, OX,    y, hw, h);
                pintaCell(l2,v2, OX+hw, y, hw, h);
                return y + h;
            };

            const row2x = (l1,v1,w1, l2,v2, y, h=ROW_H) => {
                const w2 = PW-w1;
                pdf.setFillColor(...W); pdf.setDrawColor(...BD);
                pdf.setLineWidth(0.25); pdf.rect(OX, y, PW, h, 'FD');
                vln(OX+w1, y, y+h);
                pintaCell(l1,v1, OX,    y, w1, h);
                pintaCell(l2,v2, OX+w1, y, w2, h);
                return y + h;
            };

            // Cabeçalho de seção: fill=#F2F2F2, "N - Titulo" 8pt bold #1E1E1E
            // trHeight=407 twips → 7.2mm
            const SEC_H = 7.5;
            const secHeader = (label, y) => {
                pdf.setFillColor(...SEC); pdf.setDrawColor(...BD);
                pdf.setLineWidth(0.25); pdf.rect(OX, y, PW, SEC_H, 'FD');
                pdf.setFontSize(8); pdf.setFont('helvetica','bold');
                pdf.setTextColor(...SEC_TXT);
                pdf.text(s(label), OX+3, y+5.2);
                return y + SEC_H;
            };

            // ════════════════════════════════════════════════════════════════
            // ROW 0 — CABEÇALHO (trHeight=1794 twips → 31.6mm)
            // Brasão: 19.3×21.2mm (696036×764275 EMU / 914400*25.4)
            // "GOVERNO": 32 half-pts = 16pt bold
            // "Coordenadoria": 21 half-pts = 10.5pt normal
            // "Divisao DZEL": 18 half-pts = 9pt bold
            // Linha separadora #BFBFBF
            // "REGISTRO DE OCORRENCIA": 18 half-pts = 9pt bold
            // ════════════════════════════════════════════════════════════════
            const HDR_H = 32;   // 1794/1440*25.4 = 31.6mm ≈ 32mm

            pdf.setFillColor(...W); pdf.setDrawColor(...BD);
            pdf.setLineWidth(0.3); pdf.rect(OX, Y, PW, HDR_H, 'FD');

            // Brasão: 19×21mm, centrado verticalmente em 32mm → Y+(32-21)/2 = Y+5.5
            try {
                const bd = await getBrasaoDataURL();
                if (bd) pdf.addImage(bd,'PNG', OX+4, Y+5.5, 19, 21);
            } catch(e){}

            // Textos centrados sobre toda a largura PW
            // "GOVERNO DO ESTADO DE SAO PAULO" — 16pt bold
            const cX = OX + PW/2;
            pdf.setFontSize(16); pdf.setFont('helvetica','bold'); pdf.setTextColor(...K);
            pdf.text('GOVERNO DO ESTADO DE SAO PAULO', cX, Y+10, {align:'center'});

            // "Coordenadoria Geral de Suporte Administrativo" — 10.5pt normal cinza
            pdf.setFontSize(10); pdf.setFont('helvetica','normal'); pdf.setTextColor(85,85,85);
            pdf.text('Coordenadoria Geral de Suporte Administrativo', cX, Y+16, {align:'center'});

            // "Divisao de Zeladoria (DZEL)" — 9pt bold preto
            pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...K);
            pdf.text('Divisao de Zeladoria (DZEL)', cX, Y+21.5, {align:'center'});

            // Linha separadora fina #BFBFBF
            pdf.setLineWidth(0.3); pdf.setDrawColor(...BD);
            pdf.line(OX+50, Y+24, RX-50, Y+24);

            // "REGISTRO DE OCORRENCIA" — 9pt bold
            pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(...K);
            pdf.text('REGISTRO DE OCORRENCIA', cX, Y+29.5, {align:'center'});

            Y += HDR_H;

            // ════════════════════════════════════════════════════════════════
            // ROW 1 — Seção "1 - Dados do Registro"
            // ════════════════════════════════════════════════════════════════
            Y = secHeader('1 - Dados do Registro', Y);

            // ════════════════════════════════════════════════════════════════
            // ROW 2-5 — Campos de dados (4 linhas × 12mm = 48mm)
            // ════════════════════════════════════════════════════════════════
            const dt      = o.data_hora ? new Date(o.data_hora) : new Date();
            const dataStr = dt.toLocaleDateString('pt-BR');
            const horaStr = dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

            Y = row2x('No do Registro',          o.numero||String(o.id),
                      95, 'Status',              o.status||'-', Y);
            Y = row2x('Data / Hora de Abertura', `${dataStr}  ${horaStr}`,
                      95, 'Tipo de Ocorrencia',  o.categoria||'-', Y);
            Y = row2( 'Responsavel (Fiscal/Autor)', o.responsavel||'-',
                      'Contratada',              o.contratada||'-', Y);
            Y = row2( 'Unidade / Predio',        o.unidade||'-',
                      'Setor / Local',           o.local||'-', Y);

            // Linha extra se encerrada (data de encerramento)
            if (o.status === 'Encerrada' && o.data_encerramento) {
                const dtE    = new Date(o.data_encerramento);
                const encStr = `${dtE.toLocaleDateString('pt-BR')}  ${dtE.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
                Y = row2x('Data / Hora de Abertura',     `${dataStr}  ${horaStr}`,
                          95, 'Data / Hora de Encerramento', encStr, Y);
            }

            Y += 4;   // espaço entre tabela e seção 2

            // ════════════════════════════════════════════════════════════════
            // SEÇÃO 2 — Descrição  (shape textbox no DOCX)
            // Specs do textbox: Arial 10.5pt, line-spacing 391/240=1.63×
            // Indent: left=333 dxa=5.9mm, right=327 dxa=5.8mm
            // Border: #BFBFBF 0.3mm, fill branco
            // Preenche o restante da página
            // ════════════════════════════════════════════════════════════════
            Y = secHeader('2 - Descricao', Y);

            // Texto LITERAL — preserva exatamente o que foi digitado (maiusculas,
            // quebras de linha, topicos). Sem sentCase, sem justificacao.
            const descRaw = s(o.descricao || '');

            // Line-height: 391/240 × 10.5pt × 0.3528mm/pt = 6.04mm → 6.2mm
            pdf.setFontSize(10.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...K);
            const bTxtW     = PW - 12;      // 5.9mm + 5.8mm = ~6mm cada lado
            // Quebra respeitando os ENTERs do usuario: cada paragrafo e processado
            // separadamente, depois quebrado pela largura. Linhas vazias viram espaco.
            const descLines = [];
            (descRaw.length ? descRaw.split('\n') : ['']).forEach(par => {
                if (par.trim() === '') { descLines.push(''); return; }
                pdf.splitTextToSize(par, bTxtW).forEach(l => descLines.push(l));
            });
            const lnH       = 6.2;
            const padTop    = 8;
            const padBot    = 6;
            const txtX      = OX + 6;

            let restantes = [...descLines];
            while (restantes.length > 0) {
                // Espaço disponível: rodapé reserva 18mm (gap 6mm + footer 8mm + margem 4mm)
                const espDisp = PAGE_H - Y - 18;
                const maxLns  = Math.max(1, Math.floor((espDisp-padTop-padBot)/lnH));
                const lote    = restantes.splice(0, maxLns);

                // A caixa preenche o espaço restante quando texto é curto
                const conteudoH = lote.length*lnH + padTop + padBot;
                const boxH      = Math.max(espDisp, conteudoH);

                pdf.setFillColor(...W); pdf.setDrawColor(...BD);
                pdf.setLineWidth(0.3); pdf.rect(OX, Y, PW, boxH, 'FD');

                pdf.setFontSize(10.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(...K);
                lote.forEach((linha,i) => {
                    const py = Y + padTop + i*lnH;
                    // Alinhado a esquerda — preserva indentacao de topicos/listas
                    if (linha) pdf.text(linha, txtX, py);
                });
                Y += boxH;

                if (restantes.length > 0) {
                    pdf.addPage(); Y = 9;
                    Y = secHeader('2 - Descricao (continuacao)', Y);
                    pdf.setFontSize(10.5); pdf.setFont('helvetica','normal');
                }
            }

            Y += 6;

            // ════════════════════════════════════════════════════════════════
            // RODAPÉ — "Documento gerado em..."
            // ════════════════════════════════════════════════════════════════
            if (Y + 8 > PAGE_H) { pdf.addPage(); Y = PAGE_H - 10; }
            pdf.setFontSize(7.5); pdf.setFont('helvetica','italic');
            pdf.setTextColor(170,170,170);
            pdf.text(
                `Documento gerado em ${new Date().toLocaleString('pt-BR')} `,
                OX+PW/2, Y, {align:'center'}
            );

            const nomeArq = o.numero ? String(o.numero).replace(/[^a-zA-Z0-9]/g,'_') : o.id;
            pdf.save(`RO_${nomeArq}.pdf`);
        };

        // ════════════════════════════════════════════════════════════════════
        // IMPORTAÇÃO DE PLANILHA — Demandas (Geral)
        // Lê .xlsx/.xls/.csv, mapeia colunas automaticamente e insere em massa
        // ════════════════════════════════════════════════════════════════════
