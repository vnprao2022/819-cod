let adminPlayers = [];
let adminFilteredPlayers = [];
let adminDataset = Store.getDataset();
let adminPage = 1;
const ADMIN_PAGE_SIZE = 50;
let editingPlayer = null;
let linkedFarmIds = [];
let selectedExcelFile = null;
let importPreview = null;
let replaceDatasetKey = '';

function filterAdminRanking() {
  const q = document.getElementById('admin-player-search').value.trim().toLowerCase();
  adminFilteredPlayers = adminPlayers.filter(p =>
    !q || String(p.role_id || '').includes(q) || String(p.name || '').toLowerCase().includes(q)
  ).sort((a, b) => (Number(a.rank) || 999999) - (Number(b.rank) || 999999));
  adminPage = 1;
  renderAdminRanking();
}

function renderAdminRanking() {
  const target = document.getElementById('admin-ranking');
  const totalPages = Math.max(1, Math.ceil(adminFilteredPlayers.length / ADMIN_PAGE_SIZE));
  adminPage = Math.min(adminPage, totalPages);
  const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
  const rows = adminFilteredPlayers.slice(start, start + ADMIN_PAGE_SIZE);
  target.innerHTML = `<div class="table-wrapper admin-ranking-table"><table>
    <thead><tr><th>Rank</th><th>Player ID</th><th>Name</th><th>Power</th><th>Merit</th><th>M/P</th><th>Deco</th><th>Artifact</th><th>Main troop</th><th>Tier</th><th>Status</th></tr></thead>
    <tbody>${rows.map(p => `<tr class="admin-player-row" data-id="${p.role_id}">
      <td class="number">${p.rank ?? '-'}</td><td class="role-id number">${p.role_id}</td><td class="name">${p.name || '-'}</td>
      <td class="number">${formatNumber(p.power)}</td><td class="number">${formatNumber(p.merit)}</td><td class="number">${formatMP(p.merit, p.power)}</td>
      <td>${p.deco || '-'}</td><td>${p.red_artifact ? 'Yes' : 'No'}</td><td>${getMainLabel(p.main)}</td><td>${renderTier(p.tier)}</td>
      <td><span class="badge badge-status badge-${getPlayerStatus(p)}">${getPlayerStatusLabel(p)}</span></td>
    </tr>`).join('')}</tbody>
  </table><div class="pagination"><div class="pagination-info">Showing ${start + 1}–${Math.min(start + ADMIN_PAGE_SIZE, adminFilteredPlayers.length)} of ${adminFilteredPlayers.length}</div>
    <div class="pagination-buttons"><button id="admin-prev" ${adminPage === 1 ? 'disabled' : ''}>← Previous</button><button class="active">${adminPage} / ${totalPages}</button><button id="admin-next" ${adminPage === totalPages ? 'disabled' : ''}>Next →</button></div></div></div>`;
  target.querySelectorAll('.admin-player-row').forEach(row => row.addEventListener('click', () => openAdminEditor(row.dataset.id)));
  document.getElementById('admin-prev').addEventListener('click', () => { adminPage--; renderAdminRanking(); });
  document.getElementById('admin-next').addEventListener('click', () => { adminPage++; renderAdminRanking(); });
}

function renderFarmLinks() {
  const list = document.getElementById('linked-farms');
  if (!list) return;
  list.innerHTML = linkedFarmIds.length ? linkedFarmIds.map(id => {
    const farm = adminPlayers.find(p => String(p.role_id) === String(id));
    return `<div class="farm-chip"><span><strong>${farm?.name || 'Unknown player'}</strong><small>${id}</small></span><button type="button" data-remove-farm="${id}" aria-label="Remove farm">×</button></div>`;
  }).join('') : '<span class="muted-text">No farm accounts linked.</span>';
  list.querySelectorAll('[data-remove-farm]').forEach(button => button.addEventListener('click', () => {
    linkedFarmIds = linkedFarmIds.filter(id => id !== button.dataset.removeFarm);
    renderFarmLinks();
  }));
}

function showFarmSearch() {
  const panel = document.getElementById('farm-search-panel');
  panel.hidden = false;
  document.getElementById('farm-search-input').focus();
  renderFarmSearchResults('');
}

