        // ════════════════════════════════════════════════════════════════
        // ETAPA 4: CONTRATOS. Cartões com vigência e aviso de fim, as
        // demandas do serviço e as ocorrências da contratada, avaliação do
        // mês, formulário no painel lateral e vínculo com ocorrências e
        // projetos.
        // ════════════════════════════════════════════════════════════════
        (function () {
            const $ = id => document.getElementById(id);
            const val = id => (($(id) || {}).value || '').trim();
            const dataBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
            const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
            const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const nomeMes = k => { const [y, m] = k.split('-'); return MESES[parseInt(m, 10) - 1] + ' de ' + y; };
            const SERVICO = { 'MANUTENÇÃO PREDIAL': 'Manutenção predial', 'AR CONDICIONADO': 'Ar condicionado', 'LIMPEZA': 'Limpeza', 'TELEFONIA': 'Telefonia', 'COPA': 'Copa', 'SEGURANÇA E ACESSO': 'Segurança e acesso', 'SUPORTE TI': 'Suporte de TI' };
            const TOM_CONCEITO = { 'Ótimo': 'verde', 'Bom': 'verde', 'Regular': 'ambar', 'Ruim': 'vermelho' };
            const lista = () => (typeof contratos !== 'undefined' ? contratos : []);
            const hoje = () => { const d = DateUtils.getNowBRT(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
            const mesFechado = () => { const d = hoje(); const a = new Date(d.getFullYear(), d.getMonth() - 1, 1); return a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0'); };
            function diasAteFim(c) { if (!c.vigencia_fim) return null; return Math.round((new Date(c.vigencia_fim + 'T00:00:00') - hoje()) / 86400000); }
            function situacao(c) {
                if (c.ativo === false) return ['Encerrado', 'neutro'];
                const d = diasAteFim(c);
                if (d == null) return ['Sem data de fim', 'neutro'];
                if (d < 0) return ['Vencido', 'vermelho'];
                if (d <= (c.aviso_dias || 90)) return [d === 0 ? 'Vence hoje' : d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`, 'ambar'];
                return ['Vigente', 'verde'];
            }
            const palavraChave = c => (norm(c.contratada).split(/\s+/).find(w => w.length >= 4 && !['LTDA', 'EIRELI', 'SERVICOS', 'COMERCIO', 'BRASIL'].includes(w)) || '');
            function demandasDo(c) { const s = norm(c.servico); return s ? (typeof demandas !== 'undefined' ? demandas : []).filter(d => norm(d.contratada) === s) : []; }
            function ocorrenciasDo(c) {
                const chave = palavraChave(c);
                return (typeof ocorrencias !== 'undefined' ? ocorrencias : []).filter(o => o.contrato_id == c.id || (!o.contrato_id && chave && norm(o.contratada).includes(chave)));
            }
            const avaliacoesDo = c => (typeof avaliacoes !== 'undefined' ? avaliacoes : []).filter(a => a.contrato_id == c.id).sort((a, b) => b.mes.localeCompare(a.mes));
            const dinheiro = v => v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            window.nomeContrato = id => { const c = lista().find(x => x.id == id); return c ? `nº ${c.numero}, ${c.contratada}` : ''; };

            window.renderizarContratos = function () {
                const sec = $('contratos'); if (!sec || !sec.classList.contains('active')) return;
                const ed = pode('contratos', 'editar');
                $('ct-btn-novo').style.display = ed ? '' : 'none';
                const ano = String(hoje().getFullYear());
                const ord = [...lista()].sort((a, b) => (a.ativo === false) - (b.ativo === false) || String(a.vigencia_fim || '9').localeCompare(String(b.vigencia_fim || '9')));
                const alerta = ord.filter(c => c.ativo !== false && situacao(c)[1] !== 'verde' && diasAteFim(c) != null);
                const aviso = $('ct-aviso');
                aviso.hidden = !alerta.length;
                aviso.innerHTML = alerta.length ? `<i class="fas fa-hourglass-half" aria-hidden="true"></i><span>${alerta.map(c => `<b>${esc(c.contratada)}</b> (nº ${esc(c.numero)}): ${situacao(c)[0].toLowerCase()}`).join('; ')}.</span>` : '';
                const mf = mesFechado();
                $('ct-lista').innerHTML = ord.map(c => {
                    const [sit, tom] = situacao(c);
                    const ds = demandasDo(c), oc = ocorrenciasDo(c), av = avaliacoesDo(c), ult = av[0];
                    const doAno = ds.filter(d => (d.data || '').startsWith(ano)).length, abertas = ds.filter(d => d.status !== 'Concluído').length;
                    const ocAbertas = oc.filter(o => o.status !== 'Encerrada').length;
                    const avTexto = ult ? `${celPill(ult.conceito, TOM_CONCEITO[ult.conceito] || 'neutro')}<span>${ult.mes === mf ? 'em ' : 'última, em '}${nomeMes(ult.mes)}${ult.nota != null ? ', nota ' + String(ult.nota).replace('.', ',') : ''}</span>` : `<span class="ct-pendente">Sem avaliação de ${nomeMes(mf)}</span>`;
                    return `<article class="pn-card ct-cartao${c.ativo === false ? ' ct-inativo' : ''}">
                        <div class="ct-topo">${celChip(SERVICO[c.servico] || c.servico || 'Outro serviço')}${celPill(sit, tom)}</div>
                        <h3 class="ct-empresa">${esc(c.contratada)}</h3>
                        <p class="ct-numero">Contrato nº ${esc(c.numero)}${c.unidades ? ', ' + esc(c.unidades === 'Todas' ? 'todas as unidades' : c.unidades) : ''}</p>
                        ${c.objeto ? `<p class="ct-objeto">${esc(c.objeto)}</p>` : ''}
                        <div class="ct-numeros">
                            <button type="button" data-ct-demandas="${c.id}" ${c.servico ? '' : 'disabled'}><span>Demandas em ${ano}</span><b>${doAno}</b></button>
                            <button type="button" data-ct-demandas="${c.id}" ${c.servico ? '' : 'disabled'}><span>Em aberto</span><b class="${abertas ? 'pn-ab' : ''}">${abertas}</b></button>
                            <button type="button" data-ct-ocorrencias="${c.id}"><span>Ocorrências</span><b class="${ocAbertas ? 'pn-ab' : ''}">${oc.length}</b></button>
                        </div>
                        <dl class="pj-dados ct-dados">
                            <div><dt>Vigência</dt><dd>${c.vigencia_inicio || c.vigencia_fim ? `${dataBR(c.vigencia_inicio) || '?'} a ${dataBR(c.vigencia_fim) || '?'}` : 'não informada'}</dd></div>
                            ${c.fiscal ? `<div><dt>Fiscal técnico</dt><dd>${esc(c.fiscal)}</dd></div>` : ''}
                            ${c.gestor ? `<div><dt>Gestor</dt><dd>${esc(c.gestor)}</dd></div>` : ''}
                            ${c.processo_sei ? `<div><dt>Processo SEI</dt><dd>${esc(c.processo_sei)}</dd></div>` : ''}
                            ${c.valor_mensal != null ? `<div><dt>Valor mensal</dt><dd>${dinheiro(c.valor_mensal)}</dd></div>` : ''}
                        </dl>
                        <div class="ct-avaliacao"><span class="ct-av-rot">Avaliação mensal</span><div>${avTexto}</div></div>
                        <div class="ct-acoes">
                            ${ed ? `<button type="button" class="btn-primary" data-ct-avaliar="${c.id}">Avaliação do mês</button><button type="button" class="btn-sec" data-ct-editar="${c.id}">Editar</button>` : (av.length ? `<button type="button" class="btn-sec" data-ct-avaliar="${c.id}">Ver avaliações</button>` : '')}
                            ${c.pdf_path ? `<a href="#" class="anexo-abrir ct-pdf" data-path="${esc(c.pdf_path)}"><i class="fas fa-file-pdf" aria-hidden="true"></i> Contrato assinado</a>` : ''}
                        </div>
                    </article>`;
                }).join('') || `<div class="card pj-nada"><p>Nenhum contrato cadastrado.${ed ? ' Use "Cadastrar contrato" para começar.' : ''}</p></div>`;
            };

            document.addEventListener('click', (e) => {
                if (!e.target.closest('#contratos')) return;
                const ed = e.target.closest('[data-ct-editar]'); if (ed) { editarContrato(Number(ed.dataset.ctEditar)); return; }
                const av = e.target.closest('[data-ct-avaliar]'); if (av) { abrirAvaliacao(Number(av.dataset.ctAvaliar)); return; }
                const dm = e.target.closest('[data-ct-demandas]');
                if (dm) {
                    const c = lista().find(x => x.id == dm.dataset.ctDemandas); if (!c || !pode('demandas', 'ver')) return;
                    switchTab('demandas');
                    const todas = document.querySelector('.lista-visoes[data-lista="demandas"] [data-visao="abertas"]'); if (todas) todas.click();
                    const i = $('filtro-texto-demanda'); if (i) { i.value = SERVICO[c.servico] ? c.servico : ''; i.dispatchEvent(new Event('input', { bubbles: true })); window.renderizarApenasDemandas?.(); }
                    return;
                }
                const oc = e.target.closest('[data-ct-ocorrencias]');
                if (oc) {
                    const c = lista().find(x => x.id == oc.dataset.ctOcorrencias); if (!c || !pode('ocorrencias', 'ver')) return;
                    switchTab('ocorrencias');
                    const b = $('filtro-busca-oco') || document.querySelector('#ocorrencias input[type="text"]');
                    if (b) { b.value = palavraChave(c); b.dispatchEvent(new Event('keyup', { bubbles: true })); window.renderizarApenasOcorrencias?.(); }
                }
            });

            // ── Formulário ──
            window.cancelarEdicaoContrato = function () {
                $('form-contrato').reset(); $('contrato-id-edit').value = '';
                $('titulo-form-contrato').textContent = 'Cadastrar contrato'; $('ct-excluir').hidden = true;
                const ver = $('ct-pdf-ver'); ver.hidden = true; ver.dataset.path = '';
            };
            window.editarContrato = function (id) {
                const c = lista().find(x => x.id == id); if (!c) return;
                cancelarEdicaoContrato();
                $('contrato-id-edit').value = c.id; $('ct-numero').value = c.numero || ''; $('ct-cnpj').value = c.cnpj || ''; $('ct-contratada').value = c.contratada || '';
                $('ct-servico').value = SERVICO[c.servico] ? c.servico : ''; $('ct-unidades').value = c.unidades || 'Todas'; $('ct-objeto').value = c.objeto || '';
                $('ct-inicio').value = c.vigencia_inicio || ''; $('ct-fim').value = c.vigencia_fim || '';
                $('ct-valor').value = c.valor_mensal != null ? Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
                $('ct-aviso-dias').value = String(c.aviso_dias || 90); $('ct-gestor').value = c.gestor || ''; $('ct-fiscal').value = c.fiscal || ''; $('ct-sei').value = c.processo_sei || '';
                $('ct-ativo').checked = c.ativo !== false;
                if (c.pdf_path) { const ver = $('ct-pdf-ver'); ver.hidden = false; ver.dataset.path = c.pdf_path; }
                $('titulo-form-contrato').textContent = 'Editar contrato'; $('ct-excluir').hidden = !pode('contratos', 'excluir');
                abrirPainel('contratos');
            };
            if (typeof _PAINEIS !== 'undefined') _PAINEIS.contratos = () => cancelarEdicaoContrato();
            const numero = s => { const t = String(s || '').replace(/[^\d,.-]/g, ''); if (!t) return null; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return isNaN(n) ? null : n; };
            $('form-contrato').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = val('contrato-id-edit');
                const reg = {
                    numero: val('ct-numero'), contratada: val('ct-contratada'), cnpj: val('ct-cnpj') || null, servico: val('ct-servico') || null, unidades: val('ct-unidades') || null,
                    objeto: val('ct-objeto') || null, vigencia_inicio: val('ct-inicio') || null, vigencia_fim: val('ct-fim') || null, valor_mensal: numero(val('ct-valor')),
                    aviso_dias: parseInt(val('ct-aviso-dias'), 10) || 90, gestor: val('ct-gestor') || null, fiscal: val('ct-fiscal') || null, processo_sei: val('ct-sei') || null, ativo: $('ct-ativo').checked
                };
                if (!reg.numero || !reg.contratada) return;
                if (reg.vigencia_inicio && reg.vigencia_fim && reg.vigencia_fim < reg.vigencia_inicio) { alert('O fim da vigência não pode ser antes do início.'); $('ct-fim').focus(); return; }
                const btn = $('btn-submit-contrato'); btn.disabled = true;
                const arq = $('ct-pdf').files && $('ct-pdf').files[0];
                if (arq) { try { reg.pdf_path = await enviarArquivo('contratos', arq); } catch (er) { showToast('O PDF não foi enviado: ' + (er.message || er), 'warning', 6000); } }
                const { error } = id ? await sb.from('contratos').update(reg).eq('id', id) : await sb.from('contratos').insert(reg);
                btn.disabled = false;
                if (error) { alert('Não foi possível salvar o contrato: ' + error.message); return; }
                registrarLog(id ? 'Edição' : 'Criação', 'Contratos', `${id ? 'Alterou o contrato' : 'Novo contrato'} nº ${reg.numero}, ${reg.contratada}`);
                const r = await sb.from('contratos').select('*').order('id', { ascending: true }); if (!r.error && r.data) contratos = r.data;
                fecharPainel({ salvo: true }); renderizarContratos(); showToast('Contrato salvo.', 'success');
            });
            $('ct-excluir').addEventListener('click', async () => {
                const id = val('contrato-id-edit'); const c = lista().find(x => x.id == id); if (!c) return;
                if (!confirm(`Excluir o contrato nº ${c.numero} (${c.contratada})? As avaliações dele também serão apagadas; ocorrências e projetos ligados a ele continuam, só perdem o vínculo.`)) return;
                const { error } = await sb.from('contratos').delete().eq('id', id);
                if (error) { alert('Não foi possível excluir: ' + error.message); return; }
                registrarLog('Exclusão', 'Contratos', `Excluiu o contrato nº ${c.numero}, ${c.contratada}`);
                contratos = lista().filter(x => x.id != id);
                fecharPainel({ salvo: true }); renderizarContratos(); showToast('Contrato excluído.', 'success');
            });

            // ── Avaliação do mês ──
            let avContrato = null, avVolta = null;
            window.abrirAvaliacao = function (id) {
                const c = lista().find(x => x.id == id); if (!c) return;
                avContrato = c; avVolta = document.activeElement;
                const ed = pode('contratos', 'editar');
                $('av-sub').textContent = `${c.contratada}, contrato nº ${c.numero}`;
                $('form-avaliacao').querySelectorAll('input, select, textarea, #av-salvar').forEach(el => { el.disabled = !ed; });
                $('av-mes').value = mesFechado(); preencherMes();
                desenharHistorico();
                $('modal-avaliacao').style.display = 'flex';
                (ed ? $('av-conceito') : $('av-historico')).focus?.();
            };
            window.fecharAvaliacao = function () { $('modal-avaliacao').style.display = 'none'; if (avVolta && document.contains(avVolta)) avVolta.focus(); };
            function preencherMes() {
                const a = avContrato && avaliacoesDo(avContrato).find(x => x.mes === $('av-mes').value);
                $('av-conceito').value = a ? a.conceito : 'Bom'; $('av-nota').value = a && a.nota != null ? a.nota : ''; $('av-obs').value = a ? (a.observacoes || '') : '';
                $('av-salvar').textContent = a ? 'Atualizar avaliação' : 'Salvar avaliação';
            }
            function desenharHistorico() {
                const av = avaliacoesDo(avContrato).slice(0, 12);
                $('av-historico').innerHTML = av.length ? `<h4>Avaliações anteriores</h4><ul>${av.map(a => `<li><span>${nomeMes(a.mes)}</span>${celPill(a.conceito, TOM_CONCEITO[a.conceito] || 'neutro')}${a.nota != null ? `<b>${String(a.nota).replace('.', ',')}</b>` : '<b></b>'}${a.observacoes ? `<small>${esc(a.observacoes)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="pn-vazio">Nenhuma avaliação registrada ainda.</p>';
            }
            $('av-mes').addEventListener('change', preencherMes);
            $('form-avaliacao').addEventListener('submit', async (e) => {
                e.preventDefault(); if (!avContrato) return;
                const notaTxt = $('av-nota').value;
                const reg = { contrato_id: avContrato.id, mes: $('av-mes').value, conceito: $('av-conceito').value, nota: notaTxt === '' ? null : Math.min(10, Math.max(0, Number(notaTxt))), observacoes: $('av-obs').value.trim() || null, avaliador: (currentUserData && (currentUserData.nome || currentUserData.email)) || null };
                if (!/^\d{4}-\d{2}$/.test(reg.mes)) { $('av-mes').focus(); return; }
                $('av-salvar').disabled = true;
                const { error } = await sb.from('contratos_avaliacoes').upsert(reg, { onConflict: 'contrato_id,mes' });
                $('av-salvar').disabled = false;
                if (error) { alert('Não foi possível salvar a avaliação: ' + error.message); return; }
                registrarLog('Edição', 'Contratos', `Avaliação de ${nomeMes(reg.mes)} (${reg.conceito}) do contrato nº ${avContrato.numero}`);
                const r = await sb.from('contratos_avaliacoes').select('*').order('id', { ascending: false }); if (!r.error && r.data) avaliacoes = r.data;
                if (!avaliacoes.some(a => a.contrato_id == reg.contrato_id && a.mes === reg.mes)) avaliacoes.push({ ...reg, id: Date.now() });
                desenharHistorico(); preencherMes(); renderizarContratos(); showToast('Avaliação salva.', 'success');
            });
            if (typeof _FECHAR_MODAL !== 'undefined') _FECHAR_MODAL['modal-avaliacao'] = () => window.fecharAvaliacao();

            // ── Campo "Contrato" em ocorrências e projetos ──
            const opcoes = (atual) => {
                const ativos = lista().filter(c => c.ativo !== false || c.id == atual);
                return ativos.map(c => `<option value="${c.id}">nº ${esc(c.numero)}, ${esc(c.contratada)}</option>`).join('');
            };
            window.preencherOpcoesContrato = function (box, item) {
                const sel = box && box.querySelector('[data-col="contrato_id"]'); if (!sel) return;
                const liberado = lista().length > 0;
                sel.closest('.ex-campo').hidden = !liberado; sel.disabled = !liberado;
                if (liberado) sel.innerHTML = '<option value="">Sem contrato vinculado</option>' + opcoes(item && item.contrato_id);
            };
            window.preencherContratosProjeto = function (atual) {
                const campo = $('pj-contrato-campo'), sel = $('pj-contrato'); if (!campo || !sel) return;
                campo.hidden = !lista().length;
                sel.innerHTML = '<option value="">Nenhum</option>' + opcoes(atual);
                sel.value = atual ? String(atual) : '';
            };

            const trocarAba = window.switchTab;
            window.switchTab = function (aba) { trocarAba(aba); if (aba === 'contratos') renderizarContratos(); };
        })();
