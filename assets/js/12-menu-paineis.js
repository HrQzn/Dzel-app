        // ════════════════════════════════════════════════════════════════
        // MENU LATERAL RECOLHÍVEL (desktop). No celular continua o menu que
        // desliza (toggleSidebar). Preferência salva em localStorage.
        // ════════════════════════════════════════════════════════════════
        const _MENU_CHAVE = 'dzel.menuRecolhido';
        function _aplicarMenu(recolhido) {
            document.documentElement.classList.toggle('menu-recolhido', recolhido);
            const btn = document.getElementById('btn-recolher-menu');
            if (btn) {
                const rotulo = recolhido ? 'Expandir menu' : 'Recolher menu';
                btn.setAttribute('aria-expanded', String(!recolhido));
                btn.setAttribute('aria-label', rotulo);
                btn.title = rotulo;
            }
            // Recolhido: o nome de cada item aparece como dica (title) e continua lido por leitor de tela
            document.querySelectorAll('.nav-tabs .tab-btn').forEach(b => {
                const nome = (b.querySelector('.tab-label')?.textContent || '').trim();
                if (recolhido) b.title = nome; else b.removeAttribute('title');
            });
        }
        window.alternarMenu = function() {
            const recolhido = !document.documentElement.classList.contains('menu-recolhido');
            _aplicarMenu(recolhido);
            try { localStorage.setItem(_MENU_CHAVE, recolhido ? '1' : '0'); } catch (e) {}
        };
        _aplicarMenu(document.documentElement.classList.contains('menu-recolhido'));

        // ════════════════════════════════════════════════════════════════
        // TEMA CLARO / ESCURO: botão no topo; a escolha fica no navegador.
        // O <head> já aplica o tema salvo antes da primeira pintura.
        // ════════════════════════════════════════════════════════════════
        const _TEMA_CHAVE = 'dzel.tema';
        function _aplicarTema(tema) {
            document.documentElement.setAttribute('data-tema', tema);
            const btn = document.getElementById('btn-tema');
            if (btn) {
                const rotulo = tema === 'claro' ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
                btn.setAttribute('aria-label', rotulo);
                btn.title = rotulo;
            }
            const barra = document.querySelector('meta[name="theme-color"]');
            if (barra) barra.setAttribute('content', tema === 'claro' ? '#F1F1F5' : '#1F1E24');
        }
        window.alternarTema = function() {
            const novo = document.documentElement.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro';
            _aplicarTema(novo);
            try { localStorage.setItem(_TEMA_CHAVE, novo); } catch (e) {}
            // Os gráficos são desenhados em canvas: refaz com as cores do tema novo
            if (typeof Chart !== 'undefined') Chart.defaults.color = getComputedStyle(document.documentElement).getPropertyValue('--t-graf-texto').trim() || Chart.defaults.color;
            if (typeof renderizarDashboard === 'function' && typeof Chart !== 'undefined') renderizarDashboard();
        };
        _aplicarTema(document.documentElement.getAttribute('data-tema') === 'claro' ? 'claro' : 'escuro');

        // ════════════════════════════════════════════════════════════════
        // PAINEL LATERAL DE FORMULÁRIO: abre só ao criar ou editar.
        // Cada módulo reaproveita a função de cancelar que já existia.
        // ════════════════════════════════════════════════════════════════
        const _PAINEIS = {
            demandas:    () => cancelarEdicaoDemanda(),
            predial:     () => cancelarEdicaoDemandaEspecifica('predial'),
            ar:          () => cancelarEdicaoDemandaEspecifica('ar'),
            limpeza:     () => cancelarEdicaoDemandaEspecifica('limpeza'),
            visitantes:  () => cancelarEdicaoVisitante(),
            veiculos:    () => cancelarEdicaoVeiculo(),
            eventos:     () => cancelarEdicaoEvento(),
            crachas:     () => cancelarEdicaoCracha(),
            ocorrencias: () => cancelarEdicaoOcorrencia(),
            usuarios:    () => cancelarEdicaoUsuario()
        };
        let _painelAberto = null, _painelOrigem = null, _painelRetrato = '';

        function _retratoCampos(painel) {
            return [...painel.querySelectorAll('input, select, textarea')]
                .map(el => (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value).join('\u0001');
        }

        window.abrirPainel = function(chave) {
            const painel = document.getElementById('painel-' + chave);
            if (!painel) return;
            if (_painelAberto && _painelAberto !== painel) _painelAberto.classList.remove('aberto');
            _painelOrigem = document.activeElement;
            _painelAberto = painel;
            painel.querySelector('.painel-corpo').scrollTop = 0;
            painel.classList.add('aberto');
            document.getElementById('painel-overlay').classList.add('aberto');
            document.getElementById('app-content').inert = true;
            _painelRetrato = _retratoCampos(painel);
            // Desktop: foco no 1º campo. Celular: foco no painel (o teclado não abre sozinho).
            const campo = window.matchMedia('(max-width: 900px)').matches ? null :
                [...painel.querySelectorAll('.painel-corpo input, .painel-corpo select, .painel-corpo textarea')]
                    .find(el => el.type !== 'hidden' && el.type !== 'file' && !el.disabled && el.offsetParent !== null);
            (campo || painel).focus({ preventScroll: true });
        };

        window.novoRegistro = function(chave) {
            // Limpa e põe data/hora atuais. Usuários não: o reset dele desmarca a
            // permissão padrão "Demandas: Visualizar" (ao fechar ele já é limpo).
            if (chave !== 'usuarios' && _PAINEIS[chave]) _PAINEIS[chave]();
            abrirPainel(chave);
        };

        // opcoes.salvo = true: chamado depois de gravar com sucesso (não pergunta nada)
        window.fecharPainel = function(opcoes = {}) {
            const painel = _painelAberto;
            if (!painel) return;
            if (!opcoes.salvo && _retratoCampos(painel) !== _painelRetrato &&
                !confirm('Descartar o que foi preenchido?')) return;
            const chave = painel.id.replace('painel-', '');
            if (_PAINEIS[chave]) _PAINEIS[chave]();   // volta o formulário ao modo "novo" (e para a câmera)
            painel.classList.remove('aberto');
            document.getElementById('painel-overlay').classList.remove('aberto');
            document.getElementById('app-content').inert = false;
            _painelAberto = null;
            const volta = (_painelOrigem && document.contains(_painelOrigem) && _painelOrigem !== document.body)
                ? _painelOrigem : document.querySelector('#' + chave + ' .btn-novo');
            if (volta) volta.focus({ preventScroll: true });
        };

        // Esc: modal aberto tem prioridade (já tratado em 01-core.js); depois painel; depois menu do celular
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const modalAberto = [...document.querySelectorAll('.modal-overlay')].some(m => m.style.display === 'flex');
            if (modalAberto) return;
            if (_painelAberto) { e.preventDefault(); fecharPainel(); return; }
            if (document.body.classList.contains('sidebar-open')) toggleSidebar();
        });
