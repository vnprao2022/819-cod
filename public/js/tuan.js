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
let migrationAdminData = { players: [], deadline: '', visible: false };
let selectedMigrationPlayer = null;
let migrationAvailablePlayers = [];
let kpiFilterConditions = [{ field: 'mp_ratio', operator: 'lt', value: '10' }];
let kpiFilterResults = [];
let kpiAccountScope = 'all';
let kpiTierFilter = '';

const KPI_FILTER_FIELDS = [
  ['mp_ratio', 'M/P (%)'],
  ['power', 'Lực chiến hiện tại'],
  ['highest_power', 'Lực chiến cao nhất'],
  ['merit', 'Công trạng'],
  ['build_time', 'Thời gian xây dựng'],
  ['destroy_time', 'Thời gian phá hủy'],
  ['deaths', 'Tử vong'],
  ['healing', 'Trị liệu'],
  ['severely_wounded', 'Bị thương nặng'],
  ['gathering', 'Thu thập'],
  ['alliance_donation', 'Đóng góp liên minh'],
  ['resource_aid', 'Viện trợ tài nguyên'],
  ['alliance_help', 'Trợ giúp liên minh'],
  ['behemoth_wins', 'Thắng Behemoth'],
  ['rank', 'Hạng'],
];

function renderKpiFilterConditions() {
  const target = document.getElementById('kpi-filter-conditions');
  if (!target) return;
  const options = KPI_FILTER_FIELDS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  target.innerHTML = kpiFilterConditions.map((condition, index) => `
    <div class="kpi-filter-row" data-kpi-index="${index}">
      <span class="kpi-filter-row-number">${index + 1}</span>
      <select data-kpi-field aria-label="Cột lọc">${options}</select>
      <select data-kpi-operator aria-label="Điều kiện"><option value="lt">nhỏ hơn (&lt;)</option><option value="gt">lớn hơn (&gt;)</option></select>
      <input type="number" inputmode="decimal" step="any" data-kpi-value aria-label="Giá trị" placeholder="Giá trị">
      <button type="button" class="btn btn-ghost btn-sm kpi-filter-remove" data-remove-kpi="${index}" aria-label="Xóa điều kiện">×</button>
    </div>
  `).join('');
  target.querySelectorAll('[data-kpi-field]').forEach((select, index) => {
    select.value = kpiFilterConditions[index].field;
    select.addEventListener('change', event => { kpiFilterConditions[index].field = event.target.value; });
  });
  target.querySelectorAll('[data-kpi-operator]').forEach((select, index) => {
    select.value = kpiFilterConditions[index].operator;
    select.addEventListener('change', event => { kpiFilterConditions[index].operator = event.target.value; });
  });
  target.querySelectorAll('[data-kpi-value]').forEach((input, index) => {
    input.value = kpiFilterConditions[index].value;
    input.addEventListener('input', event => { kpiFilterConditions[index].value = event.target.value; });
  });
  target.querySelectorAll('[data-remove-kpi]').forEach(button => button.addEventListener('click', () => {
    if (kpiFilterConditions.length <= 1) return;
    kpiFilterConditions.splice(Number(button.dataset.removeKpi), 1);
    renderKpiFilterConditions();
  }));
}

function getKpiFilterValue(player, field) {
  if (field === 'mp_ratio') return Number(calcMP(player.merit, player.power)) || 0;
  return Number(player[field]) || 0;
}

function getKpiFarmIds() {
  return new Set(adminPlayers.flatMap(player => Array.isArray(player.farm_role_ids)
    ? player.farm_role_ids.map(String)
    : []));
}

function getKpiTier(player) {
  const tier = String(player.tier || '').trim().toUpperCase();
  return tier === 'T4' || tier === 'T5' ? tier : '';
}

