// admin-script.js - ELVIS VEÍCULOS (painel administrativo)
// Versão completa e funcional - com multi‑concessionária, FIPE, upload e dashboard aprimorado

// ==================== CONFIGURAÇÃO ====================
const CONFIG = {
    SUPABASE_URL: 'https://mlqgxjujaxfixaxertpn.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scWd4anVqYXhmaXhheGVydHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDg3MzgsImV4cCI6MjA4NzQyNDczOH0.ri69N3__upUzWRHdsGHZ6CuGLy6l8PZnVCypw-WArK8',
    STORAGE_BUCKET: 'vehicles',
    MAX_PHOTOS: 12,
    MAX_PHOTO_SIZE_MB: 10,
    OPTIONALS_LIST: [
        'Ar Cond. Digital', 'Bancos em Couro', 'GPS de Fábrica', 'Som Premium',
        'Teto Solar', 'Faróis de Neblina', 'Alarme', 'Rodas Aro 17',
        'Câmera de Ré', 'Sensor de Ré', 'Partida Elétrica', 'Vidros Elétricos',
        'Banco Elétrico', 'Multimídia', 'Chuva/Luz Auto', 'Freios ABS'
    ]
};

// ==================== SUPABASE CLIENT ====================
const supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
);

// ==================== ESTADO GLOBAL ====================
const AppState = {
    dealershipId: null,
    dealershipName: '',
    userRole: null,
    vehicles: [],
    leads: [],
    leadsChart: null,
    leadsPieChart: null
};

// ==================== UTILITÁRIOS ====================
const Utils = {
    $: (id) => document.getElementById(id),

    showToast(icon, text, sub = '') {
        const toast = Utils.$('toast');
        toast.querySelector('.toast-icon').textContent = icon;
        toast.querySelector('.toast-text').textContent = text;
        toast.querySelector('.toast-sub').textContent = sub;
        toast.classList.add('show');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
    },

    formatPrice(value) {
        if (!value && value !== 0) return '';
        const num = typeof value === 'string' ? parseFloat(value.replace(/\D/g, '')) / 100 : value;
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/\./g, '').replace(',', '.')) || 0;
    },

    escapeHTML(str) {
        return String(str).replace(/[&<>"]/g, function(match) {
            if (match === '&') return '&amp;';
            if (match === '<') return '&lt;';
            if (match === '>') return '&gt;';
            if (match === '"') return '&quot;';
            return match;
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    async uploadPhoto(file, path) {
        const { data, error } = await supabaseClient.storage
            .from(CONFIG.STORAGE_BUCKET)
            .upload(path, file, { cacheControl: '3600', upsert: true });
        if (error) throw error;
        const { data: urlData } = supabaseClient.storage
            .from(CONFIG.STORAGE_BUCKET)
            .getPublicUrl(path);
        return urlData.publicUrl;
    },

    async deletePhoto(path) {
        const { error } = await supabaseClient.storage
            .from(CONFIG.STORAGE_BUCKET)
            .remove([path]);
        if (error) console.error('Erro ao deletar foto:', error);
    }
};

// ==================== AUTENTICAÇÃO (com verificação de dealership) ====================
const Auth = {
    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const user = data.user;

        const { data: userDealership, error: relError } = await supabaseClient
            .from('user_dealerships')
            .select('dealership_id, role, dealerships(nome)')
            .eq('user_id', user.id)
            .single();

        if (relError || !userDealership) {
            await supabaseClient.auth.signOut();
            throw new Error('Usuário não vinculado a nenhuma concessionária.');
        }

        if (userDealership.role !== 'admin') {
            await supabaseClient.auth.signOut();
            throw new Error('Acesso negado. Apenas administradores podem acessar o painel.');
        }

        AppState.dealershipId = userDealership.dealership_id;
        AppState.dealershipName = userDealership.dealerships?.nome || 'Minha Concessionária';
        AppState.userRole = userDealership.role;

        const dealerNameEl = document.querySelector('.admin-name');
        if (dealerNameEl) dealerNameEl.textContent = AppState.dealershipName;

        return data;
    },

    async logout() {
        await supabaseClient.auth.signOut();
        AppState.dealershipId = null;
        AppState.dealershipName = '';
        AppState.userRole = null;
    },

    async getSession() {
        const { data } = await supabaseClient.auth.getSession();
        return data.session;
    },

    // Restaura estado a partir de sessão existente (DRY: elimina duplicação no DOMContentLoaded)
    async restoreSession(session) {
        const user = session.user;
        const { data: userDealership, error } = await supabaseClient
            .from('user_dealerships')
            .select('dealership_id, role, dealerships(nome)')
            .eq('user_id', user.id)
            .single();
        if (error || !userDealership || userDealership.role !== 'admin') {
            throw new Error('Acesso negado');
        }
        AppState.dealershipId = userDealership.dealership_id;
        AppState.dealershipName = userDealership.dealerships?.nome || 'Minha Concessionária';
        AppState.userRole = userDealership.role;
        const dealerNameEl = document.querySelector('.admin-name');
        if (dealerNameEl) dealerNameEl.textContent = AppState.dealershipName;
    }
};

// ==================== MÓDULO DE ARMAZENAMENTO ====================
const Storage = {
    async loadVehicles() {
        if (!AppState.dealershipId) return [];
        const { data, error } = await supabaseClient
            .from('vehicles')
            .select('*')
            .eq('dealership_id', AppState.dealershipId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        AppState.vehicles = data || [];
        return AppState.vehicles;
    },

    async addVehicle(vehicle) {
        if (!AppState.dealershipId) throw new Error('Nenhuma concessionária associada.');
        const vehicleWithDealer = { ...vehicle, dealership_id: AppState.dealershipId };
        const { data, error } = await supabaseClient
            .from('vehicles')
            .insert([vehicleWithDealer])
            .select();
        if (error) throw error;
        if (data && data[0]) {
            AppState.vehicles.unshift(data[0]);
            return data[0];
        }
        return null;
    },

    async updateVehicle(id, updates) {
        const { data, error } = await supabaseClient
            .from('vehicles')
            .update(updates)
            .eq('id', id)
            .eq('dealership_id', AppState.dealershipId)
            .select();
        if (error) throw error;
        if (data && data[0]) {
            const index = AppState.vehicles.findIndex(v => v.id === id);
            if (index !== -1) AppState.vehicles[index] = data[0];
            return data[0];
        }
        return null;
    },

    async deleteVehicle(id) {
        const { error } = await supabaseClient
            .from('vehicles')
            .delete()
            .eq('id', id)
            .eq('dealership_id', AppState.dealershipId);
        if (error) throw error;
        AppState.vehicles = AppState.vehicles.filter(v => v.id !== id);
        return true;
    },

    async toggleStatus(id) {
        const vehicle = AppState.vehicles.find(v => v.id === id);
        if (!vehicle) return null;
        // Corrigido: era 'pause' — deve ser 'pausado' para corresponder ao enum vehicle_status no banco
        const newStatus = vehicle.status === 'ativo' ? 'pausado' : 'ativo';
        return await this.updateVehicle(id, { status: newStatus });
    },

    async setDestaque(id) {
        await supabaseClient
            .from('vehicles')
            .update({ destaque: false })
            .eq('dealership_id', AppState.dealershipId)
            .neq('id', id);
        return await this.updateVehicle(id, { destaque: true });
    }
};

// ==================== MÓDULO DE LEADS ====================
const LeadsManager = {
    async loadLeads(filter = '', status = '', origem = '') {
        if (!AppState.dealershipId) return [];
        let query = supabaseClient
            .from('leads')
            .select('*, vehicles!left(marca, modelo)')
            .eq('dealership_id', AppState.dealershipId)
            .order('created_at', { ascending: false });
        if (status) query = query.eq('status', status);
        if (origem) query = query.eq('origem', origem);
        const { data, error } = await query;
        if (error) { console.error('Erro ao carregar leads:', error); return []; }
        AppState.leads = data || [];
        return AppState.leads;
    },

    getStats() {
        const leads = AppState.leads;
        const total = leads.length;
        const novos = leads.filter(l => l.status === 'novo').length;
        const contato = leads.filter(l => l.status === 'em_contato').length;
        const negociacao = leads.filter(l => l.status === 'negociacao').length;
        const fechados = leads.filter(l => l.status === 'fechado').length;
        const propostas = leads.reduce((acc, l) => acc + (parseFloat(l.valor_proposta) || 0), 0);
        return { total, novos, contato, negociacao, fechados, propostas };
    },

    async updateLeadStatus(id, status, valor) {
        const { error } = await supabaseClient
            .from('leads')
            .update({ status, valor_proposta: valor, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('dealership_id', AppState.dealershipId);
        if (error) throw error;
        const lead = AppState.leads.find(l => l.id === id);
        if (lead) {
            lead.status = status;
            lead.valor_proposta = valor;
        }
    }
};

// ==================== MÓDULO FIPE (cache e API) ====================
const FipeCache = {
    PREFIX: 'fipe_cache_',
    TTL: {
        marcas: 24 * 60 * 60 * 1000,
        modelos: 24 * 60 * 60 * 1000,
        anos: 6 * 60 * 60 * 1000,
    },
    _key(path) {
        return this.PREFIX + path.replace(/\//g, '_');
    },
    get(path) {
        try {
            const raw = localStorage.getItem(this._key(path));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (Date.now() > entry.expires) {
                localStorage.removeItem(this._key(path));
                return null;
            }
            return entry.data;
        } catch {
            return null;
        }
    },
    set(path, data, ttl) {
        try {
            localStorage.setItem(this._key(path), JSON.stringify({
                data,
                expires: Date.now() + ttl,
                cachedAt: new Date().toISOString()
            }));
        } catch (e) {
            console.warn('FipeCache: não foi possível salvar cache', e.message);
        }
    },
    inspect() {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(this.PREFIX)) continue;
            try {
                const entry = JSON.parse(localStorage.getItem(key));
                const expiresIn = Math.round((entry.expires - Date.now()) / 60000);
                entries.push({
                    key: key.replace(this.PREFIX, ''),
                    cachedAt: entry.cachedAt,
                    expiresIn: expiresIn > 0 ? `${expiresIn} min` : 'EXPIRADO',
                    size: `~${(localStorage.getItem(key).length / 1024).toFixed(1)} KB`
                });
            } catch { /* skip */ }
        }
        return entries;
    },
    clear() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) keys.push(key);
        }
        keys.forEach(k => localStorage.removeItem(k));
        return keys.length;
    }
};