function renderFarmSearchResults(query) {
  const q = query.trim().toLowerCase();
  const results = document.getElementById('farm-search-results');
  const matches = adminPlayers.filter(p => {
    const id = String(p.role_id);
    return id !== String(editingPlayer.role_id) && !linkedFarmIds.includes(id) &&
      (!q || id.includes(q) || String(p.name || '').toLowerCase().includes(q));
  }).slice(0, 20);
  results.innerHTML = matches.map(p => `<button type="button" class="farm-search-result" data-farm-id="${p.role_id}"><span><strong>${p.name || '-'}</strong><small>${p.role_id}</small></span><b>＋</b></button>`).join('') || '<div class="muted-text">No matching player.</div>';
  results.querySelectorAll('[data-farm-id]').forEach(button => button.addEventListener('click', () => {
    linkedFarmIds.push(button.dataset.farmId);
    renderFarmLinks();
    document.getElementById('farm-search-input').value = '';
    renderFarmSearchResults('');
  }));
}

function openAdminEditor(roleId) {
  editingPlayer = adminPlayers.find(p => String(p.role_id) === String(roleId));
  if (!editingPlayer) return;
  linkedFarmIds = (Array.isArray(editingPlayer.farm_role_ids) ? editingPlayer.farm_role_ids : []).map(String);
  const target = document.getElementById('admin-editor');
  target.innerHTML = `<div class="admin-editor-head"><div class="player-header"><div class="player-avatar">${(editingPlayer.name || '?')[0]}</div><div class="player-info"><h3>${editingPlayer.name || '-'}</h3><div class="role-id-display">Player ID: ${editingPlayer.role_id}</div></div></div><button class="btn btn-secondary" id="close-editor">Close</button></div>
    <div class="custom-editor"><h4>Custom Stats</h4>
      <div class="form-row"><label>Deco (%)</label><input id="adm-deco" value="${editingPlayer.deco || ''}"></div>
      <div class="form-row"><label>Artifact</label><input type="checkbox" id="adm-artifact" ${editingPlayer.red_artifact ? 'checked' : ''}></div>
      <div class="form-row"><label>Main troop</label><select id="adm-main"><option value="">-</option>${getMainOptions().map(o => `<option value="${o.value}" ${editingPlayer.main === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
      <div class="form-row"><label>Tier</label><select id="adm-tier"><option value="" ${!editingPlayer.tier ? 'selected' : ''}>-</option><option value="T4" ${editingPlayer.tier === 'T4' ? 'selected' : ''}>T4</option><option value="T5" ${editingPlayer.tier === 'T5' ? 'selected' : ''}>T5</option></select></div>
      <div class="form-row"><label>Team</label><input id="adm-team" value="${editingPlayer.team || ''}"></div>
      <div class="form-row"><label>Status</label><select id="adm-status">
        <option value="active" ${getPlayerStatus(editingPlayer) === 'active' ? 'selected' : ''}>Active</option>
        <option value="migrated" ${getPlayerStatus(editingPlayer) === 'migrated' ? 'selected' : ''}>Migrated</option>
        <option value="quit" ${getPlayerStatus(editingPlayer) === 'quit' ? 'selected' : ''}>Quit</option>
        <option value="rest_ticket" ${getPlayerStatus(editingPlayer) === 'rest_ticket' ? 'selected' : ''}>Rest ticket given</option>
      </select></div>
      <div class="form-row"><label>Note</label><input id="adm-note" value="${editingPlayer.note || ''}"></div>
      <div class="farm-link-section"><div class="farm-link-title"><div><h4>Farm Accounts</h4><p>Link one or more farms by player name or ID.</p></div><button type="button" class="btn btn-primary" id="add-farm">＋ Add farm</button></div>
        <div id="linked-farms" class="farm-chip-list"></div>
        <div id="farm-search-panel" class="farm-search-panel" hidden><input type="search" id="farm-search-input" placeholder="Search farm by name or Player ID..."><div id="farm-search-results"></div></div>
      </div>
      <div class="admin-save-row"><button class="btn btn-primary" id="adm-save">Lưu thay đổi</button><span id="adm-save-status" class="admin-save-feedback" role="status" aria-live="polite"></span></div>
    </div>`;
  renderFarmLinks();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('close-editor').addEventListener('click', () => { target.innerHTML = ''; editingPlayer = null; });
  document.getElementById('add-farm').addEventListener('click', showFarmSearch);
  document.getElementById('farm-search-input').addEventListener('input', e => renderFarmSearchResults(e.target.value));
  document.getElementById('adm-save').addEventListener('click', saveAdminChanges);
}

async function saveAdminChanges() {
  const fields = {
    deco: document.getElementById('adm-deco').value,
    red_artifact: document.getElementById('adm-artifact').checked,
    main: document.getElementById('adm-main').value,
    tier: document.getElementById('adm-tier').value,
    team: document.getElementById('adm-team').value,
    status: document.getElementById('adm-status').value,
    note: document.getElementById('adm-note').value,
    farm_role_ids: [...new Set(linkedFarmIds)],
  };
  const status = document.getElementById('adm-save-status');
  const saveButton = document.getElementById('adm-save');
  saveButton.disabled = true;
  saveButton.textContent = 'Đang lưu...';
  status.className = 'admin-save-feedback saving';
  status.textContent = 'Đang gửi dữ liệu lên server...';
  try {
    await saveCustomData('819', editingPlayer.role_id, fields);
    Object.assign(editingPlayer, fields);
    status.className = 'admin-save-feedback success';
    status.textContent = `Đã lưu thành công lúc ${new Date().toLocaleTimeString('vi-VN')}`;
    renderAdminRanking();
  } catch (err) {
    status.className = 'admin-save-feedback error';
    status.textContent = `Lưu thất bại: ${err.message}`;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Lưu thay đổi';
  }
}

async function loadAdminPlayers() {
  if (!adminDataset) return;
  const target = document.getElementById('admin-ranking');
  showLoading(target);
  try {
    const data = await API.get(`/api/servers/819/dataset/${adminDataset}`);
    adminPlayers = data.players || [];
    filterAdminRanking();
  } catch (err) { showError(target, err.message); }
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  document.getElementById('admin-tab-players').hidden = tab !== 'players';
  document.getElementById('admin-tab-datasets').hidden = tab !== 'datasets';
  if (tab === 'datasets') loadDatasetManager();
}

async function loadDatasetManager() {
  const target = document.getElementById('admin-datasets-list');
  showLoading(target);
  try {
    const datasets = await API.get('/api/servers/819/datasets');
    target.innerHTML = datasets.length ? `<div class="table-wrapper"><table>
      <thead><tr><th>Period</th><th>Source File</th><th>Accounts</th><th>Actions</th></tr></thead>
      <tbody>${[...datasets].reverse().map(d => `<tr><td>${formatDateRange(d.date_from, d.date_to)}</td><td>${d.source_file}</td><td class="number">${d.player_count}</td><td class="dataset-actions"><button class="btn btn-secondary btn-sm" data-replace="${d.key}">Replace Excel</button><button class="btn btn-danger btn-sm" data-delete="${d.key}" data-label="${formatDateRange(d.date_from, d.date_to)}">Delete</button></td></tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty-state"><p>No datasets imported.</p></div>';
    target.querySelectorAll('[data-replace]').forEach(button => button.addEventListener('click', () => {
      replaceDatasetKey = button.dataset.replace;
      selectedExcelFile = null;
      document.getElementById('admin-excel-file').value = '';
      document.getElementById('admin-excel-file').click();
    }));
    target.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => deleteManagedDataset(button.dataset.delete, button.dataset.label)));
  } catch (err) { showError(target, err.message); }
}

async function deleteManagedDataset(key, label) {
  if (!confirm(`Delete Excel dataset ${label}?\n\nDeco, Artifact, Main troop, Tier, farm links, Team, Status and Notes will be preserved.`)) return;
  try {
    await API.delete(`/api/servers/819/dataset/${key}`);
    const current = Store.getDataset();
    if (current === key) Store.setDataset('');
    document.getElementById('admin-editor').innerHTML = '';
    document.getElementById('admin-import-panel').innerHTML = '<div class="alert alert-success">Dataset deleted. All custom player data was preserved.</div>';
    await loadDatasetManager();
  } catch (err) { document.getElementById('admin-import-panel').innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
}

async function previewExcelImport(file) {
  selectedExcelFile = file;
  const panel = document.getElementById('admin-import-panel');
  if (!file || !file.name.toLowerCase().endsWith('.xlsx')) {
    panel.innerHTML = '<div class="alert alert-danger">Please select an .xlsx file.</div>';
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    panel.innerHTML = '<div class="alert alert-danger">Excel file is too large. The maximum upload size on Vercel is 4 MB.</div>';
    return;
  }
  showLoading(panel);
  const form = new FormData();
  form.append('file', file);
  try {
    importPreview = await API.upload('/api/import/preview', form);
    if (importPreview.server_id !== '819') throw new Error('This website only accepts Server 819 datasets.');
    if (replaceDatasetKey && importPreview.dataset_key !== replaceDatasetKey) {
      throw new Error(`Replacement file must have the same period: ${replaceDatasetKey}.`);
    }
    const replacing = Boolean(replaceDatasetKey || importPreview.dataset_exists);
    panel.innerHTML = `<div class="preview-card"><h4>${replacing ? 'Replace Dataset Preview' : 'Import Preview'}</h4>
      <div class="preview-row"><span class="key">File</span><span class="val">${importPreview.filename}</span></div>
      <div class="preview-row"><span class="key">Period</span><span class="val">${formatDateRange(importPreview.date_from, importPreview.date_to)}</span></div>
      <div class="preview-row"><span class="key">Accounts</span><span class="val">${importPreview.player_count}</span></div>
      <div class="preview-row"><span class="key">Custom data</span><span class="val">Will be preserved</span></div>
      ${importPreview.duplicate_role_ids?.length ? `<div class="alert alert-warning">Duplicate Player IDs: ${importPreview.duplicate_role_ids.slice(0, 10).join(', ')}</div>` : ''}
      <button class="btn btn-primary" id="confirm-admin-import">${replacing ? 'Confirm Replace' : 'Confirm Import'}</button>
      <button class="btn btn-secondary" id="cancel-admin-import">Cancel</button>
    </div>`;
    document.getElementById('confirm-admin-import').addEventListener('click', confirmExcelImport);
    document.getElementById('cancel-admin-import').addEventListener('click', resetExcelImport);
  } catch (err) {
    panel.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    selectedExcelFile = null;
    importPreview = null;
    replaceDatasetKey = '';
  }
}

async function confirmExcelImport() {
  if (!selectedExcelFile || !importPreview) return;
  const panel = document.getElementById('admin-import-panel');
  showLoading(panel);
  const form = new FormData();
  form.append('file', selectedExcelFile);
  if (replaceDatasetKey || importPreview.dataset_exists) form.append('overwrite', 'true');
  try {
    const result = await API.upload('/api/import/confirm', form);
    Store.setDataset(result.dataset_key);
    panel.innerHTML = `<div class="alert alert-success">Imported ${result.player_count} accounts successfully. Custom data was preserved.</div>`;
    selectedExcelFile = null;
    importPreview = null;
    replaceDatasetKey = '';
    await loadDatasetManager();
  } catch (err) { panel.innerHTML = `<div class="alert alert-danger">${err.message}</div>`; }
}

function resetExcelImport() {
  selectedExcelFile = null;
  importPreview = null;
  replaceDatasetKey = '';
  document.getElementById('admin-excel-file').value = '';
  document.getElementById('admin-import-panel').innerHTML = '';
}

function bindAdminEvents() {
  document.getElementById('admin-player-search').addEventListener('input', filterAdminRanking);
  document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => switchAdminTab(button.dataset.adminTab)));
  document.getElementById('new-import-btn').addEventListener('click', () => {
    resetExcelImport();
    document.getElementById('admin-excel-file').click();
  });
  document.getElementById('admin-excel-file').addEventListener('change', e => { if (e.target.files.length) previewExcelImport(e.target.files[0]); });
}

async function initializeAdminPage() {
  bindAdminEvents();
  resetExcelImport();
  adminDataset = await initDatasetSelector('dataset-selector', '819', key => { adminDataset = key; loadAdminPlayers(); });
  loadAdminPlayers();
}

async function showAdminApp() {
  document.getElementById('tuan-login').hidden = true;
  document.getElementById('tuan-admin-app').hidden = false;
  window.scrollTo(0, 0);
  await initializeAdminPage();
}

document.getElementById('tuan-login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.getElementById('tuan-login-error');
  error.hidden = true;
  try {
    await API.login(
      document.getElementById('tuan-username').value.trim(),
      document.getElementById('tuan-password').value,
    );
    await showAdminApp();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
});

document.getElementById('tuan-logout').addEventListener('click', async () => {
  await API.logout();
  location.reload();
});

(async () => {
  if (await API.checkAdmin()) await showAdminApp();
})();
