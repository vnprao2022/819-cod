/** Shared API client. Vercel serves read-only data through the Flask API. */

const VERCEL_MODE = location.hostname.endsWith('vercel.app');
const STATIC_MODE = false;

const StaticData = {
  async json(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not load ${path}`);
    return response.json();
  },
  async datasets(serverId) {
    return this.json(`/data/datasets/${serverId}/index.json`);
  },
  async dataset(serverId, key) {
    return this.json(`/data/datasets/${serverId}/${key}.json`);
  },
  async custom(serverId) {
    return this.json(`/data/custom/${serverId}.json`).catch(() => ({}));
  },
  async mergedDataset(serverId, key) {
    const [dataset, custom, datasets] = await Promise.all([this.dataset(serverId, key), this.custom(serverId), this.datasets(serverId)]);
    const latest = datasets[datasets.length - 1];
    const latestDataset = latest ? await this.dataset(serverId, latest.key) : dataset;
    const latestIds = new Set((latestDataset.players || []).map(p => String(p.role_id)));
    const players = (dataset.players || []).map(p => ({ ...p, ...(custom[String(p.role_id)] || {}), migrated: !latestIds.has(String(p.role_id)) }));
    if (latest && key === latest.key) {
      const included = new Set(players.map(p => String(p.role_id)));
      for (const older of [...datasets].slice(0, -1).reverse()) {
        const oldDataset = await this.dataset(serverId, older.key);
        for (const p of oldDataset.players || []) {
          const id = String(p.role_id);
          if (!included.has(id)) { included.add(id); players.push({ ...p, ...(custom[id] || {}), migrated: true }); }
        }
      }
    }
    return { ...dataset, players };
  },
  stats(players) {
    const values = field => players.map(p => Number(p[field]) || 0);
    const powers = values('power');
    const sorted = [...powers].sort((a, b) => b - a);
    const bucket = (min, max = Infinity) => powers.filter(p => p >= min && p < max).length;
    return {
      total_players: players.length, total_power: powers.reduce((a, b) => a + b, 0),
      top_300_power: sorted.slice(0, 300).reduce((a, b) => a + b, 0), top_200_power: sorted.slice(0, 200).reduce((a, b) => a + b, 0),
      average_power: powers.length ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : 0, highest_power: Math.max(0, ...powers),
      total_deaths: values('deaths').reduce((a, b) => a + b, 0), total_merit: values('merit').reduce((a, b) => a + b, 0),
      total_healing: values('healing').reduce((a, b) => a + b, 0), total_gathering: values('gathering').reduce((a, b) => a + b, 0),
      power_buckets: { power_0_20: bucket(0, 20e6), power_20_40: bucket(20e6, 40e6), power_40_60: bucket(40e6, 60e6), power_60_80: bucket(60e6, 80e6), power_80_100: bucket(80e6, 100e6), power_over_100: bucket(100e6) },
    };
  },
  async get(path) {
    if (path === '/api/servers') return this.json('/data/servers.json');
    let match = path.match(/^\/api\/servers\/([^/]+)\/datasets$/);
    if (match) return this.datasets(match[1]);
    match = path.match(/^\/api\/servers\/([^/]+)\/dataset\/([^/]+)$/);
    if (match) return this.mergedDataset(match[1], match[2]);
    match = path.match(/^\/api\/servers\/([^/]+)\/dashboard\/([^/]+)$/);
    if (match) { const data = await this.dataset(match[1], match[2]); return { server_id: match[1], date_from: data.date_from, date_to: data.date_to, stats: this.stats(data.players || []) }; }
    match = path.match(/^\/api\/servers\/([^/]+)\/custom$/);
    if (match) return this.custom(match[1]);
    match = path.match(/^\/api\/servers\/([^/]+)\/player\/([^/]+)\/history$/);
    if (match) { const datasets = await this.datasets(match[1]); const id = decodeURIComponent(match[2]); const history = []; for (const ds of datasets) { const data = await this.dataset(match[1], ds.key); const player = (data.players || []).find(p => String(p.role_id) === id); if (player) history.push({ dataset_key: ds.key, date_from: data.date_from, date_to: data.date_to, ...player }); } return history; }
    match = path.match(/^\/api\/servers\/([^/]+)\/player\/([^?]+)(?:\?dataset=([^&]+))?$/);
    if (match) { const data = await this.mergedDataset(match[1], decodeURIComponent(match[3] || Store.getDataset())); const player = data.players.find(p => String(p.role_id) === decodeURIComponent(match[2])); if (player) return { ...player, _custom: (await this.custom(match[1]))[String(player.role_id)] || {} }; throw new Error('Player not found'); }
    throw new Error('This action is available only on localhost.');
  },
};

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
    if (STATIC_MODE) return StaticData.get(path);
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
    if (VERCEL_MODE) throw new Error('Deleting datasets is available only on localhost.');
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
    if (VERCEL_MODE) throw new Error('Importing Excel is available only on localhost.');
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
    if (VERCEL_MODE) return false;
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
    status: getPlayerStatus(p),
    mp_ratio: calcMP(p.merit, p.power),
  };
}

const PLAYER_STATUSES = ['active', 'migrated', 'quit', 'rest_ticket'];

function getPlayerStatus(player) {
  const status = String(player.status || '').trim().toLowerCase();
  if (PLAYER_STATUSES.includes(status)) return status;
  return player.migrated ? 'migrated' : 'active';
}

function getPlayerStatusLabel(playerOrStatus) {
  const status = typeof playerOrStatus === 'string'
    ? getPlayerStatus({ status: playerOrStatus })
    : getPlayerStatus(playerOrStatus);
  return t(`${status}_players`);
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