const FipeAPI = {
    baseURL: 'https://parallelum.com.br/fipe/api/v1/carros',
    async get(path, ttl = null) {
        if (ttl !== null) {
            const cached = FipeCache.get(path);
            if (cached) return cached;
        }
        const response = await fetch(this.baseURL + path);
        if (!response.ok) throw new Error(`Erro FIPE: ${response.status}`);
        const data = await response.json();
        if (ttl !== null) FipeCache.set(path, data, ttl);
        return data;
    },
    async loadMarcas(selectElement, loadingId) {
        UI.fipeLoading(loadingId, true);
        try {
            const marcas = await this.get('/marcas', FipeCache.TTL.marcas);
            selectElement.innerHTML = '<option value="">Selecione a marca</option>' +
                marcas.map(m => `<option value="${m.codigo}">${m.nome}</option>`).join('');
        } catch (error) {
            // Corrigido: fallback com input de texto livre (sem código FIPE = seleção de modelos não funciona)
            Utils.showToast('⚠️', 'API FIPE indisponível', 'Preencha marca/modelo manualmente');
            selectElement.innerHTML = '<option value="">API FIPE indisponível — preencha manualmente</option>';
        } finally {
            UI.fipeLoading(loadingId, false);
        }
    },
    async loadModelos(codigoMarca, selectModelo, loadingId) {
        if (!codigoMarca) return;
        UI.fipeLoading(loadingId, true);
        try {
            const data = await this.get(`/marcas/${codigoMarca}/modelos`, FipeCache.TTL.modelos);
            selectModelo.innerHTML = '<option value="">Selecione o modelo</option>' +
                data.modelos.map(m => `<option value="${m.codigo}">${m.nome}</option>`).join('');
            selectModelo.disabled = false;
        } catch (error) {
            Utils.showToast('⚠️', 'Erro ao carregar modelos');
            selectModelo.innerHTML = '<option value="">Erro ao carregar</option>';
        } finally {
            UI.fipeLoading(loadingId, false);
        }
    },
    async loadAnos(codigoMarca, codigoModelo, selectAno, loadingId) {
        if (!codigoMarca || !codigoModelo) return;
        UI.fipeLoading(loadingId, true);
        try {
            const anos = await this.get(`/marcas/${codigoMarca}/modelos/${codigoModelo}/anos`, FipeCache.TTL.anos);
            selectAno.innerHTML = '<option value="">Selecione o ano</option>' +
                anos.map(a => `<option value="${a.codigo}">${a.nome}</option>`).join('');
            selectAno.disabled = false;
            return anos;
        } catch (error) {
            Utils.showToast('⚠️', 'Erro ao carregar anos');
            selectAno.innerHTML = '<option value="">Erro</option>';
        } finally {
            UI.fipeLoading(loadingId, false);
        }
    },
    async getPreco(codigoMarca, codigoModelo, codigoAno) {
        if (!codigoMarca || !codigoModelo || !codigoAno) return null;
        try {
            return await this.get(`/marcas/${codigoMarca}/modelos/${codigoModelo}/anos/${codigoAno}`);
        } catch {
            return null;
        }
    }
};

