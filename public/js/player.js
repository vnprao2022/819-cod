let currentServer = Store.getServer();
let charts = [];
let isAdmin = false;

const DETAIL_FIELDS = [
  'rank', 'power', 'highest_power', 'deaths', 'merit', 'mp_ratio', 'gathering',
  'healing', 'alliance_donation', 'build_time', 'destroy_time',
  'resource_aid', 'behemoth_wins', 'alliance_help',
  'merit_infantry', 'merit_cavalry', 'merit_archer', 'merit_mage', 'merit_other',
];

const HISTORY_CHARTS = [
  { field: 'power', labelKey: 'power_history', color: '#c8960c' },
  { field: 'rank', labelKey: 'rank_history', color: '#3b82f6' },
  { field: 'deaths', labelKey: 'deaths_history', color: '#ef4444' },
  { field: 'merit', labelKey: 'merit_history', color: '#22c55e' },
  { field: 'healing', labelKey: 'healing_history', color: '#a855f7' },
  { field: 'gathering', labelKey: 'gathering_history', color: '#f59e0b' },
];

function destroyCharts() {
  charts.forEach(c => c.destroy());
  charts = [];
}

function renderCharts(history) {
  return HISTORY_CHARTS.map(chartDef => {
    const values = history.map(h => Number(h[chartDef.field]) || 0);
    const hasData = values.some(v => v > 0);
    if (!hasData && chartDef.field !== 'power') return '';
    return `
      <div class="chart-section">
        <h4>${t(chartDef.labelKey)}</h4>
        <div class="chart-container"><canvas id="chart-${chartDef.field}"></canvas></div>
      </div>
    `;
  }).join('');
}