function renderKpiFilterResults() {
  const target = document.getElementById('kpi-filter-results');
  const total = document.getElementById('kpi-filter-total');
  if (!target || !total) return;
  total.textContent = kpiFilterResults.length;
  if (!kpiFilterResults.length) {
    target.innerHTML = '<div class="empty-state kpi-filter-empty"><p>Chưa có kết quả. Hãy đặt điều kiện rồi bấm “Lọc danh sách”.</p></div>';
    return;
  }
  const farmIds = getKpiFarmIds();
  target.innerHTML = `<div class="table-wrapper kpi-filter-table"><table>
    <thead><tr><th>#</th><th>Player ID</th><th>Tên nhân vật</th><th>Lực chiến</th><th>M/P</th><th>Xây dựng</th><th>Phá hủy</th><th>Tử vong</th><th>T4/T5</th><th>Loại</th><th>Trạng thái</th></tr></thead>
    <tbody>${kpiFilterResults.map((player, index) => `<tr>
      <td class="number">${index + 1}</td><td class="role-id number">${escapeHtml(player.role_id || '-')}</td><td class="name">${escapeHtml(player.name || '-')}</td>
      <td class="number">${formatNumber(player.power)}</td><td class="number">${formatMP(player.merit, player.power)}</td><td class="number">${formatNumber(player.build_time)}</td>
      <td class="number">${formatNumber(player.destroy_time)}</td><td class="number">${formatNumber(player.deaths)}</td><td>${getKpiTier(player) || '-'}</td>
      <td><span class="badge ${farmIds.has(String(player.role_id)) ? 'badge-migration' : 'badge-yes'}">${farmIds.has(String(player.role_id)) ? 'Farm' : 'Chính'}</span></td><td><span class="badge badge-status badge-${getPlayerStatus(player)}">${getPlayerStatusLabel(player)}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function applyKpiFilter() {
  const invalid = kpiFilterConditions.some(condition => condition.value === '' || !Number.isFinite(Number(condition.value)));
  const status = document.getElementById('kpi-filter-status');
  if (invalid) {
    status.className = 'admin-save-feedback error';
    status.textContent = 'Vui lòng nhập một giá trị số hợp lệ cho từng điều kiện.';
    return;
  }
  const farmIds = getKpiFarmIds();
  kpiFilterResults = adminPlayers.filter(player => {
    const isFarm = farmIds.has(String(player.role_id));
    if (kpiAccountScope === 'farm' && !isFarm) return false;
    if (kpiAccountScope === 'main' && isFarm) return false;
    if (kpiTierFilter && getKpiTier(player) !== kpiTierFilter) return false;
    return kpiFilterConditions.every(condition => {
    const actual = getKpiFilterValue(player, condition.field);
    const expected = Number(condition.value);
    return condition.operator === 'gt' ? actual > expected : actual < expected;
    });
  }).sort((a, b) => (Number(a.power) || 0) - (Number(b.power) || 0));
  status.className = 'admin-save-feedback success';
  status.textContent = `Đã lọc ${kpiFilterResults.length} thành viên theo ${kpiFilterConditions.length} điều kiện.`;
  renderKpiFilterResults();
}

function resetKpiFilter() {
  kpiFilterConditions = [{ field: 'mp_ratio', operator: 'lt', value: '10' }];
  kpiFilterResults = [];
  kpiAccountScope = 'all';
  kpiTierFilter = '';
  document.getElementById('kpi-account-scope').value = 'all';
  document.getElementById('kpi-tier-filter').value = '';
  renderKpiFilterConditions();
  const status = document.getElementById('kpi-filter-status');
  status.className = 'admin-save-feedback';
  status.textContent = '';
  renderKpiFilterResults();
}

function kpiResultText() {
  return ['STT\tPlayer ID\tTên nhân vật\tLực chiến\tM/P (%)\tXây dựng\tPhá hủy\tTử vong', ...kpiFilterResults.map((player, index) => [
    index + 1, player.role_id || '', player.name || '', player.power || 0, calcMP(player.merit, player.power), player.build_time || 0, player.destroy_time || 0, player.deaths || 0,
  ].join('\t'))].join('\n');
}

async function copyKpiResults() {
  const status = document.getElementById('kpi-filter-status');
  if (!kpiFilterResults.length) { status.className = 'admin-save-feedback error'; status.textContent = 'Chưa có danh sách để sao chép.'; return; }
  try {
    await navigator.clipboard.writeText(kpiResultText());
    status.className = 'admin-save-feedback success';
    status.textContent = 'Đã sao chép danh sách vào clipboard.';
  } catch (error) {
    status.className = 'admin-save-feedback error';
    status.textContent = 'Không thể sao chép tự động trên trình duyệt này.';
  }
}

function downloadKpiResults() {
  if (!kpiFilterResults.length) return;
  const csv = '\ufeff' + kpiResultText().split('\n').map(row => row.split('\t').map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'danh-sach-loc-kpi.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

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
    adminPlayers = (data.players || []).map(enrichPlayer);
    kpiFilterResults = [];
    filterAdminRanking();
    renderKpiFilterResults();
  } catch (err) { showError(target, err.message); }
}

function renderMigrationSearchResults(query = '') {
  const target = document.getElementById('migration-search-results');
  if (!target) return;
  if (selectedMigrationPlayer) {
    target.innerHTML = `<div class="migration-add-form">
      <div class="migration-add-player"><strong>${escapeHtml(selectedMigrationPlayer.name || '-')}</strong><span>${escapeHtml(selectedMigrationPlayer.role_id)} · ${formatNumber(selectedMigrationPlayer.power)}</span></div>
      <label for="migration-new-reason">Lý do không đạt KPI</label>
      <textarea id="migration-new-reason" rows="4" maxlength="500" placeholder="Nhập lý do hiển thị cho người chơi..."></textarea>
      <div class="migration-add-actions"><button class="btn btn-primary" id="confirm-add-migration">Thêm vào danh sách</button><button class="btn btn-secondary" id="cancel-add-migration">Hủy</button></div>
      <div id="migration-add-status" class="admin-save-feedback"></div>
    </div>`;
    document.getElementById('confirm-add-migration').addEventListener('click', async () => {
      const reason = document.getElementById('migration-new-reason').value.trim();
      const status = document.getElementById('migration-add-status');
      if (!reason) { status.className = 'admin-save-feedback error'; status.textContent = 'Vui lòng nhập lý do.'; return; }
      const saved = await saveMigrationPlayer(selectedMigrationPlayer.role_id, true, reason, status);
      if (!saved) return;
      selectedMigrationPlayer = null;
      document.getElementById('migration-player-search').value = '';
      renderMigrationSearchResults();
    });
    document.getElementById('cancel-add-migration').addEventListener('click', () => { selectedMigrationPlayer = null; renderMigrationSearchResults(query); });
    return;
  }

  const q = query.trim().toLowerCase();
  const listedIds = new Set((migrationAdminData.players || []).map(player => String(player.role_id)));
  const matches = migrationAvailablePlayers.filter(player => {
    const id = String(player.role_id || '');
    return getPlayerStatus(player) === 'active' && !listedIds.has(id) &&
      (!q || id.includes(q) || String(player.name || '').toLowerCase().includes(q));
  }).slice(0, q ? 12 : 6);
  target.innerHTML = matches.map(player => `<button type="button" class="migration-search-result" data-migration-player="${escapeHtml(player.role_id)}">
    <span><strong>${escapeHtml(player.name || '-')}</strong><small>${escapeHtml(player.role_id)}</small></span><b>＋</b>
  </button>`).join('') || '<div class="muted-text migration-no-result">Không tìm thấy người chơi phù hợp.</div>';
  target.querySelectorAll('[data-migration-player]').forEach(button => button.addEventListener('click', () => {
    selectedMigrationPlayer = migrationAvailablePlayers.find(player => String(player.role_id) === button.dataset.migrationPlayer) || null;
    renderMigrationSearchResults(query);
  }));
}

function renderMigrationAdminList() {
  const target = document.getElementById('migration-admin-list');
  const players = migrationAdminData.players || [];
  document.getElementById('migration-admin-total').textContent = players.length;
  document.getElementById('migration-list-count').textContent = `${players.length} người`;
  if (!players.length) {
    target.innerHTML = '<div class="empty-state migration-admin-empty"><p>Chưa có người chơi nào trong danh sách di cư.</p></div>';
    return;
  }
  target.innerHTML = `<div class="migration-admin-rows">${players.map(player => `<article class="migration-admin-player" data-role-id="${escapeHtml(player.role_id)}">
    <div class="migration-admin-player-head"><div class="player-avatar">${escapeHtml((player.name || '?')[0])}</div><div><strong>${escapeHtml(player.name || '-')}</strong><span>${escapeHtml(player.role_id)} · ${formatNumber(player.power)}</span></div></div>
    <label>Lý do không đạt KPI<textarea rows="3" maxlength="500">${escapeHtml(player.reason || '')}</textarea></label>
    <div class="migration-admin-actions"><button class="btn btn-primary btn-sm" data-save-migration>Lưu lý do</button><button class="btn btn-danger btn-sm" data-remove-migration>Xóa khỏi danh sách</button><span class="admin-save-feedback"></span></div>
  </article>`).join('')}</div>`;
  target.querySelectorAll('[data-save-migration]').forEach(button => button.addEventListener('click', async () => {
    const card = button.closest('.migration-admin-player');
    await saveMigrationPlayer(card.dataset.roleId, true, card.querySelector('textarea').value.trim(), card.querySelector('.admin-save-feedback'));
  }));
  target.querySelectorAll('[data-remove-migration]').forEach(button => button.addEventListener('click', async () => {
    const card = button.closest('.migration-admin-player');
    const player = migrationAdminData.players.find(item => String(item.role_id) === card.dataset.roleId);
    if (!confirm(`Xóa ${player?.name || card.dataset.roleId} khỏi danh sách di cư?`)) return;
    await saveMigrationPlayer(card.dataset.roleId, false, '', card.querySelector('.admin-save-feedback'));
  }));
}

async function saveMigrationPlayer(roleId, required, reason, status) {
  status.className = 'admin-save-feedback saving';
  status.textContent = 'Đang lưu...';
  try {
    await saveCustomData('819', roleId, { migration_required: required, migration_reason: reason });
    const player = adminPlayers.find(item => String(item.role_id) === String(roleId));
    if (player) Object.assign(player, { migration_required: required, migration_reason: required ? reason : '' });
    await loadMigrationManager();
    return true;
  } catch (error) {
    status.className = 'admin-save-feedback error';
    status.textContent = `Lỗi: ${error.message}`;
    return false;
  }
}

async function loadMigrationManager() {
  const target = document.getElementById('migration-admin-list');
  showLoading(target);
  try {
    migrationAdminData = await API.get('/api/admin/servers/819/migration');
    if (migrationAdminData.dataset?.key) {
      const latest = await API.get(`/api/servers/819/dataset/${migrationAdminData.dataset.key}`);
      migrationAvailablePlayers = (latest.players || []).filter(player => !player.migrated && getPlayerStatus(player) === 'active');
    } else {
      migrationAvailablePlayers = [];
    }
    document.getElementById('migration-global-deadline').value = migrationAdminData.deadline || '';
    document.getElementById('migration-page-visible').checked = Boolean(migrationAdminData.visible);
    renderMigrationAdminList();
    renderMigrationSearchResults(document.getElementById('migration-player-search').value);
  } catch (error) {
    showError(target, error.message);
  }
}

async function saveMigrationSettings() {
  const button = document.getElementById('save-migration-settings');
  const status = document.getElementById('migration-settings-status');
  button.disabled = true;
  try {
    const settings = await API.put('/api/servers/819/settings', {
      migration_page_visible: document.getElementById('migration-page-visible').checked,
      migration_deadline: document.getElementById('migration-global-deadline').value,
    });
    migrationAdminData.visible = settings.migration_page_visible;
    migrationAdminData.deadline = settings.migration_deadline;
    status.className = 'admin-save-feedback success';
    status.textContent = 'Đã lưu hạn chung và trạng thái hiển thị.';
  } catch (error) {
    status.className = 'admin-save-feedback error';
    status.textContent = `Lưu thất bại: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  document.getElementById('admin-tab-players').hidden = tab !== 'players';
  document.getElementById('admin-tab-kpi-filter').hidden = tab !== 'kpi-filter';
  document.getElementById('admin-tab-migration').hidden = tab !== 'migration';
  document.getElementById('admin-tab-datasets').hidden = tab !== 'datasets';
  document.getElementById('admin-tab-visibility').hidden = tab !== 'visibility';
  if (tab === 'datasets') loadDatasetManager();
  if (tab === 'migration') loadMigrationManager();
  if (tab === 'visibility') loadVisibilitySettings();
}

async function loadVisibilitySettings() {
  const status = document.getElementById('visibility-save-status');
  status.textContent = '';
  try {
    const settings = await API.get('/api/servers/819/settings');
    document.getElementById('honors-visible').checked = Boolean(settings.honors_visible);
  } catch (err) {
    status.className = 'admin-save-feedback error';
    status.textContent = `Không tải được cài đặt: ${err.message}`;
  }
}

async function saveVisibilitySettings() {
  const button = document.getElementById('save-visibility');
  const status = document.getElementById('visibility-save-status');
  button.disabled = true;
  try {
    await API.put('/api/servers/819/settings', {
      honors_visible: document.getElementById('honors-visible').checked,
    });
    status.className = 'admin-save-feedback success';
    status.textContent = 'Đã lưu cài đặt hiển thị.';
  } catch (err) {
    status.className = 'admin-save-feedback error';
    status.textContent = `Lưu thất bại: ${err.message}`;
  } finally {
    button.disabled = false;
  }
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
  document.getElementById('kpi-account-scope').addEventListener('change', event => { kpiAccountScope = event.target.value; });
  document.getElementById('kpi-tier-filter').addEventListener('change', event => { kpiTierFilter = event.target.value; });
  document.getElementById('add-kpi-condition').addEventListener('click', () => {
    kpiFilterConditions.push({ field: 'power', operator: 'lt', value: '' });
    renderKpiFilterConditions();
  });
  document.getElementById('apply-kpi-filter').addEventListener('click', applyKpiFilter);
  document.getElementById('reset-kpi-filter').addEventListener('click', resetKpiFilter);
  document.getElementById('copy-kpi-results').addEventListener('click', copyKpiResults);
  document.getElementById('download-kpi-results').addEventListener('click', downloadKpiResults);
  document.getElementById('migration-player-search').addEventListener('input', event => {
    selectedMigrationPlayer = null;
    renderMigrationSearchResults(event.target.value);
  });
  document.getElementById('save-migration-settings').addEventListener('click', saveMigrationSettings);
  document.querySelectorAll('.admin-tab').forEach(button => button.addEventListener('click', () => switchAdminTab(button.dataset.adminTab)));
  document.getElementById('new-import-btn').addEventListener('click', () => {
    resetExcelImport();
    document.getElementById('admin-excel-file').click();
  });
  document.getElementById('admin-excel-file').addEventListener('change', e => { if (e.target.files.length) previewExcelImport(e.target.files[0]); });
  document.getElementById('save-visibility').addEventListener('click', saveVisibilitySettings);
}

async function initializeAdminPage() {
  bindAdminEvents();
  renderKpiFilterConditions();
  renderKpiFilterResults();
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