// ==================== INTERFACE DO USUÁRIO ====================
const UI = {
    currentPage: 'dashboard',
    editingId: null,
    uploadedPhotos: [],
    existingPhotos: [],
    photosToRemove: [],

    async init() {
        this.updateTopbarDate();
        this.buildOptionalsCheck();
        await this.loadAndRenderDashboard();
        await this.loadAndRenderEstoque();
        await this.loadLeadsAndRender();
        this.setupLeadsListeners();
        // Carregar marcas FIPE no formulário de cadastro
        FipeAPI.loadMarcas(Utils.$('f-marca'), 'fipe-loading-marca');
    },

    // ---------- TOPBAR ----------
    updateTopbarDate() {
        const now = new Date();
        Utils.$('topbar-date').textContent = now.toLocaleDateString('pt-BR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    },

    // ---------- NAVEGAÇÃO ----------
    showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const pageEl = Utils.$('page-' + page);
        if (pageEl) pageEl.classList.add('active');
        const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navEl) navEl.classList.add('active');
        this.currentPage = page;

        const titles = {
            dashboard: ['Dashboard', 'Visão geral do estoque e leads'],
            cadastro:  ['Cadastrar Veículo', 'Preencha os dados do novo veículo'],
            estoque:   ['Estoque', 'Gerencie todos os veículos cadastrados'],
            leads:     ['Leads', 'Gerencie os contatos recebidos']
        };
        if (titles[page]) {
            Utils.$('page-title').textContent = titles[page][0];
            Utils.$('page-sub').textContent = titles[page][1];
        }
        if (page === 'estoque') this.renderEstoque();
        if (page === 'leads') this.loadLeadsAndRender();
        if (page === 'dashboard') this.loadAndRenderDashboard();
    },

    // ---------- DASHBOARD ----------
    async loadAndRenderDashboard() {
        await Storage.loadVehicles();
        await LeadsManager.loadLeads(); // carrega apenas, sem renderizar a página de leads

        const vehicles = AppState.vehicles;
        const total = vehicles.length;
        const ativos = vehicles.filter(v => v.status === 'ativo').length;
        const valorTotal = vehicles.reduce((acc, v) => acc + (v.preco || 0), 0);
        const media = total ? valorTotal / total : 0;

        Utils.$('stat-total').textContent = total;
        Utils.$('stat-ativos').textContent = ativos;
        Utils.$('stat-valor').textContent = `R$ ${Math.round(valorTotal / 1000)}k`;
        Utils.$('stat-media').textContent = `Média R$ ${Math.round(media / 1000)}k`;

        // Leads stats
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const leadsRecentes = AppState.leads.filter(l => new Date(l.created_at) >= sevenDaysAgo);
        Utils.$('stat-leads-semana').textContent = leadsRecentes.length;
        Utils.$('stat-leads-total').textContent = AppState.leads.length;

        const dashboardList = Utils.$('dashboard-list');
        dashboardList.innerHTML = vehicles.slice(0, 4).map(v => `
            <div class="stock-row">
                <div class="s-car-icon">🚗</div>
                <div class="s-car-info">
                    <div class="s-car-name">${Utils.escapeHTML(v.marca)} ${Utils.escapeHTML(v.modelo)}</div>
                    <div class="s-car-sub">${v.versao || ''} · ${v.ano_fabricacao || '—'}/${v.ano_modelo || '—'} · ${v.km ? v.km.toLocaleString('pt-BR') : '—'} km</div>
                </div>
                <div class="s-car-price">R$ ${Utils.formatPrice(v.preco)}</div>
                <div class="status-badge ${this.statusClass(v.status)}">${this.statusLabel(v.status)}</div>
            </div>
        `).join('');

        this.renderLeadsChart();
        this.renderLeadsPieChart();

        const recentLeads = AppState.leads.slice(0, 3);
        const alertsContainer = document.querySelector('.alert-list');
        if (alertsContainer) {
            alertsContainer.innerHTML = recentLeads.map(lead => `
                <div class="alert-item">
                    <div class="alert-dot dot-green"></div>
                    <div class="alert-text">
                        <strong>${Utils.escapeHTML(lead.nome)}</strong>
                        ${lead.vehicles ? `Interessado em ${lead.vehicles.marca} ${lead.vehicles.modelo}` : 'Interesse geral'}
                        <div class="alert-time">${new Date(lead.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            `).join('');
        }
    },

    renderLeadsChart() {
        const leads = AppState.leads;

        const days = [];
        const counts = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date();
            day.setDate(day.getDate() - i);
            // Corrigido: compara por data local (yyyy-mm-dd) evitando problema de fuso horário UTC
            const dayLabel = day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
            const dayStr = day.toLocaleDateString('en-CA'); // formato YYYY-MM-DD no locale local
            days.push(dayLabel);
            const count = leads.filter(l => {
                const lDate = new Date(l.created_at).toLocaleDateString('en-CA');
                return lDate === dayStr;
            }).length;
            counts.push(count);
        }

        const ctx = document.getElementById('leadsChart')?.getContext('2d');
        if (!ctx) return;
        if (AppState.leadsChart) AppState.leadsChart.destroy();
        AppState.leadsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Leads',
                    data: counts,
                    borderColor: '#C9A84C',
                    backgroundColor: 'rgba(201,168,76,0.08)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#B0B0B8', font: { size: 11 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#B0B0B8', font: { size: 11 } }, beginAtZero: true }
                }
            }
        });
    },

    renderLeadsPieChart() {
        const stats = LeadsManager.getStats();
        const ctx = document.getElementById('leadsPieChart')?.getContext('2d');
        if (!ctx) return;
        if (AppState.leadsPieChart) AppState.leadsPieChart.destroy();
        AppState.leadsPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Novos', 'Em Contato', 'Negociação', 'Fechados', 'Perdidos'],
                datasets: [{
                    data: [stats.novos, stats.contato, stats.negociacao, stats.fechados,
                           AppState.leads.filter(l => l.status === 'perdido').length],
                    backgroundColor: ['#4A8FE7', '#C9A84C', '#FFAA44', '#25D366', '#E05555'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#B0B0B8', font: { size: 11 } } } }
            }
        });
    },

    // ---------- LEADS ----------
    async loadLeadsAndRender(filter = '', status = '', origem = '') {
        await LeadsManager.loadLeads(filter, status, origem);
        this.renderLeadsKPI();
        this.renderLeads(filter);
    },

    renderLeadsKPI() {
        const stats = LeadsManager.getStats();
        Utils.$('lkpi-total').querySelector('.lkpi-val').textContent = stats.total;
        Utils.$('lkpi-novo').querySelector('.lkpi-val').textContent = stats.novos;
        Utils.$('lkpi-contato').querySelector('.lkpi-val').textContent = stats.contato;
        Utils.$('lkpi-negociacao').querySelector('.lkpi-val').textContent = stats.negociacao;
        Utils.$('lkpi-fechado').querySelector('.lkpi-val').textContent = stats.fechados;
        const valorEl = Utils.$('lkpi-valor').querySelector('.lkpi-val');
        valorEl.textContent = stats.propostas > 0 ? `R$ ${Math.round(stats.propostas / 1000)}k` : 'R$ 0';
    },

    renderLeads(filter = '') {
        const filtered = AppState.leads.filter(lead =>
            (lead.nome || '').toLowerCase().includes(filter.toLowerCase()) ||
            (lead.telefone || '').includes(filter) ||
            (lead.cidade || '').toLowerCase().includes(filter.toLowerCase()) ||
            (lead.vehicles && (lead.vehicles.marca + ' ' + lead.vehicles.modelo).toLowerCase().includes(filter.toLowerCase()))
        );

        const container = Utils.$('leads-list');
        if (!filtered.length) {
            container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--gray)">Nenhum lead encontrado.</p>';
            return;
        }

        const header = `<div class="leads-list-header">
            <span>Lead</span><span>Veículo / Origem</span><span>Valor Proposta</span><span>Status</span><span>Ações</span>
        </div>`;

        const rows = filtered.map(lead => {
            const statusKey = (lead.status || 'novo').replace(/_/g, '-');
            const valorStr = lead.valor_proposta
                ? `R$ ${Utils.formatPrice(lead.valor_proposta)}`
                : '<span style="color:var(--gray);font-size:11px">—</span>';
            const origemBadge = lead.origem
                ? `<div class="lead-origem-badge">${lead.origem}</div>` : '';
            return `
            <div class="lead-row" data-id="${lead.id}">
                <div class="lead-info">
                    <div class="lead-name">${Utils.escapeHTML(lead.nome || '—')}</div>
                    <div class="lead-contact">${lead.telefone || ''} ${lead.email ? '· ' + lead.email : ''}</div>
                    ${lead.cidade ? `<div class="lead-contact">📍 ${lead.cidade}</div>` : ''}
                </div>
                <div class="lead-vehicle">
                    ${lead.vehicles ? Utils.escapeHTML(lead.vehicles.marca + ' ' + lead.vehicles.modelo) : 'Interesse geral'}
                    ${origemBadge}
                </div>
                <div class="lead-valor ${lead.valor_proposta ? '' : 'empty'}">${valorStr}</div>
                <div class="lead-status-badge status-${statusKey}">${this.statusLeadLabel(lead.status)}</div>
                <div class="lead-actions">
                    <button class="view-lead" data-id="${lead.id}" title="Ver / Editar detalhes">👁️</button>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = header + rows;
    },

    statusLeadLabel(status) {
        const map = {
            'novo': '🆕 Novo',
            'em_contato': '📞 Em Contato',
            'proposta_enviada': '💰 Proposta',
            'negociacao': '🤝 Negociação',
            'fechado': '✅ Fechado',
            'perdido': '❌ Perdido'
        };
        return map[status] || (status || '—');
    },

    openLeadModal(lead) {
        const fmt = (d) => d ? new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
        Utils.$('lm-name').textContent = lead.nome || '—';
        Utils.$('lm-vehicle').textContent = lead.vehicles
            ? `Interessado em: ${lead.vehicles.marca} ${lead.vehicles.modelo}` : 'Interesse geral';
        const telEl = Utils.$('lm-tel');
        telEl.textContent = lead.telefone || '—';
        telEl.href = `https://wa.me/55${(lead.telefone || '').replace(/\D/g,'')}`;
        Utils.$('lm-email').textContent = lead.email || '—';
        Utils.$('lm-cidade').textContent = lead.cidade || '—';
        const origEl = Utils.$('lm-origem');
        origEl.textContent = lead.origem || '—';
        origEl.className = 'lm-badge';
        Utils.$('lm-status-sel').value = lead.status || 'novo';
        Utils.$('lm-valor').value = lead.valor_proposta ? Utils.formatPrice(lead.valor_proposta) : '';
        Utils.$('lm-responsavel').textContent = lead.responsavel || '—';
        Utils.$('lm-created').textContent = fmt(lead.created_at);
        Utils.$('lm-updated').textContent = fmt(lead.updated_at);
        Utils.$('lm-msg').textContent = lead.mensagem || 'Sem mensagem.';
        Utils.$('lm-whatsapp').href = `https://wa.me/55${(lead.telefone || '').replace(/\D/g,'')}`;
        Utils.$('lm-save').dataset.leadId = lead.id;
        Utils.$('lead-modal-overlay').classList.add('open');
    },

    closeLeadModal() {
        Utils.$('lead-modal-overlay').classList.remove('open');
    },

    setupLeadsListeners() {
    const searchInput = Utils.$('search-leads');
    const statusFilter = Utils.$('filter-lead-status');
    const origemFilter = Utils.$('filter-lead-origem');

    const refresh = () => {
        const f = searchInput?.value || '';
        const s = statusFilter?.value || '';
        const o = origemFilter?.value || '';
        this.loadLeadsAndRender(f, s, o);
    };

    if (searchInput) searchInput.addEventListener('input', Utils.debounce(refresh, 300));
    if (statusFilter) statusFilter.addEventListener('change', refresh);
    if (origemFilter) origemFilter.addEventListener('change', refresh);

    const leadsList = Utils.$('leads-list');
    if (leadsList) {
        leadsList.addEventListener('click', async (e) => {
            const viewBtn = e.target.closest('.view-lead');
            if (viewBtn) {
                const id = viewBtn.dataset.id;
                const lead = AppState.leads.find(l => l.id === id);
                if (lead) this.openLeadModal(lead);
            }
        });
    }

    const closeBtn = Utils.$('lead-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeLeadModal());

    const overlay = Utils.$('lead-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeLeadModal();
        });
    }

    const saveBtn = Utils.$('lm-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const id = saveBtn.dataset.leadId;
            const newStatus = Utils.$('lm-status-sel').value;
            const valorStr = Utils.$('lm-valor').value;
            const valorNum = valorStr ? Utils.parsePrice(valorStr) : null;
            try {
                await LeadsManager.updateLeadStatus(id, newStatus, valorNum);
                this.renderLeadsKPI();
                this.renderLeads(searchInput?.value || '');
                this.closeLeadModal();
                Utils.showToast('✅', 'Lead atualizado!', `Status: ${newStatus}`);
            } catch(err) {
                Utils.showToast('❌', 'Erro ao salvar', err.message);
            }
        });
    }

    const valorInput = Utils.$('lm-valor');
    if (valorInput) {
        valorInput.addEventListener('input', e => {
            e.target.value = Utils.formatPrice(e.target.value);
        });
    }
},

    // ---------- ESTOQUE ----------
    async loadAndRenderEstoque(filter = '') {
        await Storage.loadVehicles();
        this.renderEstoque(filter);
    },

    renderEstoque(filter = '') {
        const vehicles = AppState.vehicles.filter(v =>
            (v.marca + ' ' + v.modelo + ' ' + (v.versao || '')).toLowerCase().includes(filter.toLowerCase())
        );

        if (!vehicles.length) {
            Utils.$('estoque-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray)">Nenhum veículo encontrado</div>';
            return;
        }

        Utils.$('estoque-list').innerHTML = vehicles.map(v => `
            <div class="stock-row" data-id="${v.id}">
                <div class="s-car-icon">🚗</div>
                <div class="s-car-info" style="flex:2">
                    <div class="s-car-name">${Utils.escapeHTML(v.marca)} ${Utils.escapeHTML(v.modelo)} ${v.versao ? '— ' + Utils.escapeHTML(v.versao) : ''}</div>
                    <div class="s-car-sub">${v.ano_fabricacao || '—'}/${v.ano_modelo || '—'} · ${v.km ? v.km.toLocaleString('pt-BR') : '—'} km · ${v.cambio || '—'} · ${v.cor || '—'}</div>
                </div>
                <div style="font-size:11px;color:var(--gray);flex:1;min-width:100px">
                    ${(v.optionals || []).slice(0, 2).join(', ') || '—'}
                </div>
                <div class="s-car-price">R$ ${Utils.formatPrice(v.preco)}</div>
                <div class="status-badge ${this.statusClass(v.status)}">${this.statusLabel(v.status)}</div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                    <button class="action-btn action-toggle" data-toggle="${v.id}">${v.status === 'ativo' ? 'Pausar' : 'Ativar'}</button>
                    <button class="action-btn action-edit" data-edit="${v.id}" title="Editar">✏️</button>
                    <button class="action-btn action-del" data-del="${v.id}" title="Excluir">🗑</button>
                </div>
            </div>
        `).join('');
    },

    statusClass(s) {
        if (s === 'ativo') return 's-active';
        if (s === 'vendido') return 's-sold';
        return 's-pause'; // 'pausado' ou qualquer outro
    },
    statusLabel(s) {
        if (s === 'ativo') return '✅ Ativo';
        if (s === 'vendido') return '🏷️ Vendido';
        return '⏸ Pausado'; // 'pausado' ou qualquer outro
    },

    // ---------- FORMULÁRIO E FOTOS ----------
    buildOptionalsCheck() {
        const container = Utils.$('optionals-container');
        container.innerHTML = CONFIG.OPTIONALS_LIST.map(o => `
            <div class="opt-check" data-opt="${o}">
                <div class="check-box"></div>
                <span>${o}</span>
            </div>
        `).join('');
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.opt-check');
            if (!item) return;
            item.classList.toggle('checked');
            item.querySelector('.check-box').textContent = item.classList.contains('checked') ? '✓' : '';
        });
    },

    getCheckedOptionals() {
        return Array.from(document.querySelectorAll('.opt-check.checked'))
            .map(el => el.querySelector('span').textContent);
    },

    async handleFiles(files) {
        for (const file of Array.from(files)) {
            if (this.uploadedPhotos.length + this.existingPhotos.length >= CONFIG.MAX_PHOTOS) {
                Utils.showToast('⚠️', `Limite de ${CONFIG.MAX_PHOTOS} fotos atingido`);
                break;
            }
            if (file.size > CONFIG.MAX_PHOTO_SIZE_MB * 1024 * 1024) {
                Utils.showToast('⚠️', 'Arquivo muito grande', `Máximo ${CONFIG.MAX_PHOTO_SIZE_MB}MB`);
                continue;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.uploadedPhotos.push({
                    file: file,
                    preview: e.target.result,
                    name: `${Date.now()}_${file.name}`
                });
                this.renderPhotos();
            };
            reader.readAsDataURL(file);
        }
    },

    renderPhotos() {
        const preview = Utils.$('photos-preview');
        const allPhotos = [
            ...this.existingPhotos.map((url, i) => ({ url, isExisting: true, originalIndex: i })),
            ...this.uploadedPhotos.map((p, i) => ({ preview: p.preview, isExisting: false, originalIndex: i }))
        ];
        preview.innerHTML = allPhotos.map((photo, idx) => `
            <div class="photo-thumb" data-index="${idx}" data-original-index="${photo.originalIndex}" data-is-existing="${photo.isExisting}">
                <img src="${photo.url || photo.preview}" alt="Foto" loading="lazy">
                ${idx === 0 ? '<div class="photo-main-badge">PRINCIPAL</div>' : ''}
                <button class="remove-photo" title="Remover foto">✕</button>
            </div>
        `).join('');

        const cnt = allPhotos.length;
        Utils.$('photo-count').innerHTML = cnt > 0
            ? `<span>${cnt}</span> foto${cnt > 1 ? 's' : ''} selecionada${cnt > 1 ? 's' : ''} — máximo ${CONFIG.MAX_PHOTOS}`
            : '';

        if (!this.sortable) {
            this.sortable = new Sortable(preview, {
                animation: 150,
                handle: '.photo-thumb',
                onEnd: () => this.reorderPhotos()
            });
        }
    },

    reorderPhotos() {
        const preview = Utils.$('photos-preview');
        const thumbElements = Array.from(preview.children);

        const newAllPhotos = thumbElements.map(thumb => {
            const index = parseInt(thumb.dataset.index);
            const isExisting = thumb.dataset.isExisting === 'true';
            const originalIndex = parseInt(thumb.dataset.originalIndex);
            if (isExisting) {
                return { type: 'existing', data: this.existingPhotos[originalIndex], originalIndex };
            } else {
                return { type: 'uploaded', data: this.uploadedPhotos[originalIndex], originalIndex };
            }
        });

        this.existingPhotos = newAllPhotos.filter(p => p.type === 'existing').map(p => p.data);
        this.uploadedPhotos = newAllPhotos.filter(p => p.type === 'uploaded').map(p => p.data);

        thumbElements.forEach((thumb, idx) => {
            thumb.dataset.index = idx;
            const mainBadge = thumb.querySelector('.photo-main-badge');
            if (idx === 0) {
                if (!mainBadge) thumb.insertAdjacentHTML('beforeend', '<div class="photo-main-badge">PRINCIPAL</div>');
            } else {
                if (mainBadge) mainBadge.remove();
            }
        });
    },

    removePhoto(index) {
        const thumbElements = Utils.$('photos-preview').children;
        const thumb = thumbElements[index];
        const isExisting = thumb.dataset.isExisting === 'true';
        const originalIndex = parseInt(thumb.dataset.originalIndex);

        if (isExisting) {
            this.photosToRemove.push(this.existingPhotos[originalIndex]);
            this.existingPhotos.splice(originalIndex, 1);
        } else {
            this.uploadedPhotos.splice(originalIndex, 1);
        }
        this.renderPhotos();
    },

    resetForm() {
        ['f-ano-fabricacao', 'f-ano-modelo', 'f-preco', 'f-km', 'f-fipe', 'f-cor', 'f-motor', 'f-desc'].forEach(id => {
            const el = Utils.$(id);
            if (el) el.value = '';
        });
        Utils.$('f-marca').selectedIndex = 0;
        Utils.$('f-modelo').innerHTML = '<option value="">Selecione a marca primeiro</option>';
        Utils.$('f-modelo').disabled = true;
        Utils.$('f-versao').innerHTML = '<option value="">Selecione o modelo primeiro</option>';
        Utils.$('f-versao').disabled = true;
        Utils.$('f-ano-fipe').innerHTML = '<option value="">Selecione o modelo primeiro</option>';
        Utils.$('f-ano-fipe').disabled = true;
        Utils.$('f-cambio').value = 'Automático';
        Utils.$('f-comb').value = 'Flex';
        Utils.$('f-portas').value = '4';
        Utils.$('f-final-placa').value = '1';
        Utils.$('f-status').value = 'ativo';
        Utils.$('f-destaque').value = 'false';
        document.querySelectorAll('.opt-check').forEach(el => {
            el.classList.remove('checked');
            el.querySelector('.check-box').textContent = '';
        });
        this.uploadedPhotos = [];
        this.existingPhotos = [];
        this.photosToRemove = [];
        this.renderPhotos();
        Utils.$('file-input').value = '';
        this.editingId = null;
        delete Utils.$('btn-salvar').dataset.editingId;
        this.hideFipeResult();
    },

    fillForm(vehicle) {
        this.editingId = vehicle.id;
        Utils.$('f-marca').value = vehicle.marca;
        Utils.$('f-modelo').value = vehicle.modelo;
        Utils.$('f-versao').value = vehicle.versao || '';
        Utils.$('f-ano-fabricacao').value = vehicle.ano_fabricacao || '';
        Utils.$('f-ano-modelo').value = vehicle.ano_modelo || '';
        Utils.$('f-preco').value = Utils.formatPrice(vehicle.preco);
        Utils.$('f-km').value = vehicle.km || '';
        Utils.$('f-cor').value = vehicle.cor || '';
        Utils.$('f-cambio').value = vehicle.cambio || '';
        Utils.$('f-comb').value = vehicle.combustivel || '';
        Utils.$('f-final-placa').value = vehicle.final_placa || '1';
        Utils.$('f-portas').value = vehicle.portas || '4';
        Utils.$('f-motor').value = vehicle.motor || '';
        Utils.$('f-fipe').value = Utils.formatPrice(vehicle.fipe);
        Utils.$('f-status').value = vehicle.status;
        Utils.$('f-destaque').value = vehicle.destaque ? 'true' : 'false';
        Utils.$('f-desc').value = vehicle.descricao || '';

        document.querySelectorAll('.opt-check').forEach(el => {
            const optText = el.querySelector('span').textContent;
            if (vehicle.optionals && vehicle.optionals.includes(optText)) {
                el.classList.add('checked');
                el.querySelector('.check-box').textContent = '✓';
            } else {
                el.classList.remove('checked');
                el.querySelector('.check-box').textContent = '';
            }
        });

        this.existingPhotos = vehicle.photos || [];
        this.uploadedPhotos = [];
        this.photosToRemove = [];
        this.renderPhotos();
    },

    fipeLoading(elementId, show) {
        const el = Utils.$(elementId);
        if (el) el.style.display = show ? 'inline' : 'none';
    },

    showFipeResult(dados) {
        const box = Utils.$('fipe-result-box');
        const info = Utils.$('fipe-result-info');
        if (!box || !info) return;
        info.innerHTML = `
            <div class="fipe-row"><span>Referência</span><strong>${dados.MesReferencia || '—'}</strong></div>
            <div class="fipe-row"><span>Marca</span><strong>${dados.Marca || '—'}</strong></div>
            <div class="fipe-row"><span>Modelo</span><strong>${dados.Modelo || '—'}</strong></div>
            <div class="fipe-row"><span>Ano Modelo</span><strong>${dados.AnoModelo || '—'}</strong></div>
            <div class="fipe-row"><span>Combustível</span><strong>${dados.Combustivel || '—'}</strong></div>
            <div class="fipe-row fipe-row-price"><span>Valor FIPE</span><strong>${dados.Valor || '—'}</strong></div>
            <div class="fipe-row"><span>Código FIPE</span><strong>${dados.CodigoFipe || '—'}</strong></div>
        `;
        box.style.display = 'block';
    },

    hideFipeResult() {
        const box = Utils.$('fipe-result-box');
        if (box) box.style.display = 'none';
    },

    async saveVehicle() {
        const marca = Utils.$('f-marca').value;
        const modelo = Utils.$('f-modelo').value;
        const precoStr = Utils.$('f-preco').value;
        if (!marca || !modelo || !precoStr) {
            Utils.showToast('⚠️', 'Campos obrigatórios', 'Preencha Marca, Modelo e Preço');
            return;
        }

        const btnSalvar = Utils.$('btn-salvar');
        if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }

        const anoFab = Utils.$('f-ano-fabricacao').value;
        const anoMod = Utils.$('f-ano-modelo').value;
        if (anoFab && (anoFab < 1900 || anoFab > 2100)) {
            Utils.showToast('⚠️', 'Ano de fabricação inválido');
            return;
        }
        const km = Utils.$('f-km').value;
        if (km && (isNaN(km) || km < 0)) {
            Utils.showToast('⚠️', 'Quilometragem inválida');
            return;
        }

        const uploadedUrls = [];
        for (const photo of this.uploadedPhotos) {
            try {
                const path = `vehicles/${Date.now()}_${photo.file.name}`;
                const url = await Utils.uploadPhoto(photo.file, path);
                uploadedUrls.push(url);
            } catch (error) {
                Utils.showToast('❌', 'Erro no upload da foto', error.message);
                return;
            }
        }

        const finalPhotos = [...this.existingPhotos, ...uploadedUrls];

        if (this.photosToRemove.length) {
            for (const url of this.photosToRemove) {
                const path = url.split('/').slice(-2).join('/');
                await Utils.deletePhoto(path).catch(console.warn);
            }
        }

        const vehicleData = {
            marca,
            modelo,
            versao: Utils.$('f-versao').value || null,
            ano_fabricacao: anoFab ? parseInt(anoFab) : null,
            ano_modelo: anoMod ? parseInt(anoMod) : null,
            preco: Utils.parsePrice(precoStr),
            km: km ? parseInt(km) : null,
            cor: Utils.$('f-cor').value || null,
            cambio: Utils.$('f-cambio').value,
            combustivel: Utils.$('f-comb').value,
            final_placa: Utils.$('f-final-placa').value,
            portas: Utils.$('f-portas').value ? parseInt(Utils.$('f-portas').value) : null,
            motor: Utils.$('f-motor').value || null,
            fipe: Utils.parsePrice(Utils.$('f-fipe').value) || null,
            status: Utils.$('f-status').value,
            destaque: Utils.$('f-destaque').value === 'true',
            descricao: Utils.$('f-desc').value || null,
            optionals: this.getCheckedOptionals(),
            photos: finalPhotos
        };

        try {
            if (this.editingId) {
                // Corrigido: sempre salva todos os dados; setDestaque só gerencia o flag de destaque separadamente
                await Storage.updateVehicle(this.editingId, vehicleData);
                if (vehicleData.destaque) {
                    await Storage.setDestaque(this.editingId);
                }
                Utils.showToast('✅', 'Veículo atualizado!');
            } else {
                if (vehicleData.destaque) {
                    // Corrigido: filtra por dealership_id para não afetar outras concessionárias
                    await supabaseClient.from('vehicles')
                        .update({ destaque: false })
                        .eq('dealership_id', AppState.dealershipId);
                }
                await Storage.addVehicle(vehicleData);
                Utils.showToast('✅', 'Veículo salvo!');
            }
            this.resetForm();
            await this.loadAndRenderDashboard();
            await this.loadAndRenderEstoque();
            this.showPage('estoque');
        } catch (error) {
            Utils.showToast('❌', 'Erro ao salvar', error.message);
        } finally {
            // Reabilita o botão independente de sucesso ou erro
            if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Salvar Veículo'; }
        }
    }
};