function initCharts(history) {
  const labels = history.map(h => formatDateRange(h.date_from, h.date_to));

  HISTORY_CHARTS.forEach(chartDef => {
    const canvas = document.getElementById(`chart-${chartDef.field}`);
    if (!canvas) return;
    const values = history.map(h => Number(h[chartDef.field]) || 0);
    charts.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: fieldLabel(chartDef.field),
          data: values,
          borderColor: chartDef.color,
          backgroundColor: chartDef.color + '20',
          fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${fieldLabel(chartDef.field)}: ${formatNumber(ctx.raw)}` } },
        },
        scales: {
          x: { ticks: { color: '#8892a4', maxRotation: 45 }, grid: { color: '#2a3548' } },
          y: { ticks: { color: '#8892a4', callback: (v) => formatNumber(v) }, grid: { color: '#2a3548' } },
        },
      },
    }));
  });
}

function renderCustomEditor(roleId, custom) {
  if (!isAdmin) return '';

  return `
    <div class="custom-editor">
      <h4>${t('custom_data')}</h4>
      <div class="form-row">
        <label>${t('deco')}</label>
        <input type="text" id="custom-deco" value="${custom.deco || ''}" placeholder="${t('deco_placeholder')}">
      </div>
      <div class="form-row">
        <label>${t('red_artifact')}</label>
        <input type="checkbox" id="custom-red-artifact" ${custom.red_artifact ? 'checked' : ''}>
      </div>
      <div class="form-row">
        <label>${t('main')}</label>
        <select id="custom-main">
          <option value="">-</option>
          ${getMainOptions().map(o => `<option value="${o.value}" ${custom.main === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <label>${t('note')}</label>
        <input type="text" id="custom-note" value="${custom.note || ''}">
      </div>
      <div class="form-row">
        <label>${t('farm_ids')}</label>
        <input type="text" id="custom-farm-ids" value="${(custom.farm_role_ids || []).join(', ')}" placeholder="${t('farm_ids_hint')}">
      </div>
      <button class="btn btn-primary" id="save-custom-btn" style="margin-top:0.5rem">${t('save')}</button>
      <span id="save-status" style="margin-left:1rem;font-size:0.85rem"></span>
    </div>
  `;
}

function renderDetailValue(field, player) {
  if (field === 'mp_ratio') return formatMP(player.merit, player.power);
  if (field === 'tier') return renderTier(player.tier);
  if (field === 'red_artifact') {
    const yes = player[field] === true || player[field] === 'true' || player[field] === 1;
    return yes ? `<span class="badge badge-yes">${t('yes')}</span>` : `<span class="badge badge-no">${t('no')}</span>`;
  }
  if (field === 'main') return getMainLabel(player[field]);
  if (NUMERIC_FIELDS.has(field)) return formatNumber(player[field]);
  return player[field] || '-';
}

async function loadPlayer(roleId) {
  const container = document.getElementById('player-content');
  if (!currentServer || !roleId) {
    showEmpty(container, t('player_empty'));
    return;
  }

  showLoading(container);

  try {
    const [player, history] = await Promise.all([
      API.get(`/api/servers/${currentServer}/player/${roleId}?dataset=${Store.getDataset()}`),
      API.get(`/api/servers/${currentServer}/player/${roleId}/history`).catch(() => []),
    ]);

    const enriched = enrichPlayer(player);
    const custom = player._custom || {};
    const farmIds = Array.isArray(custom.farm_role_ids) ? custom.farm_role_ids : [];
    const farms = (await Promise.all(farmIds.map(id =>
      API.get(`/api/servers/${currentServer}/player/${id}?dataset=${Store.getDataset()}`).catch(() => null)
    ))).filter(Boolean).map(enrichPlayer);
    const initial = (player.name || '?')[0].toUpperCase();

    container.innerHTML = `
      <div class="player-header">
        <div class="player-avatar">${initial}</div>
        <div class="player-info">
          <h3>${player.name || t('unknown')}</h3>
          <div class="role-id-display">${t('role_id')}: ${player.role_id}</div>
        </div>
      </div>

      <div class="detail-grid">
        ${DETAIL_FIELDS.filter(f => enriched[f] !== undefined || f === 'mp_ratio').map(f => `
          <div class="detail-item">
            <div class="label">${fieldLabel(f)}</div>
            <div class="value">${renderDetailValue(f, enriched)}</div>
          </div>
        `).join('')}
        ${['deco', 'red_artifact', 'main', 'tier', 'note'].map(f => `
          <div class="detail-item">
            <div class="label">${fieldLabel(f)}</div>
            <div class="value">${renderDetailValue(f, player)}</div>
          </div>
        `).join('')}
      </div>

      ${renderCustomEditor(roleId, custom)}

      <h3 style="font-family:var(--font-display);margin:2rem 0 1rem">${t('farm_accounts')}</h3>
      ${farms.length ? `
        <div class="table-wrapper"><table>
          <thead><tr>${DEFAULT_COLUMNS.map(f => `<th>${fieldLabel(f)}</th>`).join('')}</tr></thead>
          <tbody>${farms.map(farm => `<tr>${DEFAULT_COLUMNS.map(f => `<td>${f === 'role_id' ? farm.role_id : renderDetailValue(f, farm)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
      ` : `<div class="alert alert-info">${t('no_farms')}</div>`}

      ${history.length > 1 ? `
        <h3 style="font-family:var(--font-display);margin-bottom:1rem;color:var(--text-secondary)">
          ${t('history').toUpperCase()} (${history.length} ${t('history_datasets')})
        </h3>
        ${renderCharts(history)}
      ` : history.length === 1 ? `
        <div class="alert alert-info">${t('history_one')}</div>
      ` : ''}
    `;

    if (history.length > 1) initCharts(history);

    const saveBtn = document.getElementById('save-custom-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const status = document.getElementById('save-status');
        try {
          await saveCustomData(currentServer, roleId, {
            deco: document.getElementById('custom-deco').value,
            red_artifact: document.getElementById('custom-red-artifact').checked,
            main: document.getElementById('custom-main').value,
            note: document.getElementById('custom-note').value,
            farm_role_ids: document.getElementById('custom-farm-ids').value.split(',').map(v => v.trim()).filter(Boolean),
          });
          status.innerHTML = `<span style="color:var(--success)">${t('saved')}</span>`;
          setTimeout(() => loadPlayer(roleId), 500);
        } catch (err) {
          status.innerHTML = `<span style="color:var(--danger)">${err.message}</span>`;
        }
      });
    }
  } catch (err) {
    showError(container, err.message);
  }
}

async function onServerChange(serverId) {
  currentServer = serverId;
  await initSidebar('player');
}

async function searchPlayers() {
  const query = document.getElementById('player-id-input').value.trim().toLowerCase();
  const results = document.getElementById('player-search-results');
  if (!query) return;
  showLoading(results);
  try {
    const dataset = await API.get(`/api/servers/${currentServer}/dataset/${Store.getDataset()}`);
    const matches = (dataset.players || []).filter(p =>
      String(p.role_id || '').includes(query) || String(p.name || '').toLowerCase().includes(query)
    ).slice(0, 20);
    const exact = matches.find(p => String(p.role_id) === query);
    if (exact) { results.innerHTML = ''; loadPlayer(exact.role_id); return; }
    results.innerHTML = matches.length ? `<div class="search-results-card">
      ${matches.map(p => `<button class="search-result" data-id="${p.role_id}"><strong>${p.name || '-'}</strong><span>${p.role_id}${p.migrated ? ' · Migrated' : ''}</span></button>`).join('')}
    </div>` : `<div class="alert alert-info">${t('no_data')}</div>`;
    results.querySelectorAll('.search-result').forEach(button => button.addEventListener('click', () => {
      document.getElementById('player-id-input').value = button.dataset.id;
      results.innerHTML = '';
      loadPlayer(button.dataset.id);
    }));
  } catch (err) { showError(results, err.message); }
}

document.getElementById('search-btn').addEventListener('click', searchPlayers);

document.getElementById('player-id-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchPlayers();
  }
});

(async () => {
  isAdmin = false;
  await initSidebar('player');
  document.querySelector('.page-header h2').textContent = t('player_detail');
  document.querySelector('.page-header .subtitle').textContent = t('player_subtitle');
  document.querySelector('.control-group label').textContent = t('search');
  document.getElementById('player-id-input').placeholder = t('search_placeholder');
  document.getElementById('search-btn').textContent = t('search_btn');
  await initServerSelector('server-selector', onServerChange);

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) {
    document.getElementById('player-id-input').value = id;
    loadPlayer(id);
  }
})();
