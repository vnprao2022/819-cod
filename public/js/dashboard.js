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
      <div class="stats-grid">
        <div class="stat-card"><div class="label">${t('total_players')}</div><div class="value gold">${s.total_players.toLocaleString()}</div></div>
        <div class="stat-card"><div class="label">${t('total_power')}</div><div class="value">${formatNumber(s.total_power)}</div></div>
        <div class="stat-card"><div class="label">${t('top_300_power')}</div><div class="value">${formatNumber(s.top_300_power)}</div></div>
        <div class="stat-card"><div class="label">${t('top_200_power')}</div><div class="value gold">${formatNumber(s.top_200_power)}</div></div>
        <div class="stat-card"><div class="label">${t('average_power')}</div><div class="value">${formatNumber(s.average_power)}</div></div>
        <div class="stat-card"><div class="label">${t('highest_power')}</div><div class="value gold">${formatNumber(s.highest_power)}</div></div>
        <div class="stat-card"><div class="label">${t('total_deaths')}</div><div class="value">${formatNumber(s.total_deaths)}</div></div>
        <div class="stat-card"><div class="label">${t('total_merit')}</div><div class="value">${formatNumber(s.total_merit)}</div></div>
        <div class="stat-card"><div class="label">${t('total_healing')}</div><div class="value">${formatNumber(s.total_healing)}</div></div>
        <div class="stat-card"><div class="label">${t('total_gathering')}</div><div class="value">${formatNumber(s.total_gathering)}</div></div>
      </div>
      <h3 style="margin:2rem 0 1rem;font-family:var(--font-display)">${t('power_distribution')}</h3>
      <div class="stats-grid">
        ${['power_0_20', 'power_20_40', 'power_40_60', 'power_60_80', 'power_80_100', 'power_over_100'].map(key => `
          <div class="stat-card"><div class="label">${t(key)}</div><div class="value">${(s.power_buckets?.[key] || 0).toLocaleString()}</div></div>
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
