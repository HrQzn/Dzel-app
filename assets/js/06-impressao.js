        /* ════════════════════════════════════════════════════════════════
           PDF DA O.S. — espelho exato do HTML de impressão (gerarHTMLOS)
           ────────────────────────────────────────────────────────────────
           As duas saídas (Imprimir/PC e Baixar PDF/celular) precisam sair
           idênticas. Por isso a geometria abaixo NÃO é "parecida": são as
           medidas reais do HTML renderizado, em mm, relativas ao canto da
           tabela. Se o HTML mudar, remeça e atualize LAY.

           Folha: @page A4 margem 10mm → tabela de 190×271mm em (10,10).
           ════════════════════════════════════════════════════════════════ */
        const OS_LAY = {
            M: 10, W: 190, H: 271,
            // Bordas verticais das 7 colunas (colgroup 15/10/8.35/16.65/16.65/8.35/25 %)
            col: [0, 28.5, 47.5, 63.365, 95, 126.635, 142.5, 190],
            padX: 2.26,                 // recuo do texto dentro da célula
            linhas: {                   // topo + altura de cada linha da tabela
                hdr:     { y: 0.265,   h: 24.817 },
                sec1:    { y: 25.082,  h: 5.432  },
                ident1:  { y: 30.514,  h: 10.662 },
                ident2:  { y: 41.176,  h: 10.662 },
                sec2:    { y: 51.838,  h: 5.432  },
                titulo:  { y: 57.270,  h: 13.498 },
                sec3:    { y: 70.768,  h: 5.432  },
                equipes: { y: 76.200,  h: 27.099 },
                locais:  { y: 103.299, h: 31.597 },
                campos:  { y: 134.896, h: 76.613 },   // flexível (absorve sobras)
                sec4:    { y: 211.510, h: 5.432  },
                encerra: { y: 216.942, h: 25.999 },
                assina:  { y: 242.941, h: 27.794 }
            },
            // Deslocamentos do texto dentro da célula (do topo da linha até a base da letra)
            base: { lbl: 3.364, val: 8.438, tituloVal: 4.851, grid: 7.726, fill: 13.327,
                    sigNome: 21.269, sigSub: 24.621, sigLinha: 17.252 },
            grid3: { x0: 2.526, dx: 62.313, dy: 4.973 },
            grid4: { x0: 2.526, dx: 46.736, dy: 5.172 },
            cbox:  { lado: 2.7, gap: 4, dy: 0.343 },
            rodapeY: 275.890,
            cor: { lbl: [80,80,80], sec: [229,229,229], num: [192,57,43],
                   marcado: [0,120,0], borda: [51,51,51], rodape: [85,85,85] },
            traco: { externo: 0.529, celula: 0.176 }   // 1.5pt e 0.5pt
        };

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

                const L = OS_LAY, M = L.M, W = L.W;
                const cx = i => M + L.col[i];              // borda vertical da coluna i
                const linha = k => ({ y: M + L.linhas[k].y, h: L.linhas[k].h });

                // Acentos: as fontes padrão do jsPDF usam WinAnsi (cp1252), que cobre
                // todo o português. Só normalizamos aspas/travessões tipográficos, que
                // ficam fora dessa tabela, para não virarem caractere errado.
                const s = (v) => String(v == null ? '' : v)
                    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
                    .replace(/[–—]/g, '-').replace(/…/g, '...');
                // Base da letra a partir do topo do texto (Helvetica: ascent ≈ 0.905em)
                const baseDe = (topo, pt) => topo + 0.905 * pt * 0.352778;

                const fonte = (pt, bold, cor, italico) => {
                    pdf.setFontSize(pt);
                    pdf.setFont('helvetica', italico ? 'italic' : (bold ? 'bold' : 'normal'));
                    pdf.setTextColor(...(cor || [0, 0, 0]));
                };
                const txt = (t, x, y, opts) => pdf.text(s(t), x, y, opts);
                const vline = (x, y1, y2) => { pdf.setLineWidth(L.traco.celula); pdf.setDrawColor(0); pdf.line(x, y1, x, y2); };
                const hline = (y, x1, x2) => { pdf.setLineWidth(L.traco.celula); pdf.setDrawColor(0); pdf.line(x1 ?? M, y, x2 ?? M + W, y); };

                // Rótulo cinza 7pt + valor 9pt, ancorados no topo da linha (como o HTML)
                const rotulo = (t, colIni, topo) => {
                    fonte(7, true, L.cor.lbl);
                    txt(t, cx(colIni) + L.padX, topo + L.base.lbl);
                };
                const valor = (t, colIni, colFim, topo, pt, bold) => {
                    fonte(pt || 9, !!bold);
                    const largura = cx(colFim) - cx(colIni) - 2 * L.padX;
                    const linhas = pdf.splitTextToSize(s(String(t || '').toUpperCase()), largura);
                    txt(linhas[0] || '', cx(colIni) + L.padX, topo + L.base.val);
                };
                // Faixa cinza de seção, texto centralizado na vertical
                const secao = (t, k) => {
                    const r = linha(k);
                    pdf.setFillColor(...L.cor.sec);
                    pdf.rect(M, r.y, W, r.h, 'F');
                    hline(r.y); hline(r.y + r.h);
                    fonte(8, true);
                    txt(t, M + W / 2, r.y + 3.704, { align: 'center' });
                };
                // Caixinha de seleção 2.7mm — igual ao .cbox do HTML
                const caixa = (x, topoTexto, marcado) => {
                    const y = topoTexto + L.cbox.dy, lado = L.cbox.lado;
                    pdf.setLineWidth(0.176);
                    if (marcado) {
                        pdf.setFillColor(...L.cor.marcado); pdf.setDrawColor(...L.cor.marcado);
                        pdf.rect(x, y, lado, lado, 'FD');
                        pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.35);
                        pdf.line(x + 0.65, y + 1.45, x + 1.15, y + 2.05);
                        pdf.line(x + 1.15, y + 2.05, x + 2.15, y + 0.7);
                    } else {
                        pdf.setDrawColor(...L.cor.borda);
                        pdf.rect(x, y, lado, lado, 'D');
                    }
                    pdf.setDrawColor(0); pdf.setLineWidth(L.traco.celula);
                };
                const itemGrid = (x, topoTexto, rot, marcado) => {
                    caixa(x, topoTexto, marcado);
                    fonte(8, !!marcado, marcado ? L.cor.marcado : L.cor.lbl);
                    txt(rot, x + L.cbox.gap, baseDe(topoTexto, 8));
                };
                const carregarImagem = (src) => new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        try {
                            const cv = document.createElement('canvas');
                            cv.width = img.naturalWidth || img.width;
                            cv.height = img.naturalHeight || img.height;
                            cv.getContext('2d').drawImage(img, 0, 0);
                            resolve(cv.toDataURL('image/png'));
                        } catch (e) { resolve(null); }
                    };
                    img.onerror = () => resolve(null);
                    img.src = src;
                });

                // ── Dados (mesmas regras do HTML) ──────────────────────────
                const partes = (d.data || '').split('-');
                const dataBr = partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : (d.data || '');
                const chks = montarCheckboxes(d);
                const logoInfo = getLogoInfoParaOS(d);
                const osNum = d.numero_os ? d.numero_os : d.id;

                // ══════════ CABEÇALHO ══════════
                const rH = linha('hdr');
                const brasao = await carregarImagem('brasao.jpg');
                if (brasao) { try { pdf.addImage(brasao, 'PNG', M + 7.169, M + 3.708, 14.742, 16.999); } catch (e) {} }

                const cCentro = (cx(1) + cx(6)) / 2;
                fonte(10, true); txt('GOVERNO DO ESTADO DE SÃO PAULO', cCentro, M + baseDe(5.321, 10), { align: 'center' });
                fonte(9, true);  txt('SECRETARIA DA EDUCAÇÃO', cCentro, M + baseDe(9.289, 9), { align: 'center' });
                fonte(7, false); txt('COORDENADORIA GERAL DE SUPORTE ADMINISTRATIVO', cCentro, M + baseDe(13.490, 7), { align: 'center' });
                fonte(7, false); txt('DIVISÃO DE ZELADORIA', cCentro, M + baseDe(17.070, 7), { align: 'center' });

                const cDir = (cx(6) + cx(7)) / 2;
                if (logoInfo) {
                    const px2mm = v => parseFloat(v) / (96 / 25.4);
                    const lw = px2mm(logoInfo.width), lh = px2mm(logoInfo.height);
                    const logo = await carregarImagem(logoInfo.src);
                    if (logo) { try { pdf.addImage(logo, 'PNG', cDir - lw / 2, M + 1.525, lw, lh); } catch (e) {} }
                } else {
                    fonte(8, true, [51, 51, 51]);
                    txt('ORDEM DE SERVIÇO', cDir, M + baseDe(6.5, 8), { align: 'center' });
                }
                fonte(13, true, L.cor.num);
                txt(`${logoInfo ? 'O.S Nº ' : 'Nº '}${osNum}`, cDir, M + baseDe(18.397, 13), { align: 'center' });

                vline(cx(1), rH.y, rH.y + rH.h);
                vline(cx(6), rH.y, rH.y + rH.h);

                // ══════════ 1. IDENTIFICAÇÃO ══════════
                secao('1. IDENTIFICAÇÃO DA SOLICITAÇÃO', 'sec1');

                const r1 = linha('ident1');
                vline(cx(2), r1.y, r1.y + r1.h); vline(cx(6), r1.y, r1.y + r1.h);
                rotulo('DATA E HORA DE ABERTURA', 0, r1.y);
                valor(`${dataBr}  ${d.hora || '--:--'}`, 0, 2, r1.y);
                rotulo('SOLICITANTE / CONTATO', 2, r1.y);
                valor(d.solicitante, 2, 6, r1.y);
                rotulo('PRIORIDADE NO SISTEMA', 6, r1.y);
                valor(d.prioridade, 6, 7, r1.y);
                hline(r1.y + r1.h);

                const r2 = linha('ident2');
                vline(cx(6), r2.y, r2.y + r2.h);
                rotulo('UNIDADE / SETOR DE ORIGEM', 0, r2.y);
                valor(d.setor, 0, 6, r2.y);
                rotulo('STATUS ATUAL', 6, r2.y);
                valor(d.status, 6, 7, r2.y);

                // ══════════ 2. DESCRIÇÃO DA DEMANDA ══════════
                secao('2. DESCRIÇÃO DA DEMANDA (PREENCHIMENTO PELO SISTEMA)', 'sec2');
                const rT = linha('titulo');
                fonte(10, true);
                const linhasTitulo = pdf.splitTextToSize(s((d.titulo || '').toUpperCase()), W - 2 * L.padX);
                linhasTitulo.slice(0, 3).forEach((ln, i) => txt(ln, M + L.padX, rT.y + L.base.tituloVal + i * 4.4));
                hline(rT.y + rT.h);

                // ══════════ 3. PARECER TÉCNICO ══════════
                secao('3. PARECER TÉCNICO E EXECUÇÃO (PREENCHIMENTO PELA EQUIPE)', 'sec3');

                const rE = linha('equipes');
                rotulo('EQUIPE RESPONSÁVEL / CONTRATADA ATRIBUÍDA', 0, rE.y);
                const equipes = [
                    [chks.limpeza, 'LIMPEZA PREDIAL'], [chks.ar, 'AR CONDICIONADO'], [chks.manut, 'MANUTENÇÃO PREDIAL'],
                    [chks.elevador, 'MANUT. DE ELEVADORES'], [chks.ti, 'SUPORTE TI'], [chks.telefonia, 'TELEFONIA'],
                    [chks.extintores, 'MANUT. E RECARGA EXTINTORES'], ['[ ]', 'OUTROS: __________________________________']
                ];
                equipes.forEach((eq, i) => {
                    const col = i % 3, lin = Math.floor(i / 3);
                    itemGrid(M + L.grid3.x0 + col * L.grid3.dx,
                             rE.y + (L.base.grid - 2.554) + lin * L.grid3.dy, eq[1], eq[0] === '[X]');
                });
                hline(rE.y + rE.h);

                const rL = linha('locais');
                rotulo('LOCAL DE ATUAÇÃO / PRÉDIO VINCULADO', 0, rL.y);
                // O "OUTRO" entra como 11º item da grade (3ª linha, 3ª coluna) — no
                // HTML ele ocupa 2 colunas ao lado de CENTRO OESTE e CAPE, e não uma
                // linha própria.
                const locais = ['SEDE', 'AROUCHE', 'EFAPE', 'ARMÊNIA', 'CASA VERDE', 'SÃO DOMINGOS',
                                'CAJAMAR', 'TENENTE PENA', 'CENTRO OESTE', 'CAPE',
                                'OUTRO: ______________________________________'];
                locais.forEach((loc, i) => {
                    const col = i % 4, lin = Math.floor(i / 4);
                    itemGrid(M + L.grid4.x0 + col * L.grid4.dx,
                             rL.y + (L.base.grid - 2.554) + lin * L.grid4.dy, loc, false);
                });
                hline(rL.y + rL.h);

                // ══════════ CAMPOS LIVRES (descrição / materiais) ══════════
                const rC = linha('campos');
                vline(cx(4), rC.y, rC.y + rC.h);
                rotulo('DESCRIÇÃO DETALHADA DOS SERVIÇOS EXECUTADOS', 0, rC.y);
                rotulo('MATERIAIS E PEÇAS UTILIZADOS (REPOSIÇÃO)', 4, rC.y);
                // Texto exatamente como digitado (sem forçar maiúsculas), respeitando
                // as quebras de linha do usuário — igual ao white-space:pre-wrap do HTML.
                const blocoLivre = (texto, colIni, colFim) => {
                    if (!texto || !texto.trim()) return;
                    fonte(9, false);
                    const largura = cx(colFim) - cx(colIni) - 2 * L.padX;
                    const linhasTxt = [];
                    String(texto).split('\n').forEach(par => {
                        if (!par.trim()) { linhasTxt.push(''); return; }
                        pdf.splitTextToSize(s(par), largura).forEach(l => linhasTxt.push(l));
                    });
                    const maxLinhas = Math.floor((rC.h - 8) / 4.2);
                    linhasTxt.slice(0, maxLinhas).forEach((l, i) => {
                        if (l) txt(l, cx(colIni) + L.padX, rC.y + 8.4 + i * 4.2);
                    });
                };
                blocoLivre(descricao, 0, 4);
                blocoLivre(materiais, 4, 7);
                hline(rC.y + rC.h);

                // ══════════ 4. TERMO DE ENCERRAMENTO ══════════
                secao('4. TERMO DE ENCERRAMENTO E ACEITE FISCAL', 'sec4');

                const rN = linha('encerra');
                vline(cx(2), rN.y, rN.y + rN.h); vline(cx(4), rN.y, rN.y + rN.h);
                rotulo('INÍCIO DO ATENDIMENTO', 0, rN.y);
                rotulo('TÉRMINO DO ATENDIMENTO', 2, rN.y);
                rotulo('OBSERVAÇÕES FINAIS / PENDÊNCIAS', 4, rN.y);
                // Sempre em branco: preenchimento físico, à mão, pela equipe.
                fonte(8, true, L.cor.lbl);
                const LINHA_MANUAL = '___/___/20___ ÀS ___:___';
                txt(LINHA_MANUAL, cx(0) + L.padX, rN.y + L.base.fill);
                txt(LINHA_MANUAL, cx(2) + L.padX, rN.y + L.base.fill);
                hline(rN.y + rN.h);

                // ══════════ ASSINATURAS ══════════
                const rA = linha('assina');
                const sigW = W / 3;
                vline(M + sigW, rA.y, rA.y + rA.h);
                vline(M + sigW * 2, rA.y, rA.y + rA.h);
                const assinaturas = [
                    ['TÉCNICO EXECUTOR', 'Nome legível / Matrícula / Empresa'],
                    ['FISCAL', 'Carimbo e Assinatura'],
                    ['SOLICITANTE / RECEBEDOR', 'Atesto a conformidade do serviço']
                ];
                assinaturas.forEach((sig, i) => {
                    const centro = M + sigW * i + sigW / 2;
                    const larguraLinha = sigW * 0.88;
                    pdf.setLineWidth(0.265); pdf.setDrawColor(0);
                    pdf.line(centro - larguraLinha / 2, rA.y + L.base.sigLinha,
                             centro + larguraLinha / 2, rA.y + L.base.sigLinha);
                    fonte(8, true);
                    txt(sig[0], centro, rA.y + L.base.sigNome, { align: 'center' });
                    fonte(7, false, L.cor.lbl);
                    txt(sig[1], centro, rA.y + L.base.sigSub, { align: 'center' });
                });

                // Borda externa da tabela (1.5pt, como no HTML)
                pdf.setLineWidth(L.traco.externo); pdf.setDrawColor(0);
                pdf.rect(M, M, W, L.H);

                // Rodapé
                fonte(7.5, false, L.cor.rodape, true);
                txt(`Documento gerado em ${new Date().toLocaleString('pt-BR')}`,
                    M + W / 2, M + L.rodapeY, { align: 'center' });

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

            // Protege contra data nula (registros importados/legados): sem guarda,
            // d.data.split() lançava TypeError e a janela de impressão saía em branco.
            const dataParts = (d.data || '').split('-');
            const dataBr = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : (d.data || '');
            const logoInfo = getLogoInfoParaOS(d);
            const chks = montarCheckboxes(d);
            // Célula direita: logo da contratada (quando houver) + Nº em vermelho.
            const logoHTML = logoInfo
                ? `<img src="${logoInfo.src}" style="width:${logoInfo.width};height:${logoInfo.height};object-fit:${logoInfo.fit};display:block;margin:0 auto 3px;" onerror="this.style.display='none'">`
                : '';
            const topTextHTML = logoInfo ? '' : '<div class="os-top">ORDEM DE SERVIÇO</div>';
            const osLabel = logoInfo ? 'O.S Nº ' : 'Nº ';
            const osNum = d.numero_os ? d.numero_os : d.id;
            // Início e término do atendimento saem SEMPRE em branco no Termo de
            // Encerramento: são de preenchimento físico, à mão, pela equipe.
            const linhaManual = '___/___/20___ ÀS ___:___';
            // [X] marcado fica verde-negrito, como no DOCX de referência
            const ck = (m, txt) => m === '[X]'
                ? `<span class="cbox on"></span><b class="ck-on">${txt}</b>`
                : `<span class="cbox"></span>${txt}`;

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
  html, body { margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
  /* Altura fixa = área útil do A4 (297mm - 2x10mm de margem). Assim a folha é
     sempre preenchida por completo, sem sobrar espaço em branco embaixo, tanto
     ao abrir na tela quanto ao imprimir / Microsoft Print to PDF. */
  .sheet { width: 190mm; height: 277mm; margin: 0 auto; }
  table.os { width: 190mm; height: 271mm; margin: 0 auto; border-collapse: collapse; table-layout: fixed; border: 1.5pt solid #000; }
  table.os td { border: 0.5pt solid #000; vertical-align: top; padding: 1mm 2mm; }
  td.sec { background: #E5E5E5; text-align: center; font-weight: bold; font-size: 8pt; vertical-align: middle; padding: 0.6mm 2mm; }
  .lbl { display: block; font-size: 7pt; font-weight: bold; color: #505050; margin-bottom: 1mm; }
  .val { font-size: 9pt; text-transform: uppercase; }
  .val.big { font-size: 10pt; font-weight: bold; }
  /* As 3 células do cabeçalho ficam centradas na vertical. Precisam do prefixo
     "table.os" porque a regra genérica acima (table.os td) tem especificidade
     maior e vinha vencendo — por isso o bloco institucional colava no topo,
     com todo o espaço sobrando embaixo. */
  table.os td.hdr-brasao { text-align: center; vertical-align: middle; }
  td.hdr-brasao img { height: 17mm; width: auto; }
  table.os td.hdr-centro { text-align: center; vertical-align: middle; }
  .h-gov { font-size: 10pt; font-weight: bold; }
  .h-sec { font-size: 9pt; font-weight: bold; }
  .h-coord { font-size: 7pt; margin-top: 0.5mm; line-height: 1.25; }
  table.os td.hdr-num { text-align: center; vertical-align: middle; }
  td.hdr-num img { max-width: 44mm; }
  .os-top { font-size: 8pt; font-weight: bold; color: #333; text-transform: uppercase; letter-spacing: 0.2px; }
  .os-num { color: #C0392B; font-size: 13pt; font-weight: bold; margin-top: 1mm; }
  /* Checkbox desenhado (não depende de glifo de fonte) — confiável no
     Microsoft Print to PDF, no celular e no navegador. */
  .cbox { display: inline-block; width: 2.7mm; height: 2.7mm; border: 0.5pt solid #333;
    box-sizing: border-box; vertical-align: -0.4mm; margin-right: 1.3mm; position: relative; }
  .cbox.on { border-color: #007800; background: #007800; }
  .cbox.on::after { content: ""; position: absolute; left: 0.85mm; top: 0.3mm;
    width: 0.7mm; height: 1.4mm; border: solid #fff; border-width: 0 0.5pt 0.5pt 0; transform: rotate(45deg); }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8mm 2mm; font-size: 8pt; color: #505050; margin-top: 1.4mm; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 2mm; font-size: 8pt; color: #505050; margin-top: 1.4mm; }
  .ck-on { color: #007800; font-weight: bold; }
  /* margin-top generoso: a linha pontilhada desce dentro da célula, sobrando
     espaço acima dela para escrever à mão (o campo é de preenchimento físico). */
  .fill-lines { font-size: 8pt; font-weight: bold; color: #505050; margin-top: 7mm; }
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
      <div class="h-coord">COORDENADORIA GERAL DE SUPORTE ADMINISTRATIVO</div>
      <div class="h-coord">DIVIS\u00C3O DE ZELADORIA</div>
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
        <div style="grid-column:span 2;"><span class="cbox"></span>OUTROS: __________________________________</div>
      </div>
    </td>
  </tr>
  <tr style="height:31.6mm;">
    <td colspan="7">
      <span class="lbl">LOCAL DE ATUA\u00C7\u00C3O / PR\u00C9DIO VINCULADO</span>
      <div class="grid4">
        <div><span class="cbox"></span>SEDE</div><div><span class="cbox"></span>AROUCHE</div><div><span class="cbox"></span>EFAPE</div><div><span class="cbox"></span>ARM\u00CANIA</div>
        <div><span class="cbox"></span>CASA VERDE</div><div><span class="cbox"></span>S\u00C3O DOMINGOS</div><div><span class="cbox"></span>CAJAMAR</div><div><span class="cbox"></span>TENENTE PENA</div>
        <div><span class="cbox"></span>CENTRO OESTE</div><div><span class="cbox"></span>CAPE</div>
        <div style="grid-column:span 2;"><span class="cbox"></span>OUTRO: ______________________________________</div>
      </div>
    </td>
  </tr>
  <tr>
    <td colspan="4" style="height:100%;"><span class="lbl">DESCRI\u00C7\u00C3O DETALHADA DOS SERVI\u00C7OS EXECUTADOS</span><div style="font-size:9pt;white-space:pre-wrap;margin-top:1mm;">${esc(descricao||'')}</div></td>
    <td colspan="3" style="height:100%;"><span class="lbl">MATERIAIS E PE\u00C7AS UTILIZADOS (REPOSI\u00C7\u00C3O)</span><div style="font-size:9pt;white-space:pre-wrap;margin-top:1mm;">${esc(materiais||'')}</div></td>
  </tr>
  <tr style="height:4.6mm;"><td class="sec" colspan="7">4. TERMO DE ENCERRAMENTO E ACEITE FISCAL</td></tr>
  <tr style="height:26mm;">
    <td colspan="2"><span class="lbl">IN\u00CDCIO DO ATENDIMENTO</span><div class="fill-lines">${linhaManual}</div></td>
    <td colspan="2"><span class="lbl">T\u00C9RMINO DO ATENDIMENTO</span><div class="fill-lines">${linhaManual}</div></td>
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
            // Chart.js é carregado por CDN: se não estiver disponível, imprimir o
            // dashboard não pode quebrar com ReferenceError — imprime sem redimensionar.
            const redimensionar = () => {
                try { Object.values(Chart.instances || {}).forEach(c => c.resize()); } catch(e) {}
            };
            const restaurar = () => { document.body.classList.remove('printing-dashboard'); redimensionar(); };
            document.body.classList.add('printing-dashboard');
            redimensionar();
            setTimeout(function() { window.print(); }, 500);
            window.onafterprint = restaurar;
            setTimeout(restaurar, 5000);
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

                const publicoEventos = listaEventos.reduce((sum, e) => sum + (parseInt(e.publico) || 0), 0);

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

