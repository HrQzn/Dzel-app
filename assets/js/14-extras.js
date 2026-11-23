        // ════════════════════════════════════════════════════════════════
        // ETAPA 2: campos novos nos formulários que já existiam
        // (unidade, origem, observações, foto, dados da reserva de eventos,
        // encerramento e anexos de ocorrências). Os campos são colocados
        // nos formulários por aqui e cada gravação junta os valores com
        // extrasDe(chave); cada edição preenche com preencherExtras().
        // Fotos e anexos vão para o espaço privado "anexos" do Supabase.
        // ════════════════════════════════════════════════════════════════
        const UNIDADES = ['Sede', 'Arouche', 'Armênia', 'EFAPE'];
        const ORIGENS = ['CRM', 'E-mail', 'WhatsApp', 'Telefone', 'Presencial', 'Preventiva', 'Proativa', 'Relatório da contratada'];

        // Unidade da demanda: a gravada ou, nas antigas, a que o local indica
        window.unidadeDe = function (d) {
            if (d && d.unidade) return d.unidade;
            const l = typeof _pnLocal === 'function' ? _pnLocal(d && d.setor) : {};
            return l.un && UNIDADES.includes(l.un) ? l.un : 'Sede';
        };

        (function () {
            const opc = (lista) => lista.map(o => `<option>${o}</option>`).join('');
            const sel = (col, rot, lista, vazio) => `<label class="ex-campo"><span>${rot}</span><select data-col="${col}">${vazio ? `<option value="">${vazio}</option>` : ''}${opc(lista)}</select></label>`;
            const txt = (col, rot, ph, tipo = 'text', extra = '') => `<label class="ex-campo"><span>${rot}</span><input type="${tipo}" data-col="${col}" placeholder="${ph || ''}" ${extra}></label>`;
            const area = (col, rot, ph) => `<label class="ex-campo ex-largo"><span>${rot}</span><textarea data-col="${col}" rows="3" placeholder="${ph}"></textarea></label>`;
            const foto = `<div class="ex-campo ex-largo ex-foto"><span>Foto do problema <small>opcional</small></span>
                <div class="ex-foto-linha"><a class="ex-foto-ver" target="_blank" rel="noopener" hidden><img class="ex-foto-prev" alt="Foto atual da demanda"></a>
                <input type="file" accept="image/*" data-arquivo="foto_path" aria-label="Foto do problema">
                <label class="ex-check ex-remover" hidden><input type="checkbox" data-remover="foto_path"> Remover a foto</label></div></div>`;
            const DEMANDA = sel('unidade', 'Unidade', UNIDADES) + sel('origem', 'Origem', ORIGENS, 'Não informada')
                + area('observacoes', 'Observações <small>opcional</small>', 'O que mais é importante saber sobre o pedido') + foto;
            const CAMPOS = {
                demandas: DEMANDA, predial: DEMANDA, ar: DEMANDA, limpeza: DEMANDA,
                visitantes: sel('unidade', 'Unidade', UNIDADES),
                veiculos: sel('unidade', 'Unidade', UNIDADES),
                eventos: txt('hora_inicio', 'Horário de início', '', 'time') + txt('hora_fim', 'Horário de término', '', 'time')
                    + txt('chamado', 'Chamado', 'Nº do chamado no CRM') + txt('unidade_solicitante', 'Unidade solicitante', 'Ex.: SUPED')
                    + txt('ramal', 'Ramal', 'Ramal de contato', 'text', 'inputmode="numeric"') + txt('layout', 'Layout', 'Ex.: auditório, mesas em U')
                    + txt('cadeiras', 'Cadeiras', 'Quantidade', 'number', 'min="0"') + txt('mesas', 'Mesas', 'Quantidade', 'number', 'min="0"')
                    + txt('audiovisual', 'Audiovisual', 'Ex.: microfone, projetor, som')
                    + `<label class="ex-check"><input type="checkbox" data-col="suporte_tecnico"> Suporte técnico no evento</label>`
                    + `<p class="ex-conflito ex-largo" role="status" hidden></p>`,
                ocorrencias: txt('data_encerramento', 'Data de encerramento <small>se encerrada</small>', '', 'datetime-local', 'data-se-vazio="manter" data-iso="1"')
                    + `<div class="ex-campo ex-largo"><span>Anexos <small>fotos ou relatório em PDF</small></span><ul class="ex-anexos"></ul>
                       <input type="file" multiple accept="image/*,application/pdf" data-anexos="anexos" aria-label="Anexos da ocorrência"></div>`
            };
            const FORM = { demandas: 'form-demanda', predial: 'form-predial', ar: 'form-ar', limpeza: 'form-limpeza', visitantes: 'form-visitante', veiculos: 'form-veiculo', eventos: 'form-evento', ocorrencias: 'form-ocorrencia' };
            for (const chave in CAMPOS) {
                const form = document.getElementById(FORM[chave]); if (!form) continue;
                const box = document.createElement('div');
                box.className = 'ex-grade'; box.dataset.chave = chave; box.innerHTML = CAMPOS[chave];
                const botoes = form.querySelector('.btn-container');
                form.insertBefore(box, botoes || null);
                form.addEventListener('reset', () => setTimeout(() => preencherExtras(chave, null), 0));
            }
        })();

        function _exBox(chave) { return document.querySelector(`.ex-grade[data-chave="${chave}"]`); }

        // ── Arquivos ──
        async function _exComprimir(file) {
            if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
            try {
                const bmp = await createImageBitmap(file);
                const r = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
                const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
                c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
                const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
                return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
            } catch (e) { return file; }
        }
        window.enviarArquivo = async function (pasta, file) {
            const f = await _exComprimir(file);
            if (f.size > 10 * 1024 * 1024) throw new Error(`"${file.name}" passa de 10 MB.`);
            const ext = ((f.name.match(/\.(\w+)$/) || [])[1] || (f.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase();
            const nome = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);
            const path = `${pasta}/${new Date().getFullYear()}/${nome}.${ext}`;
            const { error } = await sb.storage.from('anexos').upload(path, f, { contentType: f.type || undefined, upsert: false });
            if (error) throw error;
            return path;
        };
        const _exUrls = new Map();
        window.urlAnexo = async function (path) {
            if (!path) return null;
            const c = _exUrls.get(path); if (c && c.ate > Date.now()) return c.url;
            try {
                const { data, error } = await sb.storage.from('anexos').createSignedUrl(path, 3600);
                if (error || !data) return null;
                _exUrls.set(path, { url: data.signedUrl, ate: Date.now() + 3500 * 1000 });
                return data.signedUrl;
            } catch (e) { return null; }
        };

        // ── Ler e preencher ──
        window.extrasDe = async function (chave, antigo) {
            const box = _exBox(chave); if (!box) return {};
            const out = {};
            box.querySelectorAll('[data-col]').forEach(el => {
                let v;
                if (el.type === 'checkbox') v = el.checked;
                else if (el.type === 'number') v = el.value === '' ? null : Math.max(0, parseInt(el.value, 10) || 0);
                else v = String(el.value || '').trim();
                if (v === '') { if (el.dataset.seVazio === 'manter') return; v = null; }
                else if (el.dataset.iso && v) v = DateUtils.toDatabaseISO(v);
                else if (typeof v === 'string' && (el.tagName === 'TEXTAREA' || el.type === 'text')) v = v.toUpperCase();
                out[el.dataset.col] = v;
            });
            const avisos = [];
            const f = box.querySelector('[data-arquivo]');
            if (f) {
                const col = f.dataset.arquivo, rem = box.querySelector(`[data-remover="${col}"]`);
                if (f.files && f.files[0]) {
                    try { out[col] = await enviarArquivo(chave === 'predial' || chave === 'ar' || chave === 'limpeza' ? 'demandas' : chave, f.files[0]); }
                    catch (e) { avisos.push('A foto não foi enviada: ' + (e.message || e)); }
                } else if (rem && rem.checked) out[col] = null;
            }
            const a = box.querySelector('[data-anexos]');
            if (a) {
                let lista = [];
                try { lista = JSON.parse(a.dataset.atuais || '[]'); } catch (e) {}
                lista = lista.filter(x => !x.remover).map(({ remover, ...x }) => x);
                for (const file of Array.from(a.files || [])) {
                    try { lista.push({ path: await enviarArquivo(chave, file), nome: file.name, tipo: file.type, tamanho: file.size }); }
                    catch (e) { avisos.push(`"${file.name}" não foi enviado: ` + (e.message || e)); }
                }
                out[a.dataset.anexos] = lista;
            }
            if (avisos.length && typeof showToast === 'function') showToast(avisos.join(' '), 'warning', 7000);
            return out;
        };
        window.preencherExtras = function (chave, item) {
            const box = _exBox(chave); if (!box) return;
            box.querySelectorAll('[data-col]').forEach(el => {
                const v = item ? item[el.dataset.col] : null;
                if (el.type === 'checkbox') el.checked = !!v;
                else if (el.dataset.iso) el.value = v ? DateUtils.isoParaInputBRT(v) : '';
                else if (el.tagName === 'SELECT') {
                    const alvo = String(v == null ? '' : v).toUpperCase();
                    const op = [...el.options].find(o => (o.value || o.text).toUpperCase() === alvo);
                    el.value = op ? op.value || op.text : (el.querySelector('option[value=""]') ? '' : el.options[0].value);
                    if (!op && v && el.dataset.col === 'unidade' && typeof unidadeDe === 'function') el.value = unidadeDe(item);
                }
                else el.value = v == null ? '' : v;
            });
            const f = box.querySelector('[data-arquivo]');
            if (f) {
                f.value = '';
                const ver = box.querySelector('.ex-foto-ver'), img = box.querySelector('.ex-foto-prev'), rem = box.querySelector('.ex-remover');
                const path = item && item[f.dataset.arquivo];
                rem.querySelector('input').checked = false;
                ver.hidden = true; rem.hidden = !path; img.removeAttribute('src');
                if (path) urlAnexo(path).then(u => { if (u) { img.src = u; ver.href = u; ver.hidden = false; } });
            }
            const a = box.querySelector('[data-anexos]');
            if (a) { a.value = ''; a.dataset.atuais = JSON.stringify((item && item[a.dataset.anexos]) || []); _exListaAnexos(a); }
            if (chave === 'eventos') conferirConflitoEvento();
        };
        function _exListaAnexos(input) {
            const ul = input.parentElement.querySelector('.ex-anexos'); if (!ul) return;
            let lista = []; try { lista = JSON.parse(input.dataset.atuais || '[]'); } catch (e) {}
            ul.innerHTML = lista.map((x, i) => `<li class="${x.remover ? 'removido' : ''}"><a data-path="${esc(x.path)}" href="#" class="ex-anexo-link">${esc(x.nome || 'anexo')}</a>
                <button type="button" class="ex-anexo-tirar" data-i="${i}">${x.remover ? 'Manter' : 'Remover'}</button></li>`).join('');
        }
        document.addEventListener('click', async (e) => {
            const tirar = e.target.closest('.ex-anexo-tirar');
            if (tirar) {
                const input = tirar.closest('.ex-campo').querySelector('[data-anexos]');
                const lista = JSON.parse(input.dataset.atuais || '[]'); const x = lista[Number(tirar.dataset.i)];
                if (x) x.remover = !x.remover;
                input.dataset.atuais = JSON.stringify(lista); _exListaAnexos(input); return;
            }
            const link = e.target.closest('a.ex-anexo-link, a.anexo-abrir');
            if (link) { e.preventDefault(); const u = await urlAnexo(link.dataset.path); if (u) window.open(u, '_blank', 'noopener'); else showToast('Não foi possível abrir o anexo.', 'warning'); }
        });

        // ── Eventos: aviso de conflito de espaço e horário ──
        function _exNormLocal(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
        window.conferirConflitoEvento = function () {
            const box = _exBox('eventos'); const aviso = box && box.querySelector('.ex-conflito'); if (!aviso) return [];
            const data = (document.getElementById('evento-data') || {}).value, local = _exNormLocal((document.getElementById('evento-local') || {}).value);
            const ini = box.querySelector('[data-col="hora_inicio"]').value, fim = box.querySelector('[data-col="hora_fim"]').value;
            const id = String((document.getElementById('evento-id-edit') || {}).value || '');
            if (!data || !local || typeof eventos === 'undefined') { aviso.hidden = true; return []; }
            const choque = eventos.filter(ev => {
                if (String(ev.id) === id || ev.data !== data) return false;
                const l = _exNormLocal(ev.local); if (!l || !(l.includes(local) || local.includes(l))) return false;
                if (!ini || !fim || !ev.hora_inicio || !ev.hora_fim) return true;
                return ini < ev.hora_fim && ev.hora_inicio < fim;
            });
            if (!choque.length) { aviso.hidden = true; return []; }
            aviso.hidden = false;
            aviso.textContent = `Esse espaço já tem ${choque.length === 1 ? 'um evento' : choque.length + ' eventos'} nessa data${ini && fim ? ' e horário' : ''}: `
                + choque.map(ev => ev.nome + (ev.hora_inicio ? ` (${ev.hora_inicio}${ev.hora_fim ? ' às ' + ev.hora_fim : ''})` : '')).join('; ') + '.';
            return choque;
        };
        document.addEventListener('input', (e) => { if (e.target.closest('#form-evento')) conferirConflitoEvento(); });
        document.addEventListener('change', (e) => { if (e.target.closest('#form-evento')) conferirConflitoEvento(); });
