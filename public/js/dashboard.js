document.getElementById('sidebar').innerHTML = renderSidebar('dashboard');

let currentServer = Store.getServer();
let currentDataset = Store.getDataset();

async function loadDashboard() {
  const content = document.getElementById('dashboard-content');
  const subtitle = document.getElementById('header-subtitle');

  if (!currentServer || !currentDataset) {
    showEmpty(content, t('dashboard_empty'));
    return;
  }

  showLoading(content);

  try {
    const data = await API.get(`/api/servers/${currentServer}/dashboard/${currentDataset}`);
    const s = data.stats;

    subtitle.innerHTML = `
      SERVER <strong>${data.server_id}</strong> &nbsp;|&nbsp;
      ${t('data_label')}: <span class="date-range">${formatDateRange(data.date_from, data.date_to)}</span>
    `;

    content.innerHTML = `
      <div class="tier-summary">
        <div class="tier-summary-header">
          <div>
            <h3>${t('tier_statistics')}</h3>
            <p>${t('tier_statistics_note')}</p>
          </div>
          <div class="eligible-total">${t('eligible_accounts')}: <strong>${(s.tier_counts?.eligible || 0).toLocaleString()}</strong></div>
        </div>
        <div class="tier-cards">
          <div class="stat-card stat-card-tier stat-card-t4"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('rank-support', 0)}</span><div class="label">${t('t4_accounts')}</div></div><div class="value">${(s.tier_counts?.t4 || 0).toLocaleString()}</div></div>
          <div class="stat-card stat-card-tier stat-card-t5"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('rank-support', 1)}</span><div class="label">${t('t5_accounts')}</div></div><div class="value">${(s.tier_counts?.t5 || 0).toLocaleString()}</div></div>
        </div>
      </div>
      <div class="stats-grid dashboard-stats-grid">
        <div class="stat-card stat-card-blue"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('nav', 2)}</span><div class="label">${t('total_players')}</div></div><div class="value">${s.total_players.toLocaleString()}</div></div>
        <div class="stat-card stat-card-indigo"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 0)}</span><div class="label">${t('total_power')}</div></div><div class="value">${formatNumber(s.total_power)}</div></div>
        <div class="stat-card stat-card-cyan"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('nav', 1)}</span><div class="label">${t('top_300_power')}</div></div><div class="value">${formatNumber(s.top_300_power)}</div></div>
        <div class="stat-card stat-card-violet"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 1)}</span><div class="label">${t('pairing_power')}</div></div><div class="value">${formatNumber(s.pairing_power)}</div></div>
        <div class="stat-card stat-card-teal"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('nav', 0)}</span><div class="label">${t('average_power')}</div></div><div class="value">${formatNumber(s.average_power)}</div></div>
        <div class="stat-card stat-card-amber"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 0)}</span><div class="label">${t('highest_power')}</div></div><div class="value">${formatNumber(s.highest_power)}</div></div>
        <div class="stat-card stat-card-red"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 2)}</span><div class="label">${t('total_deaths')}</div></div><div class="value">${formatNumber(s.total_deaths)}</div></div>
        <div class="stat-card stat-card-orange"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 1)}</span><div class="label">${t('total_merit')}</div></div><div class="value">${formatNumber(s.total_merit)}</div></div>
        <div class="stat-card stat-card-green"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('rank-support', 2)}</span><div class="label">${t('total_healing')}</div></div><div class="value">${formatNumber(s.total_healing)}</div></div>
        <div class="stat-card stat-card-lime"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('stat', 4)}</span><div class="label">${t('total_gathering')}</div></div><div class="value">${formatNumber(s.total_gathering)}</div></div>
        <div class="stat-card stat-card-rose"><div class="stat-card-head"><span class="stat-icon-frame">${renderIcon('rank-support', 3)}</span><div class="label">${t('red_artifact_count')}</div></div><div class="value">${(s.red_artifact_count || 0).toLocaleString()}</div></div>
      </div>
      <h3 style="margin:2rem 0 1rem;font-family:var(--font-display)">${t('power_distribution')}</h3>
      <div class="stats-grid">
        ${['power_0_20', 'power_20_40', 'power_40_60', 'power_60_80', 'power_80_100', 'power_over_100'].map(key => `
          <div class="stat-card distribution-card"><div class="label">${t(key)}</div><div class="value">${(s.power_buckets?.[key] || 0).toLocaleString()}</div></div>
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:1rem">
        <a href="/players.html" class="btn btn-primary">${t('view_rankings')} →</a>
      </div>
    `;
  } catch (err) {
    showError(content, err.message);
  }
}

async function onServerChange(serverId) {
  currentServer = serverId;
  await initSidebar('dashboard');
  currentDataset = await initDatasetSelector('dataset-selector', serverId, onDatasetChange);
  loadDashboard();
}

function onDatasetChange(datasetKey) {
  currentDataset = datasetKey;
  loadDashboard();
}

(async () => {
  await initSidebar('dashboard');
  document.querySelector('.page-header h2').textContent = t('dashboard');
  document.querySelector('.page-header .subtitle').textContent = t('dashboard_subtitle');
  await initServerSelector('server-selector', onServerChange);
  if (currentServer) {
    currentDataset = await initDatasetSelector('dataset-selector', currentServer, onDatasetChange);
    loadDashboard();
  }
})();
