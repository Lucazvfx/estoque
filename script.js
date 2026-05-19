(function() {
    const API_BASE = '/api';
    let currentView = 'dashboard';
    let searchQuery = '';
    let chartInstances = {};
    
    let produtosCache = [];
    let lotesCache = [];
    let categoriasCache = [];
    let movimentacoesCache = [];
    let entregasCache = [];

    // ========== ÍCONES SVG ==========
    const iconsSvg = {
        dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5v-7H9v7H5a2 2 0 0 1-2-2z"/><path d="M9 22v-7h6v7"/></svg>`,
        analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/><rect x="2" y="2" width="20" height="20" rx="2"/></svg>`,
        alerts: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5-3 8-6 8h-8c-3 0-6-3-6-8a10 10 0 0 1 10-10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
        products: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-4.5M4 7h4.5M12 4v3"/><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7c0 2.2-1.8 4-4 4s-4-1.8-4-4"/></svg>`,
        lots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>`,
        movements: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-3 3 3 3-3 2 3h4"/><path d="M3 16h4l2-3 3 3 3-3 2 3h4"/><path d="M3 8h4l2-3 3 3 3-3 2 3h4"/></svg>`,
        categories: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
        deliveries: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H5.78a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82l.07.08A10 10 0 0 0 12 17.66a10 10 0 0 0 6.18-2.58z"/><path d="M5.6 9c-.3.3-.6.8-.6 1.4 0 .6.3 1 .6 1.4"/></svg>`
    };

    // ========== UTILITÁRIOS ==========
    function showToast(msg, type = 'info') {
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
        document.getElementById('toastContainer').appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    function formatDate(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }
    function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }

    async function apiRequest(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.erro || err.mensagem || 'Erro na requisição');
        }
        return res.json();
    }

    async function loadAllData() {
        try {
            [produtosCache, lotesCache, categoriasCache, movimentacoesCache, entregasCache] = await Promise.all([
                apiRequest('/produtos'),
                apiRequest('/lotes'),
                apiRequest('/categorias'),
                apiRequest('/movimentacoes'),
                apiRequest('/entregas').catch(() => [])
            ]);
        } catch (err) {
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        }
    }

    // ========== SIDEBAR ==========
    function renderSidebar() {
        const alertCount = getAlertsCount();
        const nav = [
            { id: 'dashboard', label: 'Dashboard', icon: iconsSvg.dashboard },
            { id: 'analytics', label: 'Análises', icon: iconsSvg.analytics },
            { id: 'alerts', label: 'Alertas', icon: iconsSvg.alerts, badge: alertCount },
            { id: 'products', label: 'Produtos', icon: iconsSvg.products },
            { id: 'lots', label: 'Lotes', icon: iconsSvg.lots },
            { id: 'movements', label: 'Movimentações', icon: iconsSvg.movements },
            { id: 'categories', label: 'Categorias', icon: iconsSvg.categories },
            { id: 'deliveries', label: 'Entregas', icon: iconsSvg.deliveries },
            { id: 'settings', label: 'Configurações', icon: iconsSvg.settings }
        ];
        document.getElementById('sidebarNav').innerHTML = nav.map(item => `
            <button class="${currentView === item.id ? 'active' : ''}" onclick="window.navigateTo('${item.id}')">
                ${item.icon}
                <span>${item.label}</span>
                ${item.badge ? `<span class="badge-alert">${item.badge}</span>` : ''}
            </button>
        `).join('');
    }

    function getAlertsCount() {
        if (!produtosCache.length) return 0;
        const lowStock = produtosCache.filter(p => p.quantidade <= p.estoque_minimo).length;
        const expiring = lotesCache.filter(l => {
            if (!l.data_validade) return false;
            const diff = (new Date(l.data_validade) - new Date()) / (1000 * 3600 * 24);
            return diff >= 0 && diff <= 30;
        }).length;
        return lowStock + expiring;
    }

    // ========== NAVEGAÇÃO ==========
    window.navigateTo = async (view) => {
        currentView = view;
        searchQuery = '';
        Object.values(chartInstances).forEach(c => c.destroy());
        chartInstances = {};
        renderSidebar();
        await loadAllData();
        await renderCurrentView();
        if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('active');
    };

    async function renderCurrentView() {
        switch (currentView) {
            case 'dashboard': await renderDashboard(); break;
            case 'analytics': await renderAnalytics(); break;
            case 'alerts': await renderAlerts(); break;
            case 'products': await renderProducts(); break;
            case 'lots': await renderLots(); break;
            case 'movements': await renderMovements(); break;
            case 'categories': await renderCategories(); break;
            case 'deliveries': await renderDeliveries(); break;
            case 'settings': await renderSettings(); break;
        }
    }

    // ========== DASHBOARD ==========
    async function renderDashboard() {
        const totalProdutos = produtosCache.length;
        const totalLotes = lotesCache.length;
        const totalStock = produtosCache.reduce((s, p) => s + p.quantidade, 0);
        const totalValue = produtosCache.reduce((s, p) => s + (p.quantidade * p.preco_custo), 0);
        const lowStock = produtosCache.filter(p => p.quantidade <= p.estoque_minimo).length;
        const ultimasMovs = movimentacoesCache.slice(0, 8);
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><h1 class="page-title">Dashboard</h1></div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon">📦</div><div><div class="stat-value">${totalProdutos}</div><div class="stat-label">Produtos</div></div></div>
                <div class="stat-card"><div class="stat-icon">🏷️</div><div><div class="stat-value">${totalLotes}</div><div class="stat-label">Lotes</div></div></div>
                <div class="stat-card"><div class="stat-icon">📊</div><div><div class="stat-value">${totalStock}</div><div class="stat-label">Estoque Total</div></div></div>
                <div class="stat-card"><div class="stat-icon">💰</div><div><div class="stat-value">${formatCurrency(totalValue)}</div><div class="stat-label">Valor Total</div></div></div>
                <div class="stat-card"><div class="stat-icon">⚠️</div><div><div class="stat-value">${lowStock}</div><div class="stat-label">Estoque Baixo</div></div></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Ações Rápidas</h3></div>
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="window.addProduct()">➕ Novo Produto</button>
                    <button class="btn btn-success" onclick="window.addLot()">🏷️ Novo Lote</button>
                    <button class="btn btn-outline" onclick="window.openScanner()">📷 Escanear QR</button>
                    <button class="btn btn-outline" onclick="window.captureAndRecognize()">🔍 Ler Nome</button>
                    <button class="btn btn-outline" onclick="window.printLabels()">🖨️ Etiquetas</button>
                    <button class="btn btn-outline" onclick="window.exportCSV()">📥 Exportar</button>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Últimas Movimentações</h3></div>
                ${ultimasMovs.length ? `
                    <div class="table-container"><table>
                        <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th></tr></thead>
                        <tbody>${ultimasMovs.map(m => `
                            <tr>
                                <td>${formatDate(m.data)}</td><td>${m.produto_nome}</td><td><span class="badge ${m.tipo === 'in' ? 'badge-success' : 'badge-danger'}">${m.tipo === 'in' ? 'Entrada' : 'Saída'}</span></td><td>${m.quantidade}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                ` : '<div class="empty-state">Nenhuma movimentação</div>'}
            </div>
        `;
    }

    // ========== PRODUTOS ==========
    async function renderProducts() {
        const filtered = produtosCache.filter(p => !searchQuery || p.nome.toLowerCase().includes(searchQuery) || p.sku.toLowerCase().includes(searchQuery));
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><div><h1 class="page-title">📦 Produtos</h1><p>${produtosCache.length} produtos</p></div><button class="btn btn-primary" onclick="window.addProduct()">➕ Novo</button></div>
            <div class="search-bar"><input type="text" placeholder="Buscar..." value="${searchQuery}" oninput="window.updateSearch(this.value)"></div>
            <div class="card">
                ${filtered.length === 0 ? '<div class="empty-state">Nenhum produto</div>' : `
                    <div class="table-container"><table>
                        <thead><tr><th>Nome</th><th>SKU</th><th>Categoria</th><th>Estoque</th><th>Controla Validade</th><th>Custo</th><th>Venda</th><th>Ações</th></tr></thead>
                        <tbody>${filtered.map(p => `
                            <tr>
                                <td><strong>${p.nome}</strong><br><small>${p.fornecedor || ''}</small></td>
                                <td>${p.sku}</td>
                                <td>${categoriasCache.find(c=>c.id===p.categoria_id)?.nome || '-'}</td>
                                <td><span class="badge ${p.quantidade <= p.estoque_minimo ? 'badge-danger' : 'badge-success'}">${p.quantidade} ${p.unidade}</span></td>
                                <td>${p.controla_validade ? '✅ Sim' : '❌ Não'}</td>
                                <td>${formatCurrency(p.preco_custo)}</td><td>${formatCurrency(p.preco_venda)}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn-sm btn-outline" onclick="window.editProduct('${p.id}')">✏️</button>
                                        <button class="btn-sm btn-success" onclick="window.addMovement('${p.id}','in')">↓</button>
                                        <button class="btn-sm btn-danger" onclick="window.addMovement('${p.id}','out')">↑</button>
                                        <button class="btn-sm btn-outline" onclick="window.generateQRProduct('${p.id}')">📷</button>
                                        <button class="btn-sm btn-danger" onclick="window.deleteProduct('${p.id}')">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                `}
            </div>
        `;
    }

    window.addProduct = async () => {
        const catOptions = categoriasCache.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
        const body = `
            <div class="form-row"><div class="form-group"><label>Nome*</label><input id="prodNome"></div><div class="form-group"><label>SKU*</label><input id="prodSku"></div></div>
            <div class="form-row"><div class="form-group"><label>Categoria</label><select id="prodCategoria"><option value="">Sem categoria</option>${catOptions}</select></div><div class="form-group"><label>Unidade</label><select id="prodUnidade"><option value="un">Unidade</option><option value="kg">kg</option><option value="L">L</option><option value="sc">Saca</option></select></div></div>
            <div class="form-row"><div class="form-group"><label>Custo (R$)</label><input type="number" id="prodCusto" step="0.01"></div><div class="form-group"><label>Venda (R$)</label><input type="number" id="prodVenda" step="0.01"></div></div>
            <div class="form-group"><label>Fornecedor</label><input id="prodFornecedor"></div>
            <div class="form-group"><label>Estoque Mínimo</label><input type="number" id="prodMinStock" value="5"></div>
            <div class="form-group"><label><input type="checkbox" id="prodControlaValidade"> Controlar validade (exige lote e bloqueia vencido)</label></div>
        `;
        openModal('Novo Produto', body, `<button class="btn btn-primary" id="saveProdBtn">Salvar</button>`);
        document.getElementById('saveProdBtn').onclick = async () => {
            const data = {
                nome: document.getElementById('prodNome').value,
                sku: document.getElementById('prodSku').value,
                categoria_id: document.getElementById('prodCategoria').value || null,
                unidade: document.getElementById('prodUnidade').value,
                preco_custo: parseFloat(document.getElementById('prodCusto').value) || 0,
                preco_venda: parseFloat(document.getElementById('prodVenda').value) || 0,
                fornecedor: document.getElementById('prodFornecedor').value,
                estoque_minimo: parseInt(document.getElementById('prodMinStock').value),
                controla_validade: document.getElementById('prodControlaValidade').checked
            };
            if (!data.nome || !data.sku) return showToast('Preencha nome e SKU', 'error');
            try {
                await apiRequest('/produtos', { method: 'POST', body: JSON.stringify(data) });
                showToast('Produto criado', 'success');
                closeModal();
                await loadAllData();
                await renderProducts();
            } catch (err) { showToast(err.message, 'error'); }
        };
    };

    window.editProduct = async (id) => {
        const p = produtosCache.find(p => p.id === id);
        if (!p) return;
        const catOptions = categoriasCache.map(c => `<option value="${c.id}" ${p.categoria_id === c.id ? 'selected' : ''}>${c.nome}</option>`).join('');
        const body = `
            <div class="form-row"><div class="form-group"><label>Nome*</label><input id="prodNome" value="${p.nome}"></div><div class="form-group"><label>SKU*</label><input id="prodSku" value="${p.sku}"></div></div>
            <div class="form-row"><div class="form-group"><label>Categoria</label><select id="prodCategoria"><option value="">Sem categoria</option>${catOptions}</select></div><div class="form-group"><label>Unidade</label><select id="prodUnidade">${['un','kg','L','sc'].map(u => `<option value="${u}" ${p.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
            <div class="form-row"><div class="form-group"><label>Custo (R$)</label><input type="number" id="prodCusto" step="0.01" value="${p.preco_custo}"></div><div class="form-group"><label>Venda (R$)</label><input type="number" id="prodVenda" step="0.01" value="${p.preco_venda}"></div></div>
            <div class="form-group"><label>Fornecedor</label><input id="prodFornecedor" value="${p.fornecedor || ''}"></div>
            <div class="form-group"><label>Estoque Mínimo</label><input type="number" id="prodMinStock" value="${p.estoque_minimo}"></div>
            <div class="form-group"><label><input type="checkbox" id="prodControlaValidade" ${p.controla_validade ? 'checked' : ''}> Controlar validade (exige lote e bloqueia vencido)</label></div>
        `;
        openModal('Editar Produto', body, `<button class="btn btn-primary" id="saveProdBtn">Salvar</button>`);
        document.getElementById('saveProdBtn').onclick = async () => {
            const data = {
                nome: document.getElementById('prodNome').value,
                sku: document.getElementById('prodSku').value,
                categoria_id: document.getElementById('prodCategoria').value || null,
                unidade: document.getElementById('prodUnidade').value,
                preco_custo: parseFloat(document.getElementById('prodCusto').value) || 0,
                preco_venda: parseFloat(document.getElementById('prodVenda').value) || 0,
                fornecedor: document.getElementById('prodFornecedor').value,
                estoque_minimo: parseInt(document.getElementById('prodMinStock').value),
                controla_validade: document.getElementById('prodControlaValidade').checked
            };
            try {
                await apiRequest(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                showToast('Produto atualizado', 'success');
                closeModal();
                await loadAllData();
                await renderProducts();
            } catch (err) { showToast(err.message, 'error'); }
        };
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Excluir produto? Todas as movimentações e lotes serão removidos.')) return;
        try {
            await apiRequest(`/produtos/${id}`, { method: 'DELETE' });
            showToast('Produto excluído', 'success');
            await loadAllData();
            await renderProducts();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // Movimentação com suporte a controle de validade
    window.addMovement = async (prodId, tipo) => {
        const produto = produtosCache.find(p => p.id === prodId);
        if (!produto) return;

        let lotesHtml = '';
        let temLotes = false;
        let lotesDisponiveis = [];

        if (produto.controla_validade) {
            try {
                const todosLotes = lotesCache.filter(l => l.produto_id === prodId && l.quantidade > 0);
                if (tipo === 'out') {
                    lotesDisponiveis = todosLotes.filter(l => !l.data_validade || new Date(l.data_validade) >= new Date());
                } else {
                    lotesDisponiveis = todosLotes;
                }
                if (lotesDisponiveis.length) {
                    temLotes = true;
                    lotesHtml = `<div class="form-group"><label>Lote</label><select id="movLote">
                        ${lotesDisponiveis.map(l => `<option value="${l.id}" data-validade="${l.data_validade}">${l.codigo} (${l.quantidade} disponíveis - val. ${formatDate(l.data_validade)})</option>`).join('')}
                    </select></div>`;
                } else {
                    if (tipo === 'out') {
                        showToast('Produto com controle de validade não possui lotes disponíveis (vencidos ou sem estoque)', 'error');
                        return;
                    }
                }
            } catch (err) {
                showToast('Erro ao carregar lotes', 'error');
                return;
            }
        }

        const body = `
            <div class="form-group"><label>Produto</label><input value="${produto.nome}" disabled></div>
            <div class="form-group"><label>Tipo</label><input value="${tipo === 'in' ? 'Entrada' : 'Saída'}" disabled></div>
            ${temLotes ? lotesHtml : ''}
            <div class="form-group"><label>Quantidade</label><input type="number" id="movQty" value="1" min="1"></div>
            <div class="form-group"><label>Motivo</label><textarea id="movMotivo"></textarea></div>
        `;
        openModal(`${tipo === 'in' ? 'Entrada' : 'Saída'} de Estoque`, body, `<button class="btn btn-primary" id="saveMoveBtn">Registrar</button>`);
        
        document.getElementById('saveMoveBtn').onclick = async () => {
            const qty = parseFloat(document.getElementById('movQty').value);
            if (isNaN(qty) || qty <= 0) return showToast('Quantidade inválida', 'error');
            const motivo = document.getElementById('movMotivo').value;
            const loteId = temLotes ? document.getElementById('movLote').value : null;

            if (tipo === 'out' && loteId) {
                const loteSelecionado = lotesDisponiveis.find(l => l.id === loteId);
                if (loteSelecionado && loteSelecionado.data_validade && new Date(loteSelecionado.data_validade) < new Date()) {
                    showToast('Lote vencido! Não é permitido dar saída.', 'error');
                    return;
                }
            }

            try {
                await apiRequest('/movimentacoes', {
                    method: 'POST',
                    body: JSON.stringify({
                        produto_id: prodId,
                        tipo: tipo,
                        quantidade: qty,
                        lote_id: loteId,
                        motivo: motivo
                    })
                });
                showToast('Movimentação registrada', 'success');
                closeModal();
                await loadAllData();
                await renderCurrentView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
    };

    // ========== LOTES ==========
    async function renderLots() {
        const filtered = lotesCache.filter(l => !searchQuery || l.codigo.toLowerCase().includes(searchQuery) || (l.produto && l.produto.nome.toLowerCase().includes(searchQuery)));
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><div><h1 class="page-title">🏷️ Lotes</h1><p>${lotesCache.length} lotes</p></div><button class="btn btn-primary" onclick="window.addLot()">➕ Novo Lote</button></div>
            <div class="search-bar"><input type="text" placeholder="Buscar..." value="${searchQuery}" oninput="window.updateSearch(this.value)"></div>
            <div class="card">
                ${filtered.length === 0 ? '<div class="empty-state">Nenhum lote</div>' : `
                    <div class="table-container"><tr>
                        <thead><tr><th>Código</th><th>Produto</th><th>Qtd</th><th>Validade</th><th>Ações</th></tr></thead>
                        <tbody>${filtered.map(l => `
                            <tr>
                                <td><strong>${l.codigo}</strong></td>
                                <td>${l.produto ? l.produto.nome : '-'}</td><td>${l.quantidade}</td><td>${formatDate(l.data_validade)}</td>
                                <td>
                                    <div class="btn-group">
                                        <button class="btn-sm btn-outline" onclick="window.editLot('${l.id}')">✏️</button>
                                        <button class="btn-sm btn-danger" onclick="window.deleteLot('${l.id}')">🗑️</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                `}
            </div>
        `;
    }

    window.addLot = async () => {
        const prodOptions = produtosCache.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
        const body = `
            <div class="form-row"><div class="form-group"><label>Produto</label><select id="lotProduto">${prodOptions}</select></div><div class="form-group"><label>Código</label><input id="lotCodigo"></div></div>
            <div class="form-row"><div class="form-group"><label>Quantidade</label><input type="number" id="lotQtd" value="0"></div><div class="form-group"><label>Validade</label><input type="date" id="lotValidade"></div></div>
            <div class="form-group"><label>Fornecedor</label><input id="lotFornecedor"></div>
        `;
        openModal('Novo Lote', body, `<button class="btn btn-primary" id="saveLotBtn">Salvar</button>`);
        document.getElementById('saveLotBtn').onclick = async () => {
            const data = {
                produto_id: document.getElementById('lotProduto').value,
                codigo: document.getElementById('lotCodigo').value,
                quantidade: parseInt(document.getElementById('lotQtd').value) || 0,
                data_validade: document.getElementById('lotValidade').value || null,
                fornecedor: document.getElementById('lotFornecedor').value
            };
            if (!data.produto_id || !data.codigo || data.quantidade <= 0) return showToast('Preencha todos os campos', 'error');
            try {
                await apiRequest('/lotes', { method: 'POST', body: JSON.stringify(data) });
                showToast('Lote criado', 'success');
                closeModal();
                await loadAllData();
                await renderLots();
            } catch (err) { showToast(err.message, 'error'); }
        };
    };

    window.deleteLot = async (id) => {
        if (!confirm('Excluir lote?')) return;
        try {
            await apiRequest(`/lotes/${id}`, { method: 'DELETE' });
            showToast('Lote excluído', 'success');
            await loadAllData();
            await renderLots();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // ========== MOVIMENTAÇÕES ==========
    async function renderMovements() {
        const movs = [...movimentacoesCache].reverse();
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><h1 class="page-title">🔄 Movimentações</h1></div>
            <div class="card">
                ${movs.length === 0 ? '<div class="empty-state">Nenhuma movimentação</div>' : `
                    <div class="table-container"><table>
                        <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Lote</th><th>Motivo</th></tr></thead>
                        <tbody>${movs.map(m => `
                            <tr>
                                <td>${formatDate(m.data)}</td><td>${m.produto_nome}</td><td><span class="badge ${m.tipo === 'in' ? 'badge-success' : 'badge-danger'}">${m.tipo === 'in' ? 'Entrada' : 'Saída'}</span></td><td>${m.quantidade}</td><td>${m.lote_codigo || '-'}</td><td>${m.motivo || '-'}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                `}
            </div>
        `;
    }

    // ========== CATEGORIAS ==========
    async function renderCategories() {
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><div><h1 class="page-title">📁 Categorias</h1><p>${categoriasCache.length} categorias</p></div><button class="btn btn-primary" onclick="window.addCategory()">➕ Nova</button></div>
            <div class="card">
                ${categoriasCache.length === 0 ? '<div class="empty-state">Nenhuma categoria</div>' : `
                    <div class="table-container"><table>
                        <thead><tr><th>Nome</th><th>Cor</th><th>Ações</th></tr></thead>
                        <tbody>${categoriasCache.map(c => `
                            <tr>
                                <td><strong>${c.nome}</strong></td>
                                <td><span style="display:inline-block;width:24px;height:24px;background:${c.cor};border-radius:12px;"></span></td>
                                <td><button class="btn-sm btn-danger" onclick="window.deleteCategory('${c.id}')">🗑️</button></td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                `}
            </div>
        `;
    }

    window.addCategory = async () => {
        const nome = prompt('Nome da categoria:');
        if (!nome) return;
        try {
            await apiRequest('/categorias', { method: 'POST', body: JSON.stringify({ nome, cor: '#888888' }) });
            showToast('Categoria criada', 'success');
            await loadAllData();
            await renderCategories();
        } catch (err) { showToast(err.message, 'error'); }
    };

    window.deleteCategory = async (id) => {
        if (!confirm('Excluir categoria?')) return;
        try {
            await apiRequest(`/categorias/${id}`, { method: 'DELETE' });
            showToast('Categoria excluída', 'success');
            await loadAllData();
            await renderCategories();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // ========== ENTREGAS ==========
    async function renderDeliveries() {
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><div><h1 class="page-title">🚚 Entregas</h1><p>${entregasCache.length} entregas</p></div><button class="btn btn-primary" onclick="window.novaEntrega()">➕ Nova Entrega</button></div>
            <div class="card">
                ${entregasCache.length === 0 ? '<div class="empty-state">Nenhuma entrega cadastrada</div>' : `
                    <div class="table-container"><table>
                        <thead><tr><th>Data Saída</th><th>Prevista</th><th>Real</th><th>Status</th><th>Veículo</th><th>Motorista</th><th>Itens</th><th>Ações</th></tr></thead>
                        <tbody>${entregasCache.map(e => `
                            <tr>
                                <td>${formatDate(e.data_saida)}</td><td>${e.data_prevista ? formatDate(e.data_prevista) : '-'}</td><td>${e.data_real ? formatDate(e.data_real) : '-'}</td><td><span class="badge ${e.status === 'entregue' ? 'badge-success' : e.status === 'transporte' ? 'badge-warning' : 'badge-info'}">${e.status}</span></td><td>${e.veiculo || '-'}</td><td>${e.motorista || '-'}</td><td>${e.itens ? e.itens.map(i => `${i.produto_nome} (${i.quantidade})`).join(', ') : '-'}</td><td><button class="btn-sm btn-outline" onclick="window.atualizarStatusEntrega('${e.id}')">✏️ Status</button></td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                `}
            </div>
        `;
    }

    window.novaEntrega = async () => {
        const produtosDisponiveis = produtosCache.filter(p => p.quantidade > 0);
        let itensHtml = '<div id="itensContainer">';
        itensHtml += `
            <div class="item-row">
                <select class="produto-select" style="flex:2">${produtosDisponiveis.map(p => `<option value="${p.id}">${p.nome} (disp: ${p.quantidade})</option>`).join('')}</select>
                <input type="number" placeholder="Quantidade" class="qtd-input" style="flex:1">
                <input type="text" placeholder="Lote (opcional)" class="lote-input" style="flex:1">
            </div>
        `;
        itensHtml += '</div><button type="button" class="btn-sm btn-outline" id="addItemBtn">+ Adicionar outro produto</button>';
        
        const body = `
            <div class="form-row">
                <div class="form-group"><label>Data prevista</label><input type="date" id="entregaPrevista"></div>
                <div class="form-group"><label>Veículo</label><input id="entregaVeiculo"></div>
            </div>
            <div class="form-group"><label>Motorista</label><input id="entregaMotorista"></div>
            <div class="form-group"><label>Observações</label><textarea id="entregaObs"></textarea></div>
            <div class="form-group"><label>Itens</label>${itensHtml}</div>
        `;
        openModal('Nova Entrega', body, `<button class="btn btn-primary" id="saveEntregaBtn">Criar</button>`);
        
        document.getElementById('addItemBtn').onclick = () => {
            const container = document.getElementById('itensContainer');
            const nova = document.createElement('div');
            nova.className = 'item-row';
            nova.innerHTML = `
                <select class="produto-select" style="flex:2">${produtosDisponiveis.map(p => `<option value="${p.id}">${p.nome} (disp: ${p.quantidade})</option>`).join('')}</select>
                <input type="number" placeholder="Quantidade" class="qtd-input" style="flex:1">
                <input type="text" placeholder="Lote (opcional)" class="lote-input" style="flex:1">
            `;
            container.appendChild(nova);
        };

        document.getElementById('saveEntregaBtn').onclick = async () => {
            const itens = [];
            const rows = document.querySelectorAll('#itensContainer .item-row');
            for (let row of rows) {
                const produtoId = row.querySelector('.produto-select').value;
                const qtd = parseFloat(row.querySelector('.qtd-input').value);
                const loteId = row.querySelector('.lote-input').value || null;
                if (produtoId && qtd > 0) {
                    itens.push({ produto_id: produtoId, quantidade: qtd, lote_id: loteId });
                }
            }
            if (itens.length === 0) return showToast('Adicione pelo menos um item', 'error');
            const data = {
                data_prevista: document.getElementById('entregaPrevista').value,
                veiculo: document.getElementById('entregaVeiculo').value,
                motorista: document.getElementById('entregaMotorista').value,
                observacoes: document.getElementById('entregaObs').value,
                itens: itens
            };
            try {
                await apiRequest('/entregas', { method: 'POST', body: JSON.stringify(data) });
                showToast('Entrega criada', 'success');
                closeModal();
                await loadAllData();
                await renderDeliveries();
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
    };

    window.atualizarStatusEntrega = async (id) => {
        const novoStatus = prompt('Novo status (pendente, transporte, entregue, cancelado):');
        if (!novoStatus) return;
        const dataReal = novoStatus === 'entregue' ? new Date().toISOString().split('T')[0] : null;
        try {
            await apiRequest(`/entregas/${id}`, { method: 'PUT', body: JSON.stringify({ status: novoStatus, data_real: dataReal }) });
            showToast('Status atualizado', 'success');
            await loadAllData();
            await renderDeliveries();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // ========== CONFIGURAÇÕES ==========
    async function renderSettings() {
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><h1 class="page-title">⚙️ Configurações</h1></div>
            <div class="card"><div class="card-header"><h3>Backup</h3></div><button class="btn btn-outline" onclick="window.exportCSV()">📥 Exportar CSV</button></div>
            <div class="card"><div class="card-header"><h3>Sobre</h3></div><p>Gestão de Estoque v2.0 - Sem login, com validade controlada + entregas</p></div>
        `;
    }

    // ========== QR CODE ==========
    window.generateQRProduct = async (id) => {
        try {
            const data = await apiRequest(`/produtos/${id}/qrcode`);
            openModal('QR Code do Produto', `
                <div style="text-align:center;">
                    <p><strong>${data.nome}</strong><br>SKU: ${data.sku}</p>
                    <img src="data:image/png;base64,${data.qr_base64}" style="max-width:100%; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                    <p style="margin-top:12px; font-size:0.8rem;">Escaneie para acessar rapidamente</p>
                </div>`, `<button class="btn btn-outline" onclick="closeModal()">Fechar</button>`);
        } catch (err) {
            showToast('Erro ao gerar QR Code: ' + err.message, 'error');
        }
    };

    // ========== OCR COM CÂMERA ==========
    window.captureAndRecognize = async () => {
        const body = `<video id="ocrVideo" autoplay playsinline style="width:100%; max-height:300px; border-radius:20px;"></video><canvas id="ocrCanvas" style="display:none;"></canvas><div id="ocrStatus" style="margin-top:12px;">📷 Aponte para o texto</div><div class="btn-group" style="justify-content:center; margin-top:16px;"><button id="ocrCaptureBtn" class="btn btn-primary">📸 Capturar</button></div><div id="ocrResults"></div>`;
        openModal('🔍 Ler Nome do Produto', body, `<button id="ocrCloseBtn" class="btn btn-outline">Fechar</button>`);
        const video = document.getElementById('ocrVideo');
        const canvas = document.getElementById('ocrCanvas');
        const captureBtn = document.getElementById('ocrCaptureBtn');
        const statusDiv = document.getElementById('ocrStatus');
        const resultsDiv = document.getElementById('ocrResults');
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = stream;
            await video.play();
        } catch (e) { statusDiv.innerHTML = '❌ Erro na câmera'; return; }
        captureBtn.onclick = async () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
            const formData = new FormData();
            formData.append('imagem', blob, 'ocr.jpg');
            statusDiv.innerHTML = '🔄 Reconhecendo...';
            try {
                const res = await fetch(`${API_BASE}/ocr-avancado`, { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.erro);
                statusDiv.innerHTML = `✅ Texto: "${data.texto_extraido.substring(0,60)}"`;
                resultsDiv.innerHTML = data.produtos_encontrados.map(p => `<div style="padding:10px; border-bottom:1px solid #ccc;"><strong>${p.nome}</strong><br><button class="btn-sm btn-primary" onclick="window.editProduct('${p.id}'); closeModal();">Editar</button></div>`).join('');
            } catch (err) { statusDiv.innerHTML = '❌ ' + err.message; }
        };
        document.getElementById('ocrCloseBtn').onclick = () => { if (stream) stream.getTracks().forEach(t => t.stop()); closeModal(); };
    };

    // ========== ETIQUETAS PDF ==========
    window.printLabels = async () => {
        if (!produtosCache.length) return showToast('Nenhum produto', 'error');
        const body = `<div><label>Produtos:</label><div style="max-height:200px;overflow:auto">${produtosCache.map(p => `<div><input type="checkbox" id="prod_${p.id}" checked><label>${p.nome}</label></div>`).join('')}</div></div><div><label>Etiquetas por produto:</label><input type="number" id="labelQty" value="1"></div>`;
        openModal('Etiquetas', body, `<button class="btn btn-primary" id="genPDF">Gerar PDF</button>`);
        document.getElementById('genPDF').onclick = async () => {
            const selected = produtosCache.filter(p => document.getElementById(`prod_${p.id}`)?.checked);
            const qty = parseInt(document.getElementById('labelQty').value) || 1;
            closeModal();
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            let x = 10, y = 10, count = 0;
            for (const prod of selected) {
                for (let i = 0; i < qty; i++) {
                    if (count % 9 === 0 && count !== 0) pdf.addPage();
                    pdf.rect(x, y, 60, 40);
                    pdf.setFontSize(9);
                    pdf.text(prod.nome.substring(0, 20), x + 2, y + 6);
                    pdf.text(`SKU: ${prod.sku}`, x + 2, y + 12);
                    pdf.text(`R$ ${prod.preco_venda.toFixed(2)}`, x + 2, y + 17);
                    const canvas = document.createElement('canvas');
                    await QRCode.toCanvas(canvas, `PROD:${prod.id}`, { width: 60 });
                    pdf.addImage(canvas.toDataURL(), 'PNG', x + 38, y + 2, 20, 20);
                    count++;
                    x += 65;
                    if (count % 3 === 0) { x = 10; y += 45; }
                }
            }
            pdf.save(`etiquetas_${Date.now()}.pdf`);
            showToast('PDF gerado', 'success');
        };
    };

    // ========== EXPORTAR CSV ==========
    window.exportCSV = () => {
        const rows = produtosCache.map(p => `${p.nome},${p.sku},${p.quantidade},${p.preco_custo},${p.preco_venda},${p.controla_validade ? 'Sim' : 'Não'}`);
        const blob = new Blob(["Nome,SKU,Estoque,Custo,Venda,ControlaValidade\n" + rows.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `estoque_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        showToast('CSV exportado', 'success');
    };

    // ========== ANÁLISES ==========
    async function renderAnalytics() {
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><h1 class="page-title">📈 Análises</h1></div>
            <div class="charts-grid"><div class="card"><div class="card-header"><h3>Estoque por Categoria</h3></div><div class="chart-container"><canvas id="categoryChart"></canvas></div></div></div>
            <div class="card"><div class="card-header"><h3>Movimentações (30d)</h3></div><div class="chart-container"><canvas id="movementsChart"></canvas></div></div>
        `;
        const catMap = {};
        produtosCache.forEach(p => {
            const cat = categoriasCache.find(c => c.id === p.categoria_id)?.nome || 'Sem Categoria';
            catMap[cat] = (catMap[cat] || 0) + p.quantidade;
        });
        new Chart(document.getElementById('categoryChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(catMap), datasets: [{ data: Object.values(catMap), backgroundColor: ['#008610', '#10b981', '#f59e0b', '#ef4444'] }] }
        });
        const last30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().split('T')[0]; });
        const movByDay = {};
        last30.forEach(d => movByDay[d] = { in: 0, out: 0 });
        movimentacoesCache.forEach(m => {
            const d = m.data.split('T')[0];
            if (movByDay[d]) movByDay[d][m.tipo] += m.quantidade;
        });
        new Chart(document.getElementById('movementsChart'), {
            type: 'line',
            data: {
                labels: last30.map(d => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
                datasets: [
                    { label: 'Entradas', data: last30.map(d => movByDay[d].in), borderColor: '#10b981', fill: false },
                    { label: 'Saídas', data: last30.map(d => movByDay[d].out), borderColor: '#ef4444', fill: false }
                ]
            }
        });
    }

    // ========== ALERTAS ==========
    async function renderAlerts() {
        const alerts = [];
        produtosCache.forEach(p => { if (p.quantidade <= p.estoque_minimo) alerts.push(`⚠️ ${p.nome} - estoque baixo (${p.quantidade} ${p.unidade})`); });
        lotesCache.forEach(l => {
            if (!l.data_validade) return;
            const diff = (new Date(l.data_validade) - new Date()) / (1000 * 3600 * 24);
            if (diff < 0) alerts.push(`🚫 Lote ${l.codigo} vencido`);
            else if (diff <= 30) alerts.push(`⏰ Lote ${l.codigo} vence em ${Math.floor(diff)} dias`);
        });
        document.getElementById('appContent').innerHTML = `
            <div class="page-header"><h1 class="page-title">🔔 Alertas</h1><p>${alerts.length} alertas</p></div>
            <div class="card">${alerts.length ? alerts.map(a => `<div class="alert-item">${a}</div>`).join('') : '<div class="empty-state">✅ Nenhum alerta</div>'}</div>
        `;
    }

    // ========== MODAL ==========
    function openModal(title, body, footer) {
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalBody').innerHTML = body;
        document.getElementById('modalFooter').innerHTML = footer;
        document.getElementById('modalOverlay').classList.add('active');
    }
    window.closeModal = () => document.getElementById('modalOverlay').classList.remove('active');
    window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('active');
    window.updateSearch = (val) => { searchQuery = val.toLowerCase(); renderCurrentView(); };

    // ========== INICIALIZAÇÃO ==========
    (async () => {
        await loadAllData();
        renderSidebar();
        await renderDashboard();
    })();
})();