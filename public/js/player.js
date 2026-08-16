let currentServer = Store.getServer();

const DETAIL_FIELDS = [
  'rank', 'power', 'highest_power', 'deaths', 'merit', 'mp_ratio', 'gathering',
  'healing', 'alliance_donation', 'build_time', 'destroy_time',
  'resource_aid', 'behemoth_wins', 'alliance_help',
  'merit_infantry', 'merit_cavalry', 'merit_archer', 'merit_mage', 'merit_other',
];

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
    const player = await API.get(`/api/servers/${currentServer}/player/${roleId}?dataset=${Store.getDataset()}`);

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

      <h3 style="font-family:var(--font-display);margin:2rem 0 1rem">${t('farm_accounts')}</h3>
      ${farms.length ? `
        <div class="table-wrapper"><table>
          <thead><tr>${DEFAULT_COLUMNS.map(f => `<th>${fieldLabel(f)}</th>`).join('')}</tr></thead>
          <tbody>${farms.map(farm => `<tr>${DEFAULT_COLUMNS.map(f => `<td>${f === 'role_id' ? farm.role_id : renderDetailValue(f, farm)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
      ` : `<div class="alert alert-info">${t('no_farms')}</div>`}

    `;

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