// ==================== FUNÇÕES GLOBAIS (cache badge) ====================
function updateCacheBadge() {
    const badge = document.getElementById('cache-badge');
    if (!badge) return;
    const entries = FipeCache.inspect();
    if (entries.length === 0) {
        badge.textContent = 'vazio';
        badge.classList.add('empty');
    } else {
        const totalKB = entries.reduce((acc, e) => acc + parseFloat(e.size), 0);
        badge.textContent = `${entries.length} • ${totalKB.toFixed(0)} KB`;
        badge.classList.remove('empty');
    }
}

// ==================== INICIALIZAÇÃO E EVENT LISTENERS ====================
// ==================== INICIALIZAÇÃO E EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async () => {
    const session = await Auth.getSession();
    if (session) {
        try {
            await Auth.restoreSession(session);
            Utils.$('login-screen').style.display = 'none';
            Utils.$('admin-screen').style.display = 'block';
            UI.init();
            updateCacheBadge();
        } catch (e) {
            await Auth.logout();
            Utils.$('login-screen').style.display = 'flex';
            Utils.$('admin-screen').style.display = 'none';
        }
    } else {
        Utils.$('login-screen').style.display = 'flex';
        Utils.$('admin-screen').style.display = 'none';
    }

    // ---------- LOGIN ----------
    const btnLogin = Utils.$('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            const email = Utils.$('login-user').value;
            const password = Utils.$('login-pass').value;
            if (!email || !password) {
                const err = Utils.$('login-error');
                err.textContent = '⚠️ Preencha e-mail e senha.';
                err.style.display = 'block';
                setTimeout(() => err.style.display = 'none', 3000);
                return;
            }

            btnLogin.disabled = true;
            btnLogin.textContent = 'Entrando...';

            try {
                await Auth.login(email, password);
                Utils.$('login-screen').style.display = 'none';
                Utils.$('admin-screen').style.display = 'block';
                UI.init();
                updateCacheBadge();
            } catch (error) {
                const err = Utils.$('login-error');
                if (error.message?.includes('Acesso negado')) {
                    err.textContent = '🚫 Acesso negado. Usuário sem permissão de admin.';
                } else if (error.message?.includes('Invalid login')) {
                    err.textContent = '❌ E-mail ou senha incorretos.';
                } else {
                    err.textContent = `❌ ${error.message || 'Erro ao fazer login.'}`;
                }
                err.style.display = 'block';
                setTimeout(() => err.style.display = 'none', 4000);
            } finally {
                btnLogin.disabled = false;
                btnLogin.textContent = 'Entrar no Painel';
            }
        });
    }

    // ---------- LOGOUT ----------
    const btnLogout = Utils.$('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await Auth.logout();
            Utils.$('admin-screen').style.display = 'none';
            Utils.$('login-screen').style.display = 'flex';
            Utils.$('login-user').value = '';
            Utils.$('login-pass').value = '';
        });
    }

    // ---------- NAVEGAÇÃO ----------
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page) UI.showPage(page);
            else if (item.dataset.action === 'soon') Utils.showToast('🚧', 'Em breve');
            else if (item.dataset.action === 'site') window.open('index.html', '_blank');
            else if (item.dataset.action === 'clear-fipe-cache') {
                const count = FipeCache.clear();
                updateCacheBadge();
                if (count > 0) {
                    Utils.showToast('🗄️', `Cache FIPE limpo`, `${count} entrada${count > 1 ? 's' : ''} removida${count > 1 ? 's' : ''}`);
                } else {
                    Utils.showToast('ℹ️', 'Cache já estava vazio');
                }
            }
        });
    });

    // ---------- BOTÃO NOVO VEÍCULO ----------
    const btnNew = Utils.$('btn-new-veiculo');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            UI.resetForm();
            UI.showPage('cadastro');
        });
    }

    // ---------- UPLOAD DE FOTOS ----------
    const btnUpload = Utils.$('btn-upload');
    if (btnUpload) {
        btnUpload.addEventListener('click', () => Utils.$('file-input').click());
    }
    const fileInput = Utils.$('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', e => UI.handleFiles(e.target.files));
    }
    const zone = Utils.$('upload-zone');
    if (zone) {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            UI.handleFiles(e.dataTransfer.files);
        });
    }

    const photosPreview = Utils.$('photos-preview');
    if (photosPreview) {
        photosPreview.addEventListener('click', e => {
            const btn = e.target.closest('.remove-photo');
            if (!btn) return;
            const thumb = btn.closest('.photo-thumb');
            if (thumb) {
                const index = parseInt(thumb.dataset.index);
                UI.removePhoto(index);
            }
        });
    }

    // ---------- MÁSCARAS DE PREÇO ----------
    const fPreco = Utils.$('f-preco');
    if (fPreco) {
        fPreco.addEventListener('input', e => e.target.value = Utils.formatPrice(e.target.value));
    }
    const fFipe = Utils.$('f-fipe');
    if (fFipe) {
        fFipe.addEventListener('input', e => e.target.value = Utils.formatPrice(e.target.value));
    }

    // ---------- SALVAR VEÍCULO ----------
    const btnSalvar = Utils.$('btn-salvar');
    if (btnSalvar) {
        btnSalvar.addEventListener('click', () => UI.saveVehicle());
    }
    const btnLimpar = Utils.$('btn-limpar');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => UI.resetForm());
    }

    // ---------- BUSCA NO ESTOQUE ----------
    const searchEstoque = Utils.$('search-estoque');
    if (searchEstoque) {
        searchEstoque.addEventListener('input', Utils.debounce(e => UI.renderEstoque(e.target.value), 300));
    }

    // ---------- FIPE ----------
    const fMarca = Utils.$('f-marca');
    if (fMarca) {
        fMarca.addEventListener('change', async (e) => {
            const codigoMarca = e.target.value;
            await FipeAPI.loadModelos(codigoMarca, Utils.$('f-modelo'), 'fipe-loading-modelo');
            updateCacheBadge();
        });
    }
    const fModelo = Utils.$('f-modelo');
    if (fModelo) {
        fModelo.addEventListener('change', async (e) => {
            const codigoModelo = e.target.value;
            const codigoMarca = Utils.$('f-marca').value;
            await FipeAPI.loadAnos(codigoMarca, codigoModelo, Utils.$('f-ano-fipe'), 'fipe-loading-ano');
            updateCacheBadge();
        });
    }
    const fAnoFipe = Utils.$('f-ano-fipe');
    if (fAnoFipe) {
        fAnoFipe.addEventListener('change', async (e) => {
            const codigoAno = e.target.value;
            const codigoMarca = Utils.$('f-marca').value;
            const codigoModelo = Utils.$('f-modelo').value;
            const dados = await FipeAPI.getPreco(codigoMarca, codigoModelo, codigoAno);
            if (dados) {
                const valorStr = dados.Valor.replace('R$ ', '').trim();
                Utils.$('f-fipe').value = valorStr;
                if (dados.AnoModelo) Utils.$('f-ano-modelo').value = dados.AnoModelo;
                const combMap = { 'Gasolina':'Gasolina', 'Álcool':'Flex', 'Diesel':'Diesel', 'Flex':'Flex', 'Elétrico':'Elétrico', 'Híbrido':'Híbrido' };
                Utils.$('f-comb').value = combMap[dados.Combustivel] || 'Flex';
                UI.showFipeResult(dados);
                Utils.showToast('✅', 'Dados FIPE preenchidos!');
            }
        });
    }

    // ---------- AÇÕES NA LISTA DE ESTOQUE ----------
    const estoqueList = Utils.$('estoque-list');
    if (estoqueList) {
        estoqueList.addEventListener('click', async e => {
            const toggleBtn = e.target.closest('[data-toggle]');
            const editBtn = e.target.closest('[data-edit]');
            const delBtn = e.target.closest('[data-del]');

            if (toggleBtn) {
                const id = parseInt(toggleBtn.dataset.toggle);
                try {
                    await Storage.toggleStatus(id);
                    await UI.loadAndRenderEstoque(searchEstoque?.value || '');
                    await UI.loadAndRenderDashboard();
                    Utils.showToast('✅', 'Status atualizado!');
                } catch (error) {
                    Utils.showToast('❌', 'Erro ao atualizar status', error.message);
                }
            }

            if (editBtn) {
                const id = parseInt(editBtn.dataset.edit);
                const vehicle = AppState.vehicles.find(v => v.id === id);
                if (vehicle) {
                    UI.fillForm(vehicle);
                    UI.showPage('cadastro');
                }
            }

            if (delBtn) {
                const id = parseInt(delBtn.dataset.del);
                const vehicle = AppState.vehicles.find(v => v.id === id);
                if (vehicle && confirm(`Deseja realmente excluir ${vehicle.marca} ${vehicle.modelo} (${vehicle.ano_fabricacao || '—'})? Esta ação é irreversível.`)) {
                    try {
                        await Storage.deleteVehicle(id);
                        if (vehicle.photos && vehicle.photos.length) {
                            for (const url of vehicle.photos) {
                                const path = url.split('/').slice(-2).join('/');
                                await Utils.deletePhoto(path).catch(console.warn);
                            }
                        }
                        await UI.loadAndRenderEstoque(searchEstoque?.value || '');
                        await UI.loadAndRenderDashboard();
                        Utils.showToast('🗑️', 'Veículo removido');
                    } catch (error) {
                        Utils.showToast('❌', 'Erro ao remover', error.message);
                    }
                }
            }
        });
    }
});