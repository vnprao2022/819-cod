/** Shared API client and utilities */

const API = {
  base: '',

  getAdminToken() {
    return sessionStorage.getItem('cod_admin_token') || '';
  },

  setAdminToken(token) {
    if (token) sessionStorage.setItem('cod_admin_token', token);
    else sessionStorage.removeItem('cod_admin_token');
  },

  isAdmin() {
    return !!this.getAdminToken();
  },

  authHeaders(extra = {}) {
    const token = this.getAdminToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
  },

  async get(path) {
    const res = await fetch(`${this.base}${path}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  async put(path, data) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'PUT',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${this.base}${path}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  async post(path, data) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new Error(json.error || res.statusText);
    return json;
  },

  async upload(path, formData) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },

  async login(password) {
    const data = await this.post('/api/admin/login', { password });
    this.setAdminToken(data.token);
    return data;
  },

  async logout() {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: this.authHeaders(),
      });
    } catch (_) { /* ignore */ }
    this.setAdminToken('');
  },

  async checkAdmin() {
    const token = this.getAdminToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/admin/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { this.setAdminToken(''); return false; }
      return true;
    } catch {
      return false;
    }
  },
};

const Store = {
  getServer() { return '819'; },
  setServer() { localStorage.setItem('cod_server', '819'); },
  getDataset() { return localStorage.getItem('cod_dataset') || ''; },
  setDataset(key) { localStorage.setItem('cod_dataset', key); },
  getColumns() {
    try { return JSON.parse(localStorage.getItem('cod_columns_v3') || 'null'); }
    catch { return null; }
  },
  setColumns(cols) { localStorage.setItem('cod_columns_v3', JSON.stringify(cols)); },
};

function formatNumber(n) {
  if (n == null || n === '') return '-';
  n = Number(n);
  if (isNaN(n)) return n;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateRange(from, to) {
  return `${formatDate(from)} → ${formatDate(to)}`;
}

const DEFAULT_COLUMNS = [
  'rank', 'role_id', 'name', 'power', 'merit',
  'deco', 'red_artifact', 'main', 'tier',
];

const NUMERIC_FIELDS = new Set([
  'rank', 'power', 'highest_power', 'deaths', 'merit', 'gathering',
  'healing', 'alliance_donation', 'build_time', 'destroy_time',
  'resource_aid', 'behemoth_wins', 'alliance_help', 'mp_ratio',
  'merit_infantry', 'merit_cavalry', 'merit_archer', 'merit_mage', 'merit_other',
]);

const CUSTOM_FIELDS = ['deco', 'red_artifact', 'main', 'tier', 'note'];

function enrichPlayer(p) {
  return {
    ...p,
    mp_ratio: calcMP(p.merit, p.power),
  };
}

function renderSidebar(activePage) {
  const server = Store.getServer();
  const pages = [
    { href: '/', icon: '📊', label: t('nav_dashboard'), id: 'dashboard' },
    { href: '/players.html', icon: '👥', label: t('nav_rankings'), id: 'players' },
    { href: '/player.html', icon: '🔍', label: t('nav_player'), id: 'player' },
    { href: '/rewards.html', icon: '🏆', label: t('nav_rewards'), id: 'rewards' },
    { href: '/settings.html', icon: '⚙️', label: t('nav_settings'), id: 'settings' },
  ];

  if (API.isAdmin()) {
    pages.splice(3, 0, { href: '/import.html', icon: '📥', label: t('nav_import'), id: 'import' });
  }

  return `
    <button class="mobile-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰</button>
    <aside class="sidebar">
      <div class="sidebar-logo">
        <h1>${t('app_title')}</h1>
        ${server ? `<span class="server-badge">SERVER ${server}</span>` : ''}
      </div>
      <nav class="sidebar-nav">
        ${pages.map(p => `
          <a href="${p.href}" class="${p.id === activePage ? 'active' : ''}">
            <span class="icon">${p.icon}</span> ${p.label}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        ${renderLanguageSelector()}
      </div>
    </aside>
  `;
}

async function renderAdminSection() {
  const el = document.getElementById('admin-section');
  if (!el) return;

  const isAdmin = await API.checkAdmin();
  if (isAdmin) {
    el.innerHTML = `
      <div class="admin-badge">${t('admin_logged_in')}</div>
      <button class="btn btn-secondary btn-sm btn-block" onclick="handleLogout()">${t('logout')}</button>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-secondary btn-sm btn-block" onclick="showAdminLogin()">${t('import_login')}</button>
    `;
  }
}

window.handleLogout = async () => {
  await API.logout();
  location.reload();
};

window.showAdminLogin = () => {
  const existing = document.getElementById('admin-login-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'admin-login-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-box">
      <h3>${t('import_login')}</h3>
      <div class="form-row" style="margin-top:1rem">
        <label>${t('admin_password')}</label>
        <input type="password" id="admin-pw-input" autofocus>
      </div>
      <div id="admin-login-error" class="alert alert-danger" style="display:none;margin-top:0.5rem"></div>
      <div style="margin-top:1rem;display:flex;gap:0.5rem">
        <button class="btn btn-primary" id="admin-login-btn">${t('login')}</button>
        <button class="btn btn-secondary" onclick="document.getElementById('admin-login-modal').remove()">${t('cancel')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const doLogin = async () => {
    const pw = document.getElementById('admin-pw-input').value;
    const errEl = document.getElementById('admin-login-error');
    try {
      await API.login(pw);
      modal.remove();
      location.reload();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };

  document.getElementById('admin-login-btn').addEventListener('click', doLogin);
  document.getElementById('admin-pw-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
};

async function initSidebar(activePage) {
  document.getElementById('sidebar').innerHTML = renderSidebar(activePage);
  await renderAdminSection();
}

async function initServerSelector(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  Store.setServer('819');
  container.innerHTML = '';
}

async function initDatasetSelector(containerId, serverId, onChange) {
  const container = document.getElementById(containerId);
  if (!container || !serverId) {
    if (container) container.innerHTML = '';
    return;
  }

  const datasets = await API.get(`/api/servers/${serverId}/datasets`);
  const current = Store.getDataset() || (datasets.length ? datasets[datasets.length - 1].key : '');

  container.innerHTML = `
    <div class="control-group">
      <label>${t('dataset')}</label>
      <select id="dataset-select">
        ${datasets.map(d => `
          <option value="${d.key}" ${d.key === current ? 'selected' : ''}>
            ${formatDateRange(d.date_from, d.date_to)} (${d.player_count})
          </option>
        `).join('')}
      </select>
    </div>
  `;

  if (current) Store.setDataset(current);

  document.getElementById('dataset-select').addEventListener('change', (e) => {
    Store.setDataset(e.target.value);
    if (onChange) onChange(e.target.value);
  });

  return current;
}

function showLoading(el) {
  el.innerHTML = `<div class="loading"><div class="spinner"></div>${t('loading')}</div>`;
}

function showError(el, msg) {
  el.innerHTML = `<div class="alert alert-danger">${msg}</div>`;
}

function showEmpty(el, msg) {
  el.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>${msg || t('no_data')}</p></div>`;
}

async function saveCustomData(serverId, roleId, fields) {
  return API.put(`/api/servers/${serverId}/custom/${roleId}`, fields);
}

function renderCustomCell(col, player, editable) {
  const val = player[col];
  if (!editable) {
    if (col === 'tier') return renderTier(val);
    if (col === 'red_artifact') {
      const yes = val === true || val === 'true' || val === 1;
      return `<span class="badge ${yes ? 'badge-yes' : 'badge-no'}">${yes ? t('yes') : t('no')}</span>`;
    }
    if (col === 'main') return getMainLabel(val);
    return val || '-';
  }

  if (col === 'deco') {
    return `<input class="inline-edit" data-field="deco" data-id="${player.role_id}" value="${val || ''}" placeholder="${t('deco_placeholder')}">`;
  }
  if (col === 'red_artifact') {
    const checked = val === true || val === 'true' || val === 1 ? 'checked' : '';
    return `<input type="checkbox" class="inline-check" data-field="red_artifact" data-id="${player.role_id}" ${checked}>`;
  }
  if (col === 'main') {
    return `<select class="inline-edit" data-field="main" data-id="${player.role_id}">
      <option value="">-</option>
      ${getMainOptions().map(o => `<option value="${o.value}" ${val === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select>`;
  }
  if (col === 'tier') {
    return `<select class="inline-edit" data-field="tier" data-id="${player.role_id}">
      <option value="" ${!val ? 'selected' : ''}>-</option>
      <option value="T4" ${val === 'T4' ? 'selected' : ''}>T4</option>
      <option value="T5" ${val === 'T5' ? 'selected' : ''}>T5</option>
    </select>`;
  }
  if (col === 'note') {
    return `<input class="inline-edit" data-field="note" data-id="${player.role_id}" value="${val || ''}">`;
  }
  return val || '-';
}

function renderTier(value) {
  if (value === 'T4') return '<span class="badge tier-t4">T4</span>';
  if (value === 'T5') return '<span class="badge tier-t5">T5</span>';
  return '<span class="tier-none">-</span>';
}

function bindInlineEdits(serverId, onSaved) {
  document.querySelectorAll('.inline-edit, .inline-check').forEach(el => {
    el.addEventListener('change', async () => {
      const roleId = el.dataset.id;
      const field = el.dataset.field;
      let value = el.type === 'checkbox' ? el.checked : el.value;
      try {
        await saveCustomData(serverId, roleId, { [field]: value });
        if (onSaved) onSaved(roleId, field, value);
      } catch (err) {
        alert(err.message);
      }
    });
  });
}
