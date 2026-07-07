        async function gerarPDFOS(id, descricao, materiais) {
            const btnPDF = document.getElementById('btn-acao-pdf');
            const textoOriginal = btnPDF.innerHTML;
            btnPDF.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
            btnPDF.disabled = true;

            try {
                const d = montarDadosOS(id);
                if (!d) throw new Error('O.S. não encontrada.');

                await ensureJsPDF(); // Carrega jsPDF sob demanda (~300KB)
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                // ── Dimensões da página ──────────────────────────────────────
                const PW = 200;   // largura útil (210 - 5mm cada lado)
                const OX = 5;     // origem X
                let   Y  = 8;     // cursor Y (avança linha a linha)

                // ── Sanitize: remove acentos para compatibilidade com helvetica ──
                const s = (str) => String(str || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')  // remove diacritics
                    .replace(/[^\x00-\x7F]/g, '');    // remove qualquer não-ASCII restante

                // ── Helpers de desenho ───────────────────────────────────────
                const linhah  = (y, x1, x2) => { pdf.line(x1 ?? OX, y, x2 ?? OX+PW, y); };
                const linhav  = (x, y1, y2) => { pdf.line(x, y1, x, y2); };
                const rect    = (x, y, w, h) => { pdf.rect(x, y, w, h); };
                const txt = (t, x, y, sz, bold, color, maxW) => {
                    pdf.setFontSize(sz || 9);
                    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
                    if (color) pdf.setTextColor(...color); else pdf.setTextColor(0,0,0);
                    const str = s(t);
                    if (maxW) {
                        const lines = pdf.splitTextToSize(str, maxW);
                        pdf.text(lines, x, y);
                        return lines.length;
                    }
                    pdf.text(str, x, y);
                    return 1;
                };
                const label = (t, x, y) => txt(t, x, y, 7, true,  [80,80,80]);
                const valor = (t, x, y, maxW) => txt(s(t).toUpperCase(), x, y, 9, false, [0,0,0], maxW);
                const secao = (t, y, h) => {
                    pdf.setFillColor(230,230,230);
                    pdf.rect(OX, y, PW, h, 'F');
                    pdf.setDrawColor(0); pdf.rect(OX, y, PW, h);
                    pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(0,0,0);
                    pdf.text(s(t), OX + PW/2, y + h - 1.5, {align:'center'});
                    pdf.setTextColor(0,0,0);
                    return y + h;
                };

                // Garante cor e fonte padrão
                pdf.setDrawColor(0,0,0);
                pdf.setLineWidth(0.3);

                // ══════════════════════════════════════════════════════════════
                // CABEÇALHO
                // ══════════════════════════════════════════════════════════════
                const hdrH = 24;  // altura ligeiramente maior para melhor respiro
                rect(OX, Y, PW, hdrH);

                // Divisores verticais: célula esquerda 15% | centro 60% | direita 25%
                const c1x = OX + PW * 0.15;          // x = 35mm
                const c2x = OX + PW * 0.75;          // x = 155mm
                linhav(c1x, Y, Y + hdrH);
                linhav(c2x, Y, Y + hdrH);

                // ── Centros exatos de cada célula ──────────────────────────
                // Célula esquerda: OX(5) até c1x(35) → largura 30mm
                const celEsqW = c1x - OX;            // 30mm
                // Célula centro: c1x(35) até c2x(155) → largura 120mm
                const ctrX = (c1x + c2x) / 2;        // 95mm  ← centro real da coluna
                // Célula direita: c2x(155) até OX+PW(205) → largura 50mm
                const celDirX  = c2x;                 // 155mm
                const celDirW  = (OX + PW) - c2x;    // 50mm
                const celDirCX = c2x + celDirW / 2;  // 180mm ← centro real da coluna direita

                // ── Brasão: centralizado na célula esquerda ────────────────
                const brasaoW = 15, brasaoH = 15;
                const brasaoX = OX + (celEsqW - brasaoW) / 2;        // centro H
                const brasaoY = Y  + (hdrH    - brasaoH) / 2;        // centro V
                try {
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width  = img.naturalWidth  || img.width;
                            canvas.height = img.naturalHeight || img.height;
                            canvas.getContext('2d').drawImage(img, 0, 0);
                            pdf.addImage(canvas.toDataURL('image/png'), 'PNG',
                                brasaoX, brasaoY, brasaoW, brasaoH);
                            resolve();
                        };
                        img.onerror = resolve;
                        img.src = 'brasao.jpg';
                    });
                } catch(e) {}

                // ── Logo da contratada: centralizada na célula direita ─────
                const cat = getCategoriaDemanda(d);
                const logoSrc = cat === 'PREDIAL' ? 'epura.jpg' : (cat === 'AR' ? 'igm2.jpg' : null);
                const logoW = 24, logoH = 9;
                const logoX = celDirCX - logoW / 2;   // centro H
                const logoY = Y + 3;                   // margem superior
                if (logoSrc) {
                    try {
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width  = img.naturalWidth  || img.width;
                                canvas.height = img.naturalHeight || img.height;
                                canvas.getContext('2d').drawImage(img, 0, 0);
                                pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG',
                                    logoX, logoY, logoW, logoH);
                                resolve();
                            };
                            img.onerror = resolve;
                            img.src = logoSrc;
                        });
                    } catch(e) {}
                }

                // ── Texto central — alinhado ao CENTRO da coluna do meio ──
                // (não ao centro da página inteira)
                const textoY1 = logoSrc ? Y + 5  : Y + 5;
                const textoY2 = logoSrc ? Y + 10 : Y + 10;
                const textoY3 = logoSrc ? Y + 14 : Y + 14;
                const textoY4 = logoSrc ? Y + 18 : Y + 18;

                pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(0,0,0);
                pdf.text('GOVERNO DO ESTADO DE SAO PAULO', ctrX, textoY1, {align:'center'});
                pdf.setFontSize(9);
                pdf.text('SECRETARIA DA EDUCACAO', ctrX, textoY2, {align:'center'});
                pdf.setFontSize(7.5); pdf.setFont('helvetica','normal');
                pdf.text('COORDENADORIA GERAL DE SUPORTE ADMINISTRATIVO', ctrX, textoY3, {align:'center'});
                pdf.text('DIVISAO DE ZELADORIA', ctrX, textoY4, {align:'center'});

                // ── Nº OS: centralizado na célula direita, abaixo do logo ─
                const osNum = d.numero_os ? d.numero_os : d.id;
                if (!logoSrc) {
                    // Sem logo: mostra "ORDEM DE SERVICO" acima do número
                    pdf.setFontSize(7.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(0,0,0);
                    pdf.text('ORDEM DE SERVICO', celDirCX, Y + 10, {align:'center'});
                }
                const numY = logoSrc ? logoY + logoH + 5 : Y + 17;
                pdf.setFontSize(13); pdf.setFont('helvetica','bold'); pdf.setTextColor(192,57,43);
                pdf.text(`No. ${osNum}`, celDirCX, numY, {align:'center'});
                pdf.setTextColor(0,0,0);

                pdf.setLineWidth(0.5); linhah(Y + hdrH); pdf.setLineWidth(0.3);
                Y += hdrH;

                // ══════════════════════════════════════════════════════════════
                // SEÇÃO 1 — IDENTIFICAÇÃO
                // ══════════════════════════════════════════════════════════════
                Y = secao('1. IDENTIFICAÇÃO DA SOLICITAÇÃO', Y, 5);

                const dataParts = (d.data || '').split('-');
                const dataBr = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : (d.data || '');

                // Linha: Data | Solicitante | Prioridade
                const r1h = 11;
                const r1c1 = OX + PW * 0.25;
                const r1c2 = OX + PW * 0.75;
                linhav(r1c1, Y, Y+r1h); linhav(r1c2, Y, Y+r1h);
                label('DATA E HORA DE ABERTURA', OX+1, Y+3.5);
                valor(`${dataBr}  ${d.hora||''}`, OX+1, Y+8, r1c1-OX-2);
                label('SOLICITANTE / CONTATO', r1c1+1, Y+3.5);
                valor(d.solicitante||'', r1c1+1, Y+8, r1c2-r1c1-2);
                label('PRIORIDADE NO SISTEMA', r1c2+1, Y+3.5);
                valor(d.prioridade||'', r1c2+1, Y+8);                linhah(Y+r1h); Y += r1h;

                // Linha: Setor | Status
                const r2h = 11;
                const r2c1 = OX + PW * 0.75;
                linhav(r2c1, Y, Y+r2h);
                label('UNIDADE / SETOR DE ORIGEM', OX+1, Y+3.5);
                valor(d.setor||'', OX+1, Y+8, r2c1-OX-2);
                label('STATUS ATUAL', r2c1+1, Y+3.5);
                valor(d.status||'', r2c1+1, Y+8);
                pdf.setLineWidth(0.5); linhah(Y+r2h); pdf.setLineWidth(0.3);
                Y += r2h;

                // ══════════════════════════════════════════════════════════════
                // SEÇÃO 2 — DESCRIÇÃO DA DEMANDA
                // ══════════════════════════════════════════════════════════════
                Y = secao('2. DESCRIÇÃO DA DEMANDA (PREENCHIMENTO PELO SISTEMA)', Y, 5);

                const titulo = s((d.titulo||'').toUpperCase());
                pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(0,0,0);
                const tLines = pdf.splitTextToSize(titulo, PW - 4);
                const descH  = Math.max(14, tLines.length * 5 + 5);
                pdf.text(tLines, OX+2, Y+6);
                pdf.setLineWidth(0.5); linhah(Y+descH); pdf.setLineWidth(0.3);
                Y += descH;

                // ══════════════════════════════════════════════════════════════
                // SEÇÃO 3 — EQUIPES E LOCAIS
                // ══════════════════════════════════════════════════════════════
                Y = secao('3. PARECER TÉCNICO E EXECUÇÃO (PREENCHIMENTO PELA EQUIPE)', Y, 5);

                // Checkboxes equipes (2 colunas)
                label('EQUIPE RESPONSÁVEL / CONTRATADA ATRIBUÍDA', OX+1, Y+4);
                const chks = montarCheckboxes(d);
                const equipes = [
                    [chks.limpeza,    'LIMPEZA PREDIAL'],
                    [chks.ar,         'AR CONDICIONADO'],
                    [chks.manut,      'MANUTENÇÃO PREDIAL'],
                    [chks.elevador,   'MANUT. DE ELEVADORES'],
                    [chks.ti,         'SUPORTE TI'],
                    [chks.telefonia,  'TELEFONIA'],
                    [chks.extintores, 'MANUT. E RECARGA EXTINTORES'],
                    ['[ ]',           'OUTROS: _______________________'],
                ];
                pdf.setFontSize(8); pdf.setFont('helvetica','normal');
                const colW3 = PW / 3;
                equipes.forEach((eq, i) => {
                    const col = i % 3;
                    const row = Math.floor(i / 3);
                    const ex  = OX + 2 + col * colW3;
                    const ey  = Y + 8 + row * 5.5;
                    const marcado = eq[0] === '[X]';
                    pdf.setFont('helvetica', marcado ? 'bold' : 'normal');
                    pdf.setTextColor(marcado ? 0 : 80, marcado ? 120 : 80, marcado ? 0 : 80);
                    pdf.text(`${eq[0]} ${s(eq[1])}`, ex, ey);
                });
                pdf.setTextColor(0,0,0);
                const eqH = Math.ceil(equipes.length / 3) * 5.5 + 11;
                linhah(Y+eqH); Y += eqH;

                // Checkboxes locais (4 colunas)
                label('LOCAL DE ATUAÇÃO / PRÉDIO VINCULADO', OX+1, Y+4);
                const locais = ['SEDE','AROUCHE','EFAPE','ARMENIA','CASA VERDE','SAO DOMINGOS','CAJAMAR','TENENTE PENA','CENTRO OESTE','CAPE'];
                pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(80,80,80);
                const colW4 = PW / 4;
                locais.forEach((loc, i) => {
                    const col = i % 4;
                    const row = Math.floor(i / 4);
                    pdf.text(`[ ] ${s(loc)}`, OX + 2 + col * colW4, Y + 8 + row * 5.5);
                });
                const rowsLoc = Math.ceil(locais.length / 4);
                pdf.text(`[ ] OUTRO: ______________________________`, OX + 2, Y + 8 + rowsLoc * 5.5);
                pdf.setTextColor(0,0,0);
                const locH = (rowsLoc + 1) * 5.5 + 10;
                pdf.setLineWidth(0.5); linhah(Y+locH); pdf.setLineWidth(0.3);
                Y += locH;

                // Campos de texto livres (Descrição serviços | Materiais)
                const camposMH = 35;
                const midX = OX + PW / 2;
                linhav(midX, Y, Y + camposMH);

                label('DESCRICAO DETALHADA DOS SERVICOS EXECUTADOS', OX+1, Y+4);
                if (descricao && descricao.trim()) {
                    pdf.setFontSize(8.5); pdf.setFont('helvetica','normal');
                    const dLines = pdf.splitTextToSize(s((descricao||'').toUpperCase()), midX - OX - 4);
                    pdf.text(dLines, OX+2, Y+9);
                }

                label('MATERIAIS E PECAS UTILIZADOS (REPOSICAO)', midX+1, Y+4);
                if (materiais && materiais.trim()) {
                    pdf.setFontSize(8.5); pdf.setFont('helvetica','normal');
                    const mLines = pdf.splitTextToSize(s((materiais||'').toUpperCase()), OX + PW - midX - 4);
                    pdf.text(mLines, midX+2, Y+9);
                }
                pdf.setLineWidth(0.5); linhah(Y+camposMH); pdf.setLineWidth(0.3);
                Y += camposMH;

                // ══════════════════════════════════════════════════════════════
                // SEÇÃO 4 — ENCERRAMENTO
                // ══════════════════════════════════════════════════════════════
                Y = secao('4. TERMO DE ENCERRAMENTO E ACEITE FISCAL', Y, 5);

                const enc4H = 14;
                const e1x = OX + PW * 0.25;
                const e2x = OX + PW * 0.50;
                linhav(e1x, Y, Y+enc4H); linhav(e2x, Y, Y+enc4H);
                label('INICIO DO ATENDIMENTO',   OX+1,  Y+3.5);
                pdf.setFontSize(8); pdf.text('___/___/20___ AS ___:___', OX+2, Y+9);
                label('TERMINO DO ATENDIMENTO',  e1x+1, Y+3.5);
                pdf.setFontSize(8); pdf.text('___/___/20___ AS ___:___', e1x+2, Y+9);
                label('OBSERVACOES FINAIS / PENDENCIAS', e2x+1, Y+3.5);
                linhah(Y+enc4H); Y += enc4H;

                // ══════════════════════════════════════════════════════════════
                // ASSINATURAS
                // ══════════════════════════════════════════════════════════════
                const sigH = 28;
                const sigW = PW / 3;
                linhav(OX + sigW,     Y, Y + sigH);
                linhav(OX + sigW * 2, Y, Y + sigH);

                const sigs = [
                    ['TECNICO EXECUTOR',        'Nome legivel / Matricula / Empresa'],
                    ['FISCAL',   'Carimbo e Assinatura'],
                    ['SOLICITANTE / RECEBEDOR',  'Atesto a conformidade do servico'],
                ];
                sigs.forEach((sig, i) => {
                    const sx = OX + 3 + i * sigW;
                    pdf.setLineWidth(0.2);
                    pdf.line(sx, Y + sigH - 10, sx + sigW - 6, Y + sigH - 10);
                    pdf.setLineWidth(0.3);
                    pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(0,0,0);
                    pdf.text(sig[0], sx + (sigW-6)/2, Y + sigH - 6, {align:'center'});
                    pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(80,80,80);
                    pdf.text(sig[1], sx + (sigW-6)/2, Y + sigH - 2.5, {align:'center'});
                    pdf.setTextColor(0,0,0);
                });
                linhah(Y + sigH); Y += sigH;

                // Borda externa da OS inteira
                pdf.setLineWidth(0.7);
                pdf.rect(OX, 8, PW, Y - 8);
                pdf.setLineWidth(0.3);

                // Rodapé
                const dataGeracao = new Date().toLocaleString('pt-BR');
                pdf.setFontSize(7); pdf.setFont('helvetica','italic'); pdf.setTextColor(100,100,100);
                pdf.text(`Documento gerado em ${dataGeracao}`, OX + PW/2, Y + 4, {align:'center'});

                // ── Salva ────────────────────────────────────────────────────
                const nomeArq = d.numero_os ? String(d.numero_os).replace(/[^a-zA-Z0-9]/g,'_') : d.id;
                pdf.save(`OS_${nomeArq}.pdf`);
                fecharModalImpressao();

            } catch (err) {
                console.error('Erro ao gerar PDF:', err);
                alert('Não foi possível gerar o PDF: ' + err.message);
            } finally {
                btnPDF.innerHTML = textoOriginal;
                btnPDF.disabled  = false;
            }
        }

        /* Gera o HTML completo da O.S. com URL base absoluta para que
           imagens (brasao.jpg, epura.jpg, igm2.jpg) carreguem corretamente
           em nova aba/janela sem contexto de origem. */
        function gerarHTMLOS(id, descricao, materiais) {
            const d = montarDadosOS(id);
            if (!d) return '<html><body><p>Erro: OS não encontrada.</p></body></html>';

            // URL base absoluta — resolve imagens relativas na nova janela
            const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

            const dataParts = d.data.split('-');
            const dataBr = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : d.data;
            const logoInfo = getLogoInfoParaOS(d);
            const chks = montarCheckboxes(d);

            const logoHTML = logoInfo
                ? `<img src="${logoInfo.src}" style="width:${logoInfo.width};height:${logoInfo.height};object-fit:${logoInfo.fit};display:block;margin-bottom:5px;" onerror="this.style.display='none'">`
                : '';
            const topTextHTML = logoInfo ? '' : '<p style="margin:0;font-size:12px;font-weight:bold;margin-bottom:5px;">ORDEM DE SERVIÇO</p>';
            const osLabel = logoInfo ? 'O.S Nº ' : 'Nº ';
            const osNum = d.numero_os ? d.numero_os : d.id;
            // [X] marcado fica verde-negrito, como no DOCX de referência
            const ck = (m, txt) => m === '[X]'
                ? `<span class="ck-on">[X] ${txt}</span>`
                : `[ ] ${txt}`;

            return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<base href="${baseHref}">
<title>O.S. ${esc(osNum)}</title>
<style>
  /* Réplica fiel do DOCX OS_4859: tabela 200mm, 7 colunas, alturas exatas */
  /* A4 margem 10mm: o conteúdo (190mm) cabe folgado na área imprimível de
     QUALQUER destino (inclui Microsoft Print to PDF), sem o Chrome escalar. */
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { margin: 0; height: 100%; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  .sheet { width: 190mm; height: 100%; margin: 0 auto; }
  table.os { width: 190mm; height: calc(100% - 6mm); margin: 0 auto; border-collapse: collapse; table-layout: fixed; border: 1.5pt solid #000; }
  table.os td { border: 0.5pt solid #000; vertical-align: top; padding: 1mm 2mm; }
  td.sec { background: #E5E5E5; text-align: center; font-weight: bold; font-size: 8pt; vertical-align: middle; padding: 0.6mm 2mm; }
  .lbl { display: block; font-size: 7pt; font-weight: bold; color: #505050; margin-bottom: 1mm; }
  .val { font-size: 9pt; text-transform: uppercase; }
  .val.big { font-size: 10pt; font-weight: bold; }
  td.hdr-brasao { text-align: center; vertical-align: middle; }
  td.hdr-brasao img { height: 17mm; width: auto; }
  td.hdr-centro { text-align: center; vertical-align: middle; }
  .h-gov { font-size: 10pt; font-weight: bold; }
  .h-sec { font-size: 9pt; font-weight: bold; }
  .h-coord { font-size: 7pt; margin-top: 0.5mm; }
  td.hdr-num { text-align: center; vertical-align: middle; }
  td.hdr-num img { max-width: 44mm; }
  .os-num { color: #C0392B; font-size: 13pt; font-weight: bold; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8mm 2mm; font-size: 8pt; color: #505050; margin-top: 1.4mm; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 2mm; font-size: 8pt; color: #505050; margin-top: 1.4mm; }
  .ck-on { color: #007800; font-weight: bold; }
  .fill-lines { font-size: 8pt; font-weight: bold; color: #505050; margin-top: 1.6mm; }
  /* Assinaturas: flex com 3 colunas iguais, linhas no mesmo nível,
     texto centralizado — alinhamento idêntico em tela, impressão e PDF. */
  .sig-row { display: flex; width: 100%; height: 27.4mm; }
  .sig-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; text-align: center; padding: 0 5mm 2.5mm; }
  .sig-col + .sig-col { border-left: 0.5pt solid #000; }
  .sig-line { width: 88%; border-top: 0.75pt solid #000; margin-bottom: 1.2mm; }
  .sig-name { font-size: 8pt; font-weight: bold; white-space: nowrap; }
  .sig-sub { font-size: 7pt; color: #505050; margin-top: 0.5mm; white-space: nowrap; }
  .footer { text-align: center; font-size: 7.5pt; font-style: italic; margin-top: 2.5mm; color: #555; }
  /* Botão fechar — visível na tela, oculto na impressão */
  #btn-fechar { position: fixed; top: 10px; right: 10px; background: #ef4444; color: white; border: none;
    padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; z-index: 9999; }
  @media print { #btn-fechar { display: none !important; } }
</style>
</head>
<body>
<button id="btn-fechar" onclick="window.close()">\u2715 Fechar</button>

<div class="sheet">
<table class="os">
  <colgroup><col style="width:15%"><col style="width:10%"><col style="width:8.35%"><col style="width:16.65%"><col style="width:16.65%"><col style="width:8.35%"><col style="width:25%"></colgroup>
  <tr style="height:23.3mm;">
    <td class="hdr-brasao"><img src="brasao.jpg" alt="SP" onerror="this.style.display='none'"></td>
    <td class="hdr-centro" colspan="5">
      <div class="h-gov">GOVERNO DO ESTADO DE S\u00C3O PAULO</div>
      <div class="h-sec">SECRETARIA DA EDUCA\u00C7\u00C3O</div>
      <div class="h-coord">COORDENADORIA GERAL DE SUPORTE ADMINISTRATIVO - DIVIS\u00C3O DE ZELADORIA</div>
    </td>
    <td class="hdr-num">${topTextHTML}${logoHTML}<div class="os-num">${osLabel}${esc(osNum)}</div></td>
  </tr>
  <tr style="height:4.6mm;"><td class="sec" colspan="7">1. IDENTIFICA\u00C7\u00C3O DA SOLICITA\u00C7\u00C3O</td></tr>
  <tr style="height:10.6mm;">
    <td colspan="2"><span class="lbl">DATA E HORA DE ABERTURA</span><span class="val">${esc(dataBr)}  ${esc(d.hora) || '--:--'}</span></td>
    <td colspan="4"><span class="lbl">SOLICITANTE / CONTATO</span><span class="val">${esc((d.solicitante||'').toUpperCase())}</span></td>
    <td><span class="lbl">PRIORIDADE NO SISTEMA</span><span class="val">${esc((d.prioridade||'').toUpperCase())}</span></td>
  </tr>
  <tr style="height:10.5mm;">
    <td colspan="6"><span class="lbl">UNIDADE / SETOR DE ORIGEM</span><span class="val">${esc((d.setor||'').toUpperCase())}</span></td>
    <td><span class="lbl">STATUS ATUAL</span><span class="val">${esc((d.status||'').toUpperCase())}</span></td>
  </tr>
  <tr style="height:4.6mm;"><td class="sec" colspan="7">2. DESCRI\u00C7\u00C3O DA DEMANDA (PREENCHIMENTO PELO SISTEMA)</td></tr>
  <tr style="height:13.5mm;"><td colspan="7"><span class="val big">${esc((d.titulo||'').toUpperCase())}</span></td></tr>
  <tr style="height:4.6mm;"><td class="sec" colspan="7">3. PARECER T\u00C9CNICO E EXECU\u00C7\u00C3O (PREENCHIMENTO PELA EQUIPE)</td></tr>
  <tr style="height:27.1mm;">
    <td colspan="7">
      <span class="lbl">EQUIPE RESPONS\u00C1VEL / CONTRATADA ATRIBU\u00CDDA</span>
      <div class="grid3">
        <div>${ck(chks.limpeza,'LIMPEZA PREDIAL')}</div>
        <div>${ck(chks.ar,'AR CONDICIONADO')}</div>
        <div>${ck(chks.manut,'MANUTEN\u00C7\u00C3O PREDIAL')}</div>
        <div>${ck(chks.elevador,'MANUT. DE ELEVADORES')}</div>
        <div>${ck(chks.ti,'SUPORTE TI')}</div>
        <div>${ck(chks.telefonia,'TELEFONIA')}</div>
        <div>${ck(chks.extintores,'MANUT. E RECARGA EXTINTORES')}</div>
        <div style="grid-column:span 2;">[ ] OUTROS: __________________________________</div>
      </div>
    </td>
  </tr>
  <tr style="height:31.6mm;">
    <td colspan="7">
      <span class="lbl">LOCAL DE ATUA\u00C7\u00C3O / PR\u00C9DIO VINCULADO</span>
      <div class="grid4">
        <div>[ ] SEDE</div><div>[ ] AROUCHE</div><div>[ ] EFAPE</div><div>[ ] ARM\u00CANIA</div>
        <div>[ ] CASA VERDE</div><div>[ ] S\u00C3O DOMINGOS</div><div>[ ] CAJAMAR</div><div>[ ] TENENTE PENA</div>
        <div>[ ] CENTRO OESTE</div><div>[ ] CAPE</div>
        <div style="grid-column:span 2;">[ ] OUTRO: ______________________________________</div>
      </div>
    </td>
  </tr>
  <tr>
    <td colspan="4" style="height:100%;"><span class="lbl">DESCRI\u00C7\u00C3O DETALHADA DOS SERVI\u00C7OS EXECUTADOS</span><div style="font-size:9pt;white-space:pre-wrap;margin-top:1mm;">${esc((descricao||'').toUpperCase())}</div></td>
    <td colspan="3" style="height:100%;"><span class="lbl">MATERIAIS E PE\u00C7AS UTILIZADOS (REPOSI\u00C7\u00C3O)</span><div style="font-size:9pt;white-space:pre-wrap;margin-top:1mm;">${esc((materiais||'').toUpperCase())}</div></td>
  </tr>
  <tr style="height:4.6mm;"><td class="sec" colspan="7">4. TERMO DE ENCERRAMENTO E ACEITE FISCAL</td></tr>
  <tr style="height:19.5mm;">
    <td colspan="2"><span class="lbl">IN\u00CDCIO DO ATENDIMENTO</span><div class="fill-lines">___/___/20___ \u00C0S ___:___</div></td>
    <td colspan="2"><span class="lbl">T\u00C9RMINO DO ATENDIMENTO</span><div class="fill-lines">___/___/20___ \u00C0S ___:___</div></td>
    <td colspan="3"><span class="lbl">OBSERVA\u00C7\u00D5ES FINAIS / PEND\u00CANCIAS</span></td>
  </tr>
  <tr style="height:27.4mm;">
    <td colspan="7" style="padding:0;">
      <div class="sig-row">
        <div class="sig-col"><div class="sig-line"></div><div class="sig-name">T\u00C9CNICO EXECUTOR</div><div class="sig-sub">Nome leg\u00EDvel / Matr\u00EDcula / Empresa</div></div>
        <div class="sig-col"><div class="sig-line"></div><div class="sig-name">FISCAL</div><div class="sig-sub">Carimbo e Assinatura</div></div>
        <div class="sig-col"><div class="sig-line"></div><div class="sig-name">SOLICITANTE / RECEBEDOR</div><div class="sig-sub">Atesto a conformidade do servi\u00E7o</div></div>
      </div>
    </td>
  </tr>
</table>
<div class="footer">Documento gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>

<script>
  // Espera imagens carregarem antes de imprimir para evitar página em branco
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

        /* Fallback: overlay full-screen quando popup está bloqueado */
        function imprimirViaOverlay(html) {
            /* FIX SCROLL iOS/Android:
               iframe com height:100% dentro de position:fixed nao rola no Safari (bug WebKit).
               Solucao: overlay com overflow-y:auto + conteudo em div direta (sem iframe).
               Barra de acoes com position:sticky fica visivel durante todo o scroll. */
            const antigo = document.getElementById('os-print-overlay');
            if (antigo) antigo.remove();

            const overlay = document.createElement('div');
            overlay.id = 'os-print-overlay';
            overlay.style.cssText = [
                'position:fixed;inset:0;background:white;z-index:999999;',
                'overflow-y:auto;-webkit-overflow-scrolling:touch;',
                'display:flex;flex-direction:column;'
            ].join('');

            // Barra de acoes sticky -- sempre visivel durante o scroll
            const barraAcoes = document.createElement('div');
            barraAcoes.style.cssText = [
                'position:sticky;top:0;z-index:999998;',
                'background:rgba(255,255,255,0.97);backdrop-filter:blur(4px);',
                'display:flex;justify-content:flex-end;gap:8px;',
                'padding:8px 12px;border-bottom:1px solid #e2e8f0;',
                'box-shadow:0 2px 8px rgba(0,0,0,0.08);flex-shrink:0;'
            ].join('');

            const btnImprimir = document.createElement('button');
            btnImprimir.textContent = 'Imprimir';
            btnImprimir.style.cssText = [
                'background:#1e3a5f;color:white;border:none;padding:10px 16px;',
                'border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;'
            ].join('');
            btnImprimir.onclick = () => {
                barraAcoes.style.display = 'none';
                window.print();
                barraAcoes.style.display = 'flex';
            };

            const btnFechar = document.createElement('button');
            btnFechar.textContent = 'Fechar';
            btnFechar.style.cssText = [
                'background:#ef4444;color:white;border:none;padding:10px 16px;',
                'border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;'
            ].join('');
            btnFechar.onclick = () => {
                overlay.remove();
                document.body.style.overflow = '';
            };

            barraAcoes.appendChild(btnImprimir);
            barraAcoes.appendChild(btnFechar);
            overlay.appendChild(barraAcoes);

            // Conteudo renderizado em div (sem iframe = sem trava de scroll iOS)
            const conteudo = document.createElement('div');
            conteudo.style.cssText = 'flex:1;padding:16px;';
            const stripped = html
                .replace(/<!DOCTYPE[^>]*>/gi, '')
                .replace(/<html[^>]*>/gi, '')
                .replace(/<\/html>/gi, '')
                .replace(/<head>[\s\S]*?<\/head>/gi, '')
                .replace(/<body[^>]*>/gi, '')
                .replace(/<\/body>/gi, '');
            conteudo.innerHTML = stripped;
            // Oculta o botao Fechar interno que o gerarHTMLOS injeta (substituido pela barra acima)
            const btnInt = conteudo.querySelector('#btn-fechar');
            if (btnInt) btnInt.style.display = 'none';

            overlay.appendChild(conteudo);
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden'; // evita scroll duplo no body
        }

        window.imprimirDashboard = function() {
            document.body.classList.add('printing-dashboard');
            Object.values(Chart.instances).forEach(chart => chart.resize());
            setTimeout(function() { window.print(); }, 500);
            window.onafterprint = function() { document.body.classList.remove('printing-dashboard'); Object.values(Chart.instances).forEach(chart => chart.resize()); };
            setTimeout(function() { document.body.classList.remove('printing-dashboard'); Object.values(Chart.instances).forEach(chart => chart.resize()); }, 5000);
        }

        // ════════════════════════════════════════════════════════════════
        // PDF DASHBOARD — Relatório Consolidado em PDF formatado (jsPDF puro)
        // Layout institucional preto/branco no padrão da R.O.
        // ════════════════════════════════════════════════════════════════
        window.gerarPDFDashboard = async function() {
            const escCats = dashCategoriasPermitidas();
            const semRestr = escCats === null;
            if (!semRestr && !pode('dashboard', 'exportar')) { alert('Você não tem permissão para baixar o relatório.'); return; }
            try {
                if (typeof showToast === 'function') showToast('Gerando PDF...', 'info');
                await ensureJsPDF();
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                const PW = pdf.internal.pageSize.getWidth();   // 210
                const PH = pdf.internal.pageSize.getHeight();  // 297
                const M = 12;

                // Sanitiza string para helvetica (sem acentos / unicode)
                const s = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x00-\x7F]/g,'');

                // ─── DADOS / FILTRO ───────────────────────────────────────
                const filtroMes = (document.getElementById('dash-filtro-mes') || {}).value || '';
                let periodoLabel = 'Todos os Periodos';
                if (filtroMes) {
                    const [y, m] = filtroMes.split('-');
                    const meses = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                    periodoLabel = meses[parseInt(m,10)-1] + ' / ' + y;
                }
                if (!semRestr) periodoLabel += '  |  Escopo: ' + (escCats.length ? escCats.join(', ') : 'Sem areas atribuidas');

                const listaDemandas   = (demandasEscopoDash() || []).filter(d => !filtroMes || (d.data||'').startsWith(filtroMes));
                const listaFrota      = (frota      || []).filter(f => !filtroMes || (f.hora_inicial||'').startsWith(filtroMes));
                const listaVisitantes = (visitantes || []).filter(v => !filtroMes || (v.entrada||'').startsWith(filtroMes));
                const listaEventos    = (eventos    || []).filter(e => !filtroMes || (e.data||'').startsWith(filtroMes));
                const listaCrachas    = (crachas    || []).filter(c => !filtroMes || (c.data_solicitacao||'').startsWith(filtroMes));

                let counts = { 'AR': 0, 'PREDIAL': 0, 'LIMPEZA': 0, 'RAMAL': 0, 'OUTROS': 0 };
                listaDemandas.forEach(d => { const cat = getCategoriaDemanda(d); counts[cat] = (counts[cat] || 0) + 1; });

                const totalManutencao = counts['PREDIAL'] + counts['AR'];
                const totalGeral = listaFrota.length + listaVisitantes.length + listaDemandas.length + listaEventos.length + listaCrachas.length;
                const publicoEventos = listaEventos.reduce((sum, e) => sum + (parseInt(e.publico) || 0), 0);

                const dPend = listaDemandas.filter(d => d.status === 'Pendente').length;
                const dAnd  = listaDemandas.filter(d => d.status === 'Em Andamento').length;
                const dConc = listaDemandas.filter(d => d.status === 'Concluído').length;

                // ─── MÉTRICAS DE SLA (mesma engine do dashboard) ──────────
                const sla = computeDashboardSLA(listaDemandas);
                // formata duração para o PDF (sem unicode): "Xh" ou "X,Xd"
                const fmtDur = (h) => {
                    if (h == null || isNaN(h)) return '--';
                    if (h < 1)  return '<1h';
                    if (h < 24) return Math.round(h) + 'h';
                    return (h/24).toFixed(1).replace('.', ',') + 'd';
                };

                // ═══════════════════════════════════════════════════════════
                // LAYOUT COMPACTO — TUDO EM 1 PÁGINA A4
                // Espaço total disponível: ~265mm (após margens + footer)
                // ═══════════════════════════════════════════════════════════

                // ─── CABEÇALHO (24mm) ────────────────────────────────────
                const brasao = await getBrasaoDataURL();
                const brasaoW = 18;  // mm
                const brasaoH = 22;
                const headerH = 24;

                if (brasao) {
                    try {
                        pdf.addImage(brasao, 'PNG', M, M, brasaoW, brasaoH);
                    } catch(e) { console.warn('addImage brasao falhou:', e); }
                } else {
                    pdf.setDrawColor(80); pdf.setLineWidth(0.4);
                    pdf.rect(M, M, brasaoW, brasaoH);
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.setTextColor(80);
                    pdf.text('SP', M + brasaoW/2, M + brasaoH/2 + 2, { align:'center' });
                    pdf.setTextColor(0);
                }

                // Texto institucional centralizado entre brasao e margem direita
                const centerX = M + brasaoW + ((PW - M) - (M + brasaoW)) / 2;
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('GOVERNO DO ESTADO DE SAO PAULO', centerX, M+6, { align:'center' });
                pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5);
                pdf.text('SECRETARIA DE EDUCACAO', centerX, M+12, { align:'center' });
                pdf.setFont('helvetica','bold'); pdf.setFontSize(9.5);
                pdf.text('DIVISAO DE ZELADORIA - DZEL', centerX, M+18, { align:'center' });

                // Linha divisoria
                pdf.setLineWidth(0.5); pdf.setDrawColor(0);
                pdf.line(M, M + headerH, PW-M, M + headerH);

                // Titulo
                pdf.setFont('helvetica','bold'); pdf.setFontSize(13);
                pdf.text('RELATORIO CONSOLIDADO', PW/2, M + headerH + 7, { align:'center' });
                pdf.setFont('helvetica','normal'); pdf.setFontSize(8.5);
                pdf.text('Periodo: ' + s(periodoLabel), PW/2, M + headerH + 12, { align:'center' });

                let y = M + headerH + 17;  // y inicial: ~53mm

                // ─── KPIs OPERACIONAIS / SLA — 5 cards (22mm) ────────────
                const slaPctTxt = sla.slaPct == null ? '--' : sla.slaPct + '%';
                const kpis = [
                    { label: 'TEMPO MEDIO ATEND.', value: fmtDur(sla.tma),   sub: sla.tma == null ? 'Sem dados' : sla.concluidasValidas + ' concluidas' },
                    { label: 'TEMPO 1a RESPOSTA',  value: fmtDur(sla.tmpr),  sub: sla.tmpr == null ? 'Sem dados' : sla.respCount + ' atendidas' },
                    { label: 'SLA CUMPRIDO',       value: slaPctTxt,         sub: 'Meta A1d M3d B7d uteis' },
                    { label: 'BACKLOG ABERTO',     value: String(sla.backlog),  sub: 'Pendentes + andamento' },
                    { label: 'SLA VENCIDO',        value: String(sla.vencidas), sub: 'Abertas fora do prazo' }
                ];
                const cardW = (PW - 2*M - (kpis.length-1)*2) / kpis.length;
                const cardH = 22;
                kpis.forEach((kpi, i) => {
                    const x = M + i * (cardW + 2);
                    pdf.setDrawColor(0); pdf.setLineWidth(0.4);
                    // fundo levemente colorido p/ os dois cards de alerta
                    if (kpi.label === 'SLA VENCIDO' && sla.vencidas > 0) pdf.setFillColor(254, 242, 242);
                    else if (kpi.label === 'SLA CUMPRIDO' && sla.slaPct != null) {
                        if (sla.slaPct >= 90) pdf.setFillColor(240, 253, 244);
                        else if (sla.slaPct >= 70) pdf.setFillColor(254, 252, 232);
                        else pdf.setFillColor(254, 242, 242);
                    } else pdf.setFillColor(248, 250, 252);
                    pdf.rect(x, y, cardW, cardH, 'F');
                    pdf.rect(x, y, cardW, cardH);
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(6); pdf.setTextColor(60);
                    pdf.text(s(kpi.label), x+2, y+4.5);
                    pdf.setFontSize(15); pdf.setTextColor(0);
                    // vermelho no valor de SLA vencido > 0
                    if (kpi.label === 'SLA VENCIDO' && sla.vencidas > 0) pdf.setTextColor(180, 30, 30);
                    pdf.text(kpi.value, x+2, y+13.5);
                    pdf.setTextColor(0);
                    pdf.setFont('helvetica','normal'); pdf.setFontSize(6); pdf.setTextColor(90);
                    pdf.text(s(kpi.sub), x+2, y+18.5);
                    pdf.setTextColor(0);
                });
                y += cardH + 6;

                // rowH usado por todas as tabelas do PDF
                const rowH = 7;

                // ─── ENVELHECIMENTO DO BACKLOG — 4 caixas (18mm) ─────────
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('ENVELHECIMENTO DO BACKLOG (EM ABERTO)', M, y);
                y += 4;

                const maisAntigaDias = sla.maisAntigaItem ? Math.floor(sla.maisAntigaDias) : 0;
                const statusBoxes = [
                    { lbl: 'EM DIA (0-2d)',    val: sla.bucket02, fill: [220, 252, 231], stroke: [30, 130, 80] },
                    { lbl: 'ATENCAO (3-7d)',   val: sla.bucket37, fill: [254, 249, 195], stroke: [180, 140, 30] },
                    { lbl: 'CRITICO (+7d)',    val: sla.bucket7,  fill: [254, 226, 226], stroke: [180, 50, 50] },
                    { lbl: 'MAIS ANTIGA',      val: maisAntigaDias + 'd', fill: [241, 245, 249], stroke: [80, 90, 110] }
                ];
                const stCardW = (PW - 2*M - 6) / 4;
                const stCardH = 18;
                statusBoxes.forEach((sb, i) => {
                    const x = M + i * (stCardW + 2);
                    pdf.setFillColor(...sb.fill);
                    pdf.rect(x, y, stCardW, stCardH, 'F');
                    pdf.setDrawColor(...sb.stroke); pdf.setLineWidth(0.4);
                    pdf.rect(x, y, stCardW, stCardH);
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(7.5); pdf.setTextColor(40);
                    pdf.text(s(sb.lbl), x+3, y+5);
                    pdf.setFontSize(15); pdf.setTextColor(0);
                    pdf.text(String(sb.val), x+3, y+14);
                });
                y += stCardH + 7;

                // ─── PERFORMANCE POR CONTRATADA (tabela) ─────────────────
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('PERFORMANCE POR CONTRATADA', M, y);
                y += 4;

                pdf.setFillColor(30, 41, 59); pdf.rect(M, y, PW-2*M, 7, 'F');
                pdf.setFont('helvetica','bold'); pdf.setFontSize(8); pdf.setTextColor(255);
                pdf.text('CONTRATADA',  M+3,                       y+5);
                pdf.text('TOTAL',       M + (PW-2*M)*0.45,         y+5);
                pdf.text('ABERTO',      M + (PW-2*M)*0.58,         y+5);
                pdf.text('TMA',         M + (PW-2*M)*0.72,         y+5);
                pdf.text('% SLA',       M + (PW-2*M)*0.87,         y+5);
                pdf.setTextColor(0);
                y += 7;

                const contrLista = sla.contratadas.slice(0, 8);
                const cStart = y;
                if (!contrLista.length) {
                    pdf.setFont('helvetica','italic'); pdf.setFontSize(8.5); pdf.setTextColor(120);
                    pdf.text('Nenhuma demanda no periodo.', M+3, y+5);
                    pdf.setTextColor(0); y += 7;
                } else {
                    contrLista.forEach((c, i) => {
                        if (i % 2 === 0) { pdf.setFillColor(245, 248, 252); pdf.rect(M, y, PW-2*M, rowH, 'F'); }
                        pdf.setFont('helvetica','bold'); pdf.setFontSize(8.5); pdf.setTextColor(0);
                        const nome = s(c.nome).slice(0, 40);
                        pdf.text(nome, M+3, y+4.8);
                        pdf.setFont('helvetica','normal');
                        pdf.text(String(c.total),   M + (PW-2*M)*0.45, y+4.8);
                        pdf.text(String(c.abertas), M + (PW-2*M)*0.58, y+4.8);
                        pdf.text(fmtDur(c.tma),     M + (PW-2*M)*0.72, y+4.8);
                        // % SLA com cor
                        const slaT = c.slaPct == null ? '--' : c.slaPct + '%';
                        if (c.slaPct != null) {
                            if (c.slaPct >= 90) pdf.setTextColor(20, 120, 70);
                            else if (c.slaPct >= 70) pdf.setTextColor(160, 120, 20);
                            else pdf.setTextColor(180, 40, 40);
                        }
                        pdf.setFont('helvetica','bold');
                        pdf.text(slaT, M + (PW-2*M)*0.87, y+4.8);
                        pdf.setTextColor(0);
                        y += rowH;
                    });
                }
                pdf.setDrawColor(180); pdf.setLineWidth(0.3);
                pdf.rect(M, cStart-7, PW-2*M, (contrLista.length||1)*rowH + 7);
                y += 6;

                // ─── PÁGINA 2 (volume, categoria, contexto) ──────────────
                pdf.addPage();
                y = M;
                // mini-cabecalho da pagina 2
                pdf.setFont('helvetica','bold'); pdf.setFontSize(10); pdf.setTextColor(0);
                pdf.text('RELATORIO CONSOLIDADO - DETALHAMENTO', PW/2, y+4, { align:'center' });
                pdf.setLineWidth(0.4); pdf.setDrawColor(150);
                pdf.line(M, y+7, PW-M, y+7);
                y += 14;

                // ─── VOLUME POR SETOR (pagina 2) ─────────────────────────
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('VOLUME DE ATENDIMENTO POR SETOR', M, y);
                y += 4;

                const setores = [];
                if (semRestr || escCats.includes('PREDIAL')) setores.push({ nome: 'Manutencao Predial', valor: counts['PREDIAL'] });
                if (semRestr || escCats.includes('AR'))      setores.push({ nome: 'Ar Condicionado',    valor: counts['AR'] });
                if (semRestr || escCats.includes('LIMPEZA')) setores.push({ nome: 'Limpeza / Copa',     valor: counts['LIMPEZA'] });
                if (semRestr || pode('crachas', 'ver'))      setores.push({ nome: 'Crachas',            valor: listaCrachas.length });
                if (semRestr)                                setores.push({ nome: 'Ramais',             valor: counts['RAMAL'] });
                if (semRestr || pode('veiculos', 'ver'))     setores.push({ nome: 'Garagem',            valor: listaFrota.length });
                if (semRestr || pode('visitantes', 'ver'))   setores.push({ nome: 'Recepcao',           valor: listaVisitantes.length });
                if (semRestr || pode('eventos', 'ver'))      setores.push({ nome: 'Eventos',            valor: listaEventos.length });
                setores.sort((a,b) => b.valor - a.valor);
                const maxVal = Math.max(...setores.map(x => x.valor), 1);

                pdf.setFillColor(30, 41, 59); pdf.rect(M, y, PW-2*M, 7, 'F');
                pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(255);
                pdf.text('SETOR', M+3, y+5);
                pdf.text('VOLUME', M + (PW-2*M)*0.45, y+5);
                pdf.text('TOTAL', PW-M-12, y+5, { align:'right' });
                pdf.setTextColor(0);
                y += 7;

                const volStartY = y;
                setores.forEach((it, i) => {
                    if (i % 2 === 0) { pdf.setFillColor(245, 248, 252); pdf.rect(M, y, PW-2*M, rowH, 'F'); }
                    pdf.setFont('helvetica','normal'); pdf.setFontSize(9); pdf.setTextColor(0);
                    pdf.text(s(it.nome), M+3, y+4.8);
                    const barX = M + (PW-2*M)*0.45;
                    const barMaxW = (PW-2*M)*0.40;
                    const barW = (it.valor / maxVal) * barMaxW;
                    pdf.setFillColor(220, 230, 245);
                    pdf.rect(barX, y+1.8, barMaxW, 3.2, 'F');
                    pdf.setFillColor(59, 130, 246);
                    pdf.rect(barX, y+1.8, Math.max(barW, 0.3), 3.2, 'F');
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(9);
                    pdf.text(String(it.valor), PW-M-3, y+4.8, { align:'right' });
                    y += rowH;
                });
                pdf.setDrawColor(180); pdf.setLineWidth(0.3);
                pdf.rect(M, volStartY-7, PW-2*M, setores.length*rowH + 7);
                y += 8;

                // ─── DEMANDAS MAIS ANTIGAS EM ABERTO (pagina 2) ──────────
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('DEMANDAS MAIS ANTIGAS EM ABERTO', M, y);
                y += 4;

                pdf.setFillColor(30, 41, 59); pdf.rect(M, y, PW-2*M, 7, 'F');
                pdf.setFont('helvetica','bold'); pdf.setFontSize(8); pdf.setTextColor(255);
                pdf.text('O.S.',       M+3,                       y+5);
                pdf.text('DESCRICAO',  M + (PW-2*M)*0.13,         y+5);
                pdf.text('SETOR',      M + (PW-2*M)*0.55,         y+5);
                pdf.text('PRIOR.',     M + (PW-2*M)*0.78,         y+5);
                pdf.text('DIAS',       PW-M-3,                    y+5, { align:'right' });
                pdf.setTextColor(0);
                y += 7;

                const antStart = y;
                if (!sla.topAntigas.length) {
                    pdf.setFont('helvetica','italic'); pdf.setFontSize(8.5); pdf.setTextColor(120);
                    pdf.text('Nenhuma demanda em aberto.', M+3, y+5);
                    pdf.setTextColor(0); y += 7;
                } else {
                    sla.topAntigas.forEach((x, i) => {
                        const d = x.d; const dias = Math.floor(x.idade/24);
                        const venceu = x.idade > metaSLA(d);
                        if (i % 2 === 0) { pdf.setFillColor(245, 248, 252); pdf.rect(M, y, PW-2*M, rowH, 'F'); }
                        pdf.setFont('helvetica','bold'); pdf.setFontSize(8.5); pdf.setTextColor(0);
                        pdf.text(s(d.numero_os || '--').slice(0,10), M+3, y+4.8);
                        pdf.setFont('helvetica','normal');
                        pdf.text(s(d.titulo || '').slice(0, 38), M + (PW-2*M)*0.13, y+4.8);
                        pdf.text(s(d.setor || '').slice(0, 18),  M + (PW-2*M)*0.55, y+4.8);
                        pdf.text(s(d.prioridade || 'Baixa'),     M + (PW-2*M)*0.78, y+4.8);
                        if (venceu) pdf.setTextColor(180, 40, 40);
                        pdf.setFont('helvetica','bold');
                        pdf.text(String(dias) + (venceu ? '!' : ''), PW-M-3, y+4.8, { align:'right' });
                        pdf.setTextColor(0);
                        y += rowH;
                    });
                }
                pdf.setDrawColor(180); pdf.setLineWidth(0.3);
                pdf.rect(M, antStart-7, PW-2*M, (sla.topAntigas.length||1)*rowH + 7);
                y += 8;

                // ─── DETALHAMENTO POR CATEGORIA TECNICA ──────────────────
                pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                pdf.text('DETALHAMENTO POR CATEGORIA TECNICA', M, y);
                y += 4;

                const cats = [];
                if (semRestr || escCats.includes('PREDIAL')) cats.push({ nome: 'PREDIAL', list: listaDemandas.filter(d => getCategoriaDemanda(d) === 'PREDIAL') });
                if (semRestr || escCats.includes('AR'))      cats.push({ nome: 'AR CONDICIONADO', list: listaDemandas.filter(d => getCategoriaDemanda(d) === 'AR') });
                if (semRestr || escCats.includes('LIMPEZA')) cats.push({ nome: 'LIMPEZA', list: listaDemandas.filter(d => getCategoriaDemanda(d) === 'LIMPEZA') });

                pdf.setFillColor(30, 41, 59); pdf.rect(M, y, PW-2*M, 7, 'F');
                pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(255);
                pdf.text('CATEGORIA',   M+3,                       y+5);
                pdf.text('TOTAL',       M + (PW-2*M)*0.35,         y+5);
                pdf.text('PENDENTE',    M + (PW-2*M)*0.50,         y+5);
                pdf.text('ANDAMENTO',   M + (PW-2*M)*0.68,         y+5);
                pdf.text('CONCLUIDO',   M + (PW-2*M)*0.86,         y+5);
                pdf.setTextColor(0);
                y += 7;

                const catStart = y;
                cats.forEach((c, i) => {
                    if (i % 2 === 0) {
                        pdf.setFillColor(245, 248, 252);
                        pdf.rect(M, y, PW-2*M, rowH, 'F');
                    }
                    const p = c.list.filter(d => d.status === 'Pendente').length;
                    const a = c.list.filter(d => d.status === 'Em Andamento').length;
                    const cc = c.list.filter(d => d.status === 'Concluído').length;
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(9); pdf.setTextColor(0);
                    pdf.text(s(c.nome),       M+3,                       y+4.8);
                    pdf.setFont('helvetica','normal');
                    pdf.text(String(c.list.length), M + (PW-2*M)*0.35,   y+4.8);
                    pdf.text(String(p),        M + (PW-2*M)*0.50,        y+4.8);
                    pdf.text(String(a),        M + (PW-2*M)*0.68,        y+4.8);
                    pdf.text(String(cc),       M + (PW-2*M)*0.86,        y+4.8);
                    y += rowH;
                });
                pdf.setDrawColor(180); pdf.setLineWidth(0.3);
                pdf.rect(M, catStart-7, PW-2*M, cats.length*rowH + 7);
                y += 6;

                // ─── INDICADORES OPERACIONAIS — mini-cards (18mm) ────────
                // Usuário restrito só vê indicadores dos módulos permitidos
                const fluxoMedio = Math.ceil(listaFrota.length / (filtroMes ? 30 : (listaFrota.length > 0 ? 365 : 1)));
                const ind = [];
                if (semRestr) ind.push({ lbl: 'SEGURANCA ELETRONICA', val: '161', sub: 'Cameras (CFTV) - Monitoramento 24h' });
                if (semRestr || pode('veiculos', 'ver')) {
                    ind.push({ lbl: 'FLUXO MEDIO GARAGEM',  val: String(fluxoMedio), sub: 'Veiculos por dia' });
                    ind.push({ lbl: 'GARAGEM - SERVIDORES', val: String(listaFrota.filter(f => f.tipo === 'servidor').length), sub: 'Acessos no periodo' });
                    ind.push({ lbl: 'GARAGEM - VISITANTES', val: String(listaFrota.filter(f => f.tipo === 'visitante').length), sub: 'Acessos no periodo' });
                }
                if (semRestr || pode('visitantes', 'ver')) ind.push({ lbl: 'VISITANTES RECEBIDOS', val: String(listaVisitantes.length), sub: 'Total no periodo' });
                if (semRestr || pode('eventos', 'ver')) {
                    ind.push({ lbl: 'EVENTOS - INTERNOS',   val: String(listaEventos.filter(e => e.tipo === 'Interno').length), sub: 'Realizados' });
                    ind.push({ lbl: 'EVENTOS - EXTERNOS',   val: String(listaEventos.filter(e => e.tipo === 'Externo').length), sub: 'Realizados' });
                    ind.push({ lbl: 'PUBLICO TOTAL',        val: publicoEventos.toLocaleString('pt-BR'), sub: 'Participantes em eventos' });
                }

                if (ind.length) {
                    pdf.setFont('helvetica','bold'); pdf.setFontSize(11); pdf.setTextColor(0);
                    pdf.text('INDICADORES OPERACIONAIS', M, y);
                    y += 4;
                    const indCardW = (PW - 2*M - 6) / 4;
                    const indCardH = 18;
                    ind.forEach((it, i) => {
                        const col = i % 4;
                        const row = Math.floor(i / 4);
                        const x = M + col * (indCardW + 2);
                        const yy = y + row * (indCardH + 2);
                        pdf.setDrawColor(0); pdf.setLineWidth(0.3);
                        pdf.setFillColor(252, 252, 252); pdf.rect(x, yy, indCardW, indCardH, 'F');
                        pdf.rect(x, yy, indCardW, indCardH);
                        pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(60);
                        pdf.text(s(it.lbl), x+2, yy+4);
                        pdf.setFontSize(13); pdf.setTextColor(0);
                        pdf.text(s(it.val), x+2, yy+11);
                        pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(110);
                        pdf.text(s(it.sub), x+2, yy+15.5);
                        pdf.setTextColor(0);
                    });
                    y += Math.ceil(ind.length / 4) * (indCardH + 2);
                }

                // y final previsto: ~265mm. Footer em PH-12 = 285mm. Folga: 20mm. ✓

                // ─── RODAPÉ EM TODAS AS PÁGINAS ──────────────────────────
                const dataAtual = new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                // Usa o usuário logado (currentUserData) — a chave 'dzel_user' do
                // sessionStorage nunca era gravada, então o rodapé saía sempre "Sistema".
                let usuario = 'Sistema';
                try {
                    if (typeof currentUserData === 'object' && currentUserData)
                        usuario = currentUserData.nome || currentUserData.email || 'Sistema';
                } catch(e) {}

                const totalPages = pdf.internal.getNumberOfPages();
                for (let p = 1; p <= totalPages; p++) {
                    pdf.setPage(p);
                    pdf.setLineWidth(0.3); pdf.setDrawColor(180);
                    pdf.line(M, PH-12, PW-M, PH-12);
                    pdf.setFont('helvetica','italic'); pdf.setFontSize(7); pdf.setTextColor(120);
                    pdf.text('Documento gerado em ' + dataAtual + ' por ' + s(usuario), M, PH-7);
                    pdf.text('DZEL - Divisao de Zeladoria | COGESPA', PW/2, PH-7, { align:'center' });
                    pdf.text('Pag. ' + p + ' / ' + totalPages, PW-M, PH-7, { align:'right' });
                    pdf.setTextColor(0);
                }

                // ─── SALVAR / ABRIR ───────────────────────────────────────
                const filename = 'Relatorio_DZEL_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.pdf';
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    const blob = pdf.output('blob');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = filename; a.target = '_blank';
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                } else {
                    pdf.save(filename);
                }
                if (typeof showToast === 'function') showToast('PDF gerado com sucesso!', 'success');
            } catch (err) {
                console.error('Erro gerar PDF dashboard:', err);
                if (typeof showToast === 'function') showToast('Erro ao gerar PDF: ' + err.message, 'error');
                else alert('Erro ao gerar PDF: ' + err.message);
            }
        }

