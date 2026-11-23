        // ════════════════════════════════════════════════════════════════
        // ETAPA 3: PROJETOS. Quadro por fase, lista, página do projeto
        // (etapas, demandas vinculadas, dados e documentos), formulário no
        // painel lateral e janela para vincular demandas. Também a barra
        // de atalhos do celular e o cartão de projetos no Painel.
        // ════════════════════════════════════════════════════════════════
        (function () {
            const FASES = [
                ['Planejamento', 'DFD, ETP, TR e especificação'],
                ['Contratação', 'Pesquisa de preços, propostas e seleção'],
                ['Execução e recebimento', 'Entrega, amostras e instalação'],
                ['Concluído', 'Encerrados, com o histórico guardado']
            ];
            const ETAPAS = {
                'Aquisição': ['Especificação e DFD', 'Pesquisa de preços', 'Propostas e amostras', 'Recebimento e conferência'],
                'Contratação': ['DFD, ETP e TR', 'Pesquisa de preços', 'Licitação ou dispensa', 'Contrato assinado'],
                'Instalação': ['Levantamento', 'Compra ou contratação', 'Instalação', 'Vistoria e entrega'],
                'Manutenção': ['Levantamento', 'Execução', 'Conferência', 'Encerramento']
            };
            const PESO = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
            let visao = 'quadro';
            try { visao = localStorage.getItem('dzel.visao.projetos') || 'quadro'; } catch (e) {}
            let aberto = null;
            const $ = id => document.getElementById(id);
            const val = id => (($(id) || {}).value || '').trim();
            const dataBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
            const podeEditar = () => pode('projetos', 'editar');
            const listaDemandas = () => (typeof demandas !== 'undefined' ? demandas : []);
            const demandasDo = p => listaDemandas().filter(d => d.projeto_id == p.id);
            function etapaAtual(p) {
                const e = p.etapas || []; const i = e.findIndex(x => x.status === 'atual');
                if (i >= 0) return { i, e: e[i] };
                return e.length && e.every(x => x.status === 'feita') ? { i: e.length - 1, e: e[e.length - 1], fim: true } : null;
            }
            function progresso(p) {
                const ds = demandasDo(p);
                return { total: ds.length, conc: ds.filter(d => d.status === 'Concluído').length, and: ds.filter(d => d.status === 'Em Andamento').length, pend: ds.filter(d => d.status !== 'Concluído' && d.status !== 'Em Andamento').length };
            }
            function textoEtapa(p) {
                const pr = progresso(p);
                if (pr.total) return `${pr.conc} de ${pr.total} ${pr.total === 1 ? 'item concluído' : 'itens concluídos'}`;
                const a = etapaAtual(p);
                return a ? (a.fim ? 'Todas as etapas concluídas' : `Etapa ${a.i + 1} de ${(p.etapas || []).length}: ${a.e.nome}`) : 'Sem etapas definidas';
            }
            const segmentos = p => (p.etapas || []).map(e => `<i class="${e.status}"></i>`).join('');
            const nomeContrato = id => (id && typeof window.nomeContrato === 'function') ? window.nomeContrato(id) : '';
            window.projetosAtivos = () => (typeof projetos !== 'undefined' ? projetos : []).filter(p => p.fase !== 'Concluído');

            async function recarregar() {
                const { data, error } = await sb.from('projetos').select('*').order('id', { ascending: true });
                if (!error && data) projetos = data;
            }

            // ── Quadro, lista e página ──
            window.renderizarProjetos = function () {
                const sec = $('projetos'); if (!sec || !sec.classList.contains('active') || typeof projetos === 'undefined') return;
                $('pj-btn-novo').style.display = podeEditar() ? '' : 'none';
                document.querySelectorAll('.pj-visao button').forEach(b => { const on = b.dataset.visao === visao; b.classList.toggle('ativa', on); b.setAttribute('aria-selected', on); });
                if (aberto != null) {
                    const p = projetos.find(x => x.id == aberto);
                    if (p) { desenharProjeto(p); return; }
                    aberto = null;
                }
                $('pj-detalhe').hidden = true; $('pj-conteudo').hidden = false; sec.querySelector('.pj-topo').hidden = false;
                $('pj-conteudo').innerHTML = visao === 'lista' ? lista() : quadro();
            };
            function cartao(p) {
                return `<button type="button" class="pj-cartao" data-projeto="${p.id}">
                    <span class="pj-tipo">${esc(p.tipo || 'Projeto')}</span>
                    <b class="pj-nome">${esc(p.nome)}</b>
                    <span class="pj-etapa">${esc(textoEtapa(p))}</span>
                    ${(p.etapas || []).length ? `<span class="pj-seg" aria-hidden="true">${segmentos(p)}</span>` : ''}
                    <span class="pj-rodape"><span>${p.prazo ? 'Prazo ' + celDiaMes(p.prazo) : 'Prazo a definir'}</span>${p.responsavel ? `<span class="cel-avatar pj-av" title="${esc(p.responsavel)}">${celIniciais(p.responsavel)}</span>` : ''}</span>
                </button>`;
            }
            function quadro() {
                return `<div class="pj-quadro">${FASES.map(([f, desc]) => {
                    const ps = projetos.filter(p => (p.fase || 'Planejamento') === f);
                    const vazio = f === 'Concluído' ? 'Nenhum projeto concluído ainda. Quando um terminar, mude a fase dele para Concluído; as etapas e as demandas ficam guardadas.' : 'Nenhum projeto nesta fase.';
                    return `<section class="pj-coluna" aria-label="${f}"><div class="pj-col-cab"><h3>${f} <span>${ps.length}</span></h3><p>${desc}</p></div>${ps.map(cartao).join('') || `<p class="pj-vazio">${vazio}</p>`}</section>`;
                }).join('')}</div>`;
            }
            function lista() {
                if (!projetos.length) return `<div class="card pj-nada"><p>Nenhum projeto cadastrado.${podeEditar() ? ' Use "Novo projeto" para começar.' : ''}</p></div>`;
                const ord = [...projetos].sort((a, b) => FASES.findIndex(f => f[0] === a.fase) - FASES.findIndex(f => f[0] === b.fase) || String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
                return `<div class="card lista-card"><div class="table-container"><table class="pj-tabela"><thead><tr><th>Projeto</th><th>Fase</th><th>Andamento</th><th>Prazo</th><th>Responsável</th></tr></thead><tbody>${ord.map(p =>
                    `<tr data-projeto="${p.id}" tabindex="0"><td>${celDuas('<b>' + esc(p.nome) + '</b>', esc([p.tipo, p.servico, p.unidade].filter(Boolean).join(', ')))}</td>
                    <td>${celPill(p.fase || 'Planejamento', p.fase === 'Concluído' ? 'verde' : p.fase === 'Execução e recebimento' ? 'ambar' : 'roxo')}</td>
                    <td>${esc(textoEtapa(p))}</td><td>${p.prazo ? dataBR(p.prazo) : '-'}</td><td>${esc(p.responsavel) || '-'}</td></tr>`).join('')}</tbody></table></div></div>`;
            }
            function desenharProjeto(p) {
                const sec = $('projetos'); sec.querySelector('.pj-topo').hidden = true;
                $('pj-conteudo').hidden = true; const det = $('pj-detalhe'); det.hidden = false;
                const pr = progresso(p), ds = demandasDo(p), ed = podeEditar();
                const abertas = ds.filter(d => d.status !== 'Concluído')
                    .sort((a, b) => ((PESO[a.prioridade] ?? 3) - (PESO[b.prioridade] ?? 3)) || String(a.data || '').localeCompare(String(b.data || '')));
                const pct = pr.total ? Math.round(pr.conc * 100 / pr.total) : 0;
                const dados = [['Tipo', p.tipo], ['Serviço', p.servico], ['Unidade', p.unidade], ['Responsável', p.responsavel], ['Pedido por', p.pedido_por], ['Origem', p.origem],
                    ['Processo SEI', p.processo_sei], ['Prazo final', p.prazo ? dataBR(p.prazo) : 'a definir'], ['Item do PCA', p.item_pca], ['Contrato', nomeContrato(p.contrato_id)]].filter(([, v]) => v);
                det.innerHTML = `
                    <nav class="pj-trilha" aria-label="Caminho"><button type="button" class="pn-link" data-pj-voltar>Projetos</button><span aria-hidden="true">/</span><span>${esc(p.fase || 'Planejamento')}</span></nav>
                    <div class="page-header pj-cab"><div class="page-header-left"><h2>${esc(p.nome)}</h2><div class="pj-chips">${[p.tipo, p.servico, p.unidade].filter(Boolean).map(x => celChip(x)).join('')}</div></div>
                        <div class="page-header-acoes">${ed ? `<label class="pj-fase-sel"><span class="sr-only">Fase do projeto</span><select data-pj-fase>${FASES.map(([f]) => `<option ${f === p.fase ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
                            <button type="button" class="btn-sec" data-pj-editar>Editar projeto</button>
                            <button type="button" class="btn-primary btn-novo" data-pj-vincular><i class="fas fa-link" aria-hidden="true"></i> Vincular demanda</button>` : ''}</div></div>
                    ${(p.etapas || []).length ? `<ol class="pj-passos">${p.etapas.map((e, i) => `<li class="${e.status}"><button type="button" data-pj-etapa="${i}" ${ed ? '' : 'disabled'} title="${ed ? (e.status === 'atual' ? 'Marcar como concluída e seguir' : 'Tornar esta a etapa atual') : ''}">
                        <span class="pj-n">${e.status === 'feita' ? '<i class="fas fa-check" aria-hidden="true"></i>' : i + 1}</span><span><b>${esc(e.nome)}</b><small>${e.status === 'feita' ? 'concluída' : e.status === 'atual' ? 'etapa atual' : ''}</small></span></button></li>`).join('')}</ol>` : ''}
                    <div class="pj-grade">
                        <div class="pj-principal">
                            <article class="pn-card pj-prog">
                                <div class="pj-prog-num"><span class="pn-num">${pr.conc}</span><span>de ${pr.total}</span></div>
                                <p>${pr.total ? 'demandas vinculadas já concluídas' : 'Nenhuma demanda vinculada ainda. Use "Vincular demanda" para trazer as demandas deste projeto.'}</p>
                                ${pr.total ? `<div class="pn-barra"><span style="width:${pct}%" class="pj-feito"></span></div><div class="pn-legenda"><span>${pr.conc} ${pr.conc === 1 ? 'concluída' : 'concluídas'}</span><span>${pr.and} em andamento</span><span>${pr.pend} ${pr.pend === 1 ? 'pendente' : 'pendentes'}</span></div>` : ''}
                            </article>
                            <article class="pn-card">
                                <div class="pn-topo"><h3 class="pn-titulo">Itens em aberto</h3><span class="pn-kpi-sub">${abertas.length} de ${ds.length}, prioridade alta primeiro</span></div>
                                ${abertas.length ? `<table class="pn-tab pj-itens"><thead><tr><th>Item</th><th>Prioridade</th><th>Aberto em</th><th>Status</th>${ed ? '<th><span class="sr-only">Ações</span></th>' : ''}</tr></thead><tbody>${abertas.map(d => `<tr>
                                    <td><button type="button" class="pj-item" data-pj-demanda="${d.id}">${celDuas('<b>' + esc(d.titulo) + '</b>', esc(d.setor || ''))}</button></td>
                                    <td>${celPill(d.prioridade || 'Baixa', d.prioridade === 'Alta' ? 'vermelho' : d.prioridade === 'Média' ? 'ambar' : 'neutro')}</td>
                                    <td>${celDiaMes(d.data)}</td><td>${d.status === 'Em Andamento' ? 'Em andamento' : esc(d.status || 'Pendente')}</td>
                                    ${ed ? `<td><button type="button" class="pj-desvincular" data-pj-desvincular="${d.id}" title="Tirar do projeto" aria-label="Tirar a demanda do projeto"><i class="fas fa-link-slash" aria-hidden="true"></i></button></td>` : ''}</tr>`).join('')}</tbody></table>`
                                    : `<p class="pn-vazio">${ds.length ? 'Todas as demandas vinculadas estão concluídas.' : 'Sem demandas vinculadas.'}</p>`}
                            </article>
                        </div>
                        <aside class="pj-lado">
                            <article class="pn-card"><h3 class="pn-titulo">Dados do projeto</h3><dl class="pj-dados">${dados.map(([r, v]) => `<div><dt>${r}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${p.objetivo ? `<p class="pj-objetivo">${esc(p.objetivo)}</p>` : ''}</article>
                            <article class="pn-card"><h3 class="pn-titulo">Documentos</h3>
                                <ul class="pj-docs">${(p.documentos || []).map((d, i) => `<li><a href="#" class="anexo-abrir" data-path="${esc(d.path)}">${esc(d.nome)}</a>${ed ? `<button type="button" data-pj-doc-tirar="${i}" aria-label="Remover ${esc(d.nome)}">Remover</button>` : ''}</li>`).join('') || '<li class="pj-docs-vazio">Nenhum documento anexado.</li>'}</ul>
                                ${ed ? `<label class="btn-sec pj-doc-add"><input type="file" multiple accept="image/*,application/pdf" data-pj-doc>Anexar documento</label>` : ''}</article>
                            ${pode('projetos', 'excluir') ? '<button type="button" class="pj-excluir" data-pj-excluir>Excluir projeto</button>' : ''}
                        </aside>
                    </div>`;
            }
            window.abrirProjeto = function (id) { aberto = id; renderizarProjetos(); const h = document.querySelector('#pj-detalhe h2'); if (h) { h.tabIndex = -1; h.focus(); } };

            async function salvarCampos(p, campos, aviso) {
                const { error } = await sb.from('projetos').update(campos).eq('id', p.id);
                if (error) { alert('Não foi possível salvar: ' + error.message); return false; }
                Object.assign(p, campos);
                registrarLog('Edição', 'Projetos', `${aviso}: ${p.nome}`);
                renderizarProjetos(); if (typeof renderizarDashboard === 'function' && $('dashboard').classList.contains('active')) renderizarDashboard();
                return true;
            }
            async function vincular(idDemanda, idProjeto) {
                const { error } = await sb.from('demandas').update({ projeto_id: idProjeto }).eq('id', idDemanda);
                if (error) { alert('Não foi possível alterar a demanda: ' + error.message); return false; }
                const d = listaDemandas().find(x => x.id == idDemanda); if (d) d.projeto_id = idProjeto;
                registrarLog('Edição', 'Projetos', `${idProjeto ? 'Vinculou' : 'Desvinculou'} a demanda ${idDemanda}`);
                return true;
            }

            // ── Cliques e mudanças na tela de projetos ──
            document.addEventListener('click', async (e) => {
                const sec = e.target.closest('#projetos'); if (!sec) return;
                const v = e.target.closest('.pj-visao button');
                if (v) { visao = v.dataset.visao; try { localStorage.setItem('dzel.visao.projetos', visao); } catch (er) {} renderizarProjetos(); return; }
                const c = e.target.closest('[data-projeto]');
                if (c) { abrirProjeto(Number(c.dataset.projeto)); return; }
                const p = projetos.find(x => x.id == aberto); if (!p) return;
                if (e.target.closest('[data-pj-voltar]')) { aberto = null; renderizarProjetos(); const b = document.querySelector(`[data-projeto="${p.id}"]`); if (b) b.focus(); return; }
                if (e.target.closest('[data-pj-editar]')) { editarProjeto(p.id); return; }
                if (e.target.closest('[data-pj-vincular]')) { abrirVincular(p.id); return; }
                const et = e.target.closest('[data-pj-etapa]');
                if (et && podeEditar()) {
                    const i = Number(et.dataset.pjEtapa), lista = (p.etapas || []).map(x => ({ ...x }));
                    const avancar = lista[i] && lista[i].status === 'atual';
                    lista.forEach((x, k) => { x.status = k < i ? 'feita' : k === i ? 'atual' : 'futura'; });
                    if (avancar) { lista[i].status = 'feita'; if (lista[i + 1]) lista[i + 1].status = 'atual'; }
                    await salvarCampos(p, { etapas: lista }, 'Mudou a etapa do projeto');
                    return;
                }
                const dm = e.target.closest('[data-pj-demanda]');
                if (dm) { painelAbrirDemanda(Number(dm.dataset.pjDemanda)); return; }
                const dv = e.target.closest('[data-pj-desvincular]');
                if (dv) { if (await vincular(Number(dv.dataset.pjDesvincular), null)) renderizarProjetos(); return; }
                const dt = e.target.closest('[data-pj-doc-tirar]');
                if (dt) {
                    const docs = [...(p.documentos || [])]; const [tirado] = docs.splice(Number(dt.dataset.pjDocTirar), 1);
                    if (tirado && confirm(`Remover "${tirado.nome}" do projeto?`)) {
                        if (await salvarCampos(p, { documentos: docs }, 'Removeu documento do projeto')) sb.storage.from('anexos').remove([tirado.path]).catch(() => {});
                    }
                    return;
                }
                if (e.target.closest('[data-pj-excluir]')) {
                    if (!confirm(`Excluir o projeto "${p.nome}"? As demandas vinculadas continuam existindo, só deixam de estar ligadas a ele.`)) return;
                    const { error } = await sb.from('projetos').delete().eq('id', p.id);
                    if (error) { alert('Não foi possível excluir: ' + error.message); return; }
                    registrarLog('Exclusão', 'Projetos', `Excluiu o projeto: ${p.nome}`);
                    projetos = projetos.filter(x => x.id !== p.id); listaDemandas().forEach(d => { if (d.projeto_id == p.id) d.projeto_id = null; });
                    aberto = null; renderizarProjetos(); showToast('Projeto excluído.', 'success');
                }
            });
            document.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('#projetos tr[data-projeto]')) { e.preventDefault(); abrirProjeto(Number(e.target.dataset.projeto)); }
            });
            document.addEventListener('change', async (e) => {
                const p = (typeof projetos !== 'undefined') ? projetos.find(x => x.id == aberto) : null;
                if (e.target.matches('[data-pj-fase]') && p) { await salvarCampos(p, { fase: e.target.value }, 'Mudou a fase do projeto'); return; }
                if (e.target.matches('[data-pj-doc]') && p) {
                    const docs = [...(p.documentos || [])];
                    for (const f of Array.from(e.target.files || [])) {
                        try { docs.push({ path: await enviarArquivo('projetos', f), nome: f.name, tipo: f.type, tamanho: f.size }); }
                        catch (er) { showToast(`"${f.name}" não foi enviado: ${er.message || er}`, 'warning', 6000); }
                    }
                    if (docs.length !== (p.documentos || []).length) await salvarCampos(p, { documentos: docs }, 'Anexou documento ao projeto');
                }
            });

            // ── Formulário (painel lateral) ──
            function desenharEtapas(nomes) {
                $('pj-etapas').innerHTML = nomes.map((n, i) => `<li><input type="text" value="${esc(n)}" aria-label="Etapa ${i + 1}"><button type="button" class="pj-etapa-tirar" aria-label="Tirar a etapa ${i + 1}"><i class="fas fa-xmark" aria-hidden="true"></i></button></li>`).join('');
            }
            window.cancelarEdicaoProjeto = function () {
                $('form-projeto').reset(); $('projeto-id-edit').value = '';
                $('titulo-form-projeto').textContent = 'Novo projeto'; $('btn-submit-projeto').textContent = 'Criar projeto';
                $('pj-etapas').dataset.mexido = ''; desenharEtapas(ETAPAS[$('pj-tipo').value] || []);
                window.preencherContratosProjeto?.(null);
            };
            window.editarProjeto = function (id) {
                const p = projetos.find(x => x.id == id); if (!p) return;
                cancelarEdicaoProjeto();
                $('projeto-id-edit').value = p.id; $('pj-nome').value = p.nome || '';
                const sel = (id, v) => { const el = $(id); if (v != null && [...el.options].some(o => (o.value || o.text) === v)) el.value = v; };
                sel('pj-tipo', p.tipo); sel('pj-fase', p.fase); sel('pj-unidade', p.unidade); sel('pj-servico', p.servico || '');
                $('pj-responsavel').value = p.responsavel || ''; $('pj-pedido').value = p.pedido_por || ''; $('pj-sei').value = p.processo_sei || '';
                $('pj-prazo').value = p.prazo || ''; $('pj-origem').value = p.origem || ''; $('pj-pca').value = p.item_pca || ''; $('pj-objetivo').value = p.objetivo || '';
                $('pj-etapas').dataset.mexido = '1'; desenharEtapas((p.etapas || []).map(x => x.nome));
                window.preencherContratosProjeto?.(p.contrato_id);
                $('titulo-form-projeto').textContent = 'Editar projeto'; $('btn-submit-projeto').textContent = 'Salvar projeto';
                abrirPainel('projetos');
            };
            if (typeof _PAINEIS !== 'undefined') _PAINEIS.projetos = () => cancelarEdicaoProjeto();
            $('pj-tipo').addEventListener('change', () => { if (!$('pj-etapas').dataset.mexido) desenharEtapas(ETAPAS[$('pj-tipo').value] || []); });
            $('pj-etapas').addEventListener('input', () => { $('pj-etapas').dataset.mexido = '1'; });
            $('pj-etapas').addEventListener('click', (e) => { const b = e.target.closest('.pj-etapa-tirar'); if (b) { b.closest('li').remove(); $('pj-etapas').dataset.mexido = '1'; } });
            $('pj-add-etapa').addEventListener('click', () => {
                const li = document.createElement('li');
                li.innerHTML = `<input type="text" aria-label="Nova etapa" placeholder="Nome da etapa"><button type="button" class="pj-etapa-tirar" aria-label="Tirar a etapa"><i class="fas fa-xmark" aria-hidden="true"></i></button>`;
                $('pj-etapas').appendChild(li); $('pj-etapas').dataset.mexido = '1'; li.querySelector('input').focus();
            });
            $('form-projeto').addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = val('projeto-id-edit');
                const antigo = id ? projetos.find(p => p.id == id) : null;
                const nomes = [...document.querySelectorAll('#pj-etapas input')].map(i => i.value.trim()).filter(Boolean);
                const etapas = nomes.map(n => { const a = antigo && (antigo.etapas || []).find(x => x.nome === n); return { nome: n, status: a ? a.status : 'futura' }; });
                if (etapas.length && !etapas.some(x => x.status === 'atual') && !etapas.every(x => x.status === 'feita')) etapas.find(x => x.status !== 'feita').status = 'atual';
                const reg = {
                    nome: val('pj-nome'), tipo: val('pj-tipo') || null, fase: val('pj-fase') || 'Planejamento', unidade: val('pj-unidade') || null, servico: val('pj-servico') || null,
                    responsavel: val('pj-responsavel') || null, pedido_por: val('pj-pedido') || null, processo_sei: val('pj-sei') || null, prazo: val('pj-prazo') || null,
                    origem: val('pj-origem') || null, item_pca: val('pj-pca') || null, objetivo: val('pj-objetivo') || null, etapas
                };
                if ($('pj-contrato') && !$('pj-contrato-campo').hidden) reg.contrato_id = val('pj-contrato') ? Number(val('pj-contrato')) : null;
                if (!reg.nome) { $('pj-nome').focus(); return; }
                const btn = $('btn-submit-projeto'); btn.disabled = true;
                const q = id ? sb.from('projetos').update(reg).eq('id', id).select().single() : sb.from('projetos').insert(reg).select().single();
                const { data, error } = await q;
                btn.disabled = false;
                if (error) { alert('Não foi possível salvar o projeto: ' + error.message); return; }
                registrarLog(id ? 'Edição' : 'Criação', 'Projetos', `${id ? 'Alterou o projeto' : 'Novo projeto'}: ${reg.nome}`);
                await recarregar();
                if (!id && data) aberto = data.id;
                fecharPainel({ salvo: true });
                renderizarProjetos();
                showToast(id ? 'Projeto salvo.' : 'Projeto criado.', 'success');
            });

            // ── Janela para vincular demandas ──
            let vincProjeto = null, vincVolta = null;
            window.abrirVincular = function (id) {
                vincProjeto = id; vincVolta = document.activeElement;
                const p = projetos.find(x => x.id == id);
                $('vinc-sub').textContent = p ? `Escolha as demandas que fazem parte de "${p.nome}".` : '';
                $('vinc-busca').value = ''; $('modal-vincular').style.display = 'flex';
                desenharVinculo(); $('vinc-busca').focus();
            };
            window.fecharVincular = function () {
                $('modal-vincular').style.display = 'none';
                renderizarProjetos();
                if (vincVolta && document.contains(vincVolta)) vincVolta.focus();
            };
            function desenharVinculo() {
                const termo = $('vinc-busca').value.trim().toUpperCase(), soAbertas = $('vinc-so-abertas').checked;
                const itens = listaDemandas().filter(d => (!soAbertas || d.status !== 'Concluído')
                    && (!termo || `${d.titulo} ${d.setor} ${d.numero_os || ''} ${d.contratada || ''}`.toUpperCase().includes(termo)))
                    .sort((a, b) => (a.projeto_id == vincProjeto) - (b.projeto_id == vincProjeto) || String(b.data || '').localeCompare(String(a.data || ''))).slice(0, 40);
                $('vinc-lista').innerHTML = itens.map(d => {
                    const aqui = d.projeto_id == vincProjeto, outro = d.projeto_id && !aqui ? projetos.find(x => x.id == d.projeto_id) : null;
                    return `<li><div>${celDuas('<b>' + esc(d.titulo) + '</b>', esc([d.setor, d.numero_os ? 'O.S. ' + d.numero_os : '', d.status === 'Em Andamento' ? 'Em andamento' : d.status, outro ? 'no projeto ' + outro.nome : ''].filter(Boolean).join(', ')))}</div>
                        <button type="button" class="${aqui ? 'btn-sec' : 'btn-primary'}" data-vinc="${d.id}" data-acao="${aqui ? 'tirar' : 'pôr'}">${aqui ? 'Tirar' : outro ? 'Trazer' : 'Vincular'}</button></li>`;
                }).join('') || '<li class="vinc-vazio">Nenhuma demanda encontrada.</li>';
            }
            $('vinc-busca').addEventListener('input', desenharVinculo);
            $('vinc-so-abertas').addEventListener('change', desenharVinculo);
            $('vinc-lista').addEventListener('click', async (e) => {
                const b = e.target.closest('[data-vinc]'); if (!b) return;
                b.disabled = true;
                if (await vincular(Number(b.dataset.vinc), b.dataset.acao === 'tirar' ? null : vincProjeto)) desenharVinculo(); else b.disabled = false;
            });
            if (typeof _FECHAR_MODAL !== 'undefined') _FECHAR_MODAL['modal-vincular'] = () => window.fecharVincular();

            // ── Campo "Projeto" nos formulários de demanda ──
            window.preencherOpcoesProjeto = function (box, item) {
                const sel = box && box.querySelector('[data-col="projeto_id"]'); if (!sel) return;
                const campo = sel.closest('.ex-campo');
                const liberado = pode_ver();
                campo.hidden = !liberado; sel.disabled = !liberado;
                if (!liberado) return;
                const atual = item && item.projeto_id;
                const opcoes = projetosAtivos();
                if (atual && !opcoes.some(p => p.id == atual)) { const p = projetos.find(x => x.id == atual); if (p) opcoes.push(p); }
                sel.innerHTML = '<option value="">Sem projeto</option>' + opcoes.map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
            };
            const pode_ver = () => pode('projetos', 'ver');

            // ── Painel: projetos em andamento ──
            window._pnCardProjetos = function () {
                const el = $('pn-projetos'); if (!el) return;
                if (!pode_ver() || typeof projetos === 'undefined') { el.innerHTML = ''; return; }
                const ativos = projetosAtivos().sort((a, b) => FASES.findIndex(f => f[0] === b.fase) - FASES.findIndex(f => f[0] === a.fase)).slice(0, 4);
                el.innerHTML = `<div class="pn-topo"><h3 class="pn-titulo">Projetos em andamento</h3><button type="button" class="pn-link" onclick="switchTab('projetos')">Ver todos</button></div>
                    <p class="pn-desc">Frentes com etapas e demandas vinculadas.</p>
                    <div class="pn-lista">${ativos.map(p => { const a = etapaAtual(p); return `<button type="button" class="pn-proj" onclick="switchTab('projetos'); abrirProjeto(${p.id})">
                        <span class="pn-proj-topo"><b>${esc(p.nome)}</b><span>${esc(p.fase || 'Planejamento')}</span></span>
                        <span class="pn-proj-etapa">${esc(progresso(p).total ? textoEtapa(p) : (a ? a.e.nome : 'Sem etapas definidas'))}</span>
                        ${(p.etapas || []).length ? `<span class="pj-seg" aria-hidden="true">${segmentos(p)}</span>` : ''}</button>`; }).join('') || `<p class="pn-vazio">Nenhum projeto em andamento.${podeEditar() ? ' <button type="button" class="pn-link" onclick="switchTab(\'projetos\'); novoRegistro(\'projetos\')">Criar um projeto</button>' : ''}</p>`}</div>`;
            };

            // ── Barra de atalhos do celular ──
            function montarBarra() {
                if ($('barra-inferior')) return;
                const nav = document.createElement('nav');
                nav.id = 'barra-inferior'; nav.className = 'barra-inferior no-print'; nav.setAttribute('aria-label', 'Atalhos');
                nav.innerHTML = `<button type="button" data-ir="dashboard"><i class="fas fa-chart-pie" aria-hidden="true"></i><span>Painel</span></button>
                    <button type="button" data-ir="demandas"><i class="fas fa-clipboard-list" aria-hidden="true"></i><span>Demandas</span></button>
                    <button type="button" class="barra-nova" data-ir="nova" aria-label="Nova demanda"><i class="fas fa-plus" aria-hidden="true"></i></button>
                    <button type="button" data-ir="projetos"><i class="fas fa-diagram-project" aria-hidden="true"></i><span>Projetos</span></button>
                    <button type="button" data-ir="menu"><i class="fas fa-bars" aria-hidden="true"></i><span>Mais</span></button>`;
                document.body.appendChild(nav);
                nav.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-ir]'); if (!b) return;
                    const ir = b.dataset.ir;
                    if (ir === 'menu') { toggleSidebar(); return; }
                    if (ir === 'nova') { painelNovaDemanda(); return; }
                    if (ir === 'demandas') { const aba = ['demandas', 'predial', 'ar', 'limpeza'].find(a => { const t = $('tab-' + a); return t && !t.classList.contains('hidden-tab'); }); if (aba) switchTab(aba); return; }
                    switchTab(ir);
                });
            }
            function atualizarBarra(aba) {
                const nav = $('barra-inferior'); if (!nav) return;
                const visivel = id => { const t = $('tab-' + id); return t && !t.classList.contains('hidden-tab'); };
                const algumaDemanda = ['demandas', 'predial', 'ar', 'limpeza'].some(visivel);
                const mostra = { dashboard: visivel('dashboard'), demandas: algumaDemanda, projetos: visivel('projetos'), menu: true,
                    nova: algumaDemanda && (pode('demandas', 'editar') || ['predial', 'ar', 'limpeza'].some(a => pode(a, 'editar'))) };
                nav.querySelectorAll('[data-ir]').forEach(b => {
                    b.hidden = !mostra[b.dataset.ir];
                    const ativo = b.dataset.ir === aba || (b.dataset.ir === 'demandas' && ['demandas', 'predial', 'ar', 'limpeza'].includes(aba));
                    b.classList.toggle('ativo', ativo);
                    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
                });
            }
            montarBarra();
            const trocarAba = window.switchTab;
            window.switchTab = function (aba) {
                trocarAba(aba);
                if (aba === 'projetos') renderizarProjetos();
                atualizarBarra(aba);
            };
        })();
