const REWARD_FIELDS = [
  'alliance_donation', 'build_time', 'destroy_time', 'resource_aid',
  'alliance_help', 'merit', 'deaths', 'healing', 'gathering', 'behemoth_wins'
];
let rewardDataset = Store.getDataset();
let rewardPlayers = [];

function setupRewardControls() {
  document.getElementById('criterion-label').textContent = t('reward_criterion');
  document.getElementById('farm-count-label').textContent = t('farm_count');
  document.getElementById('calculate-btn').textContent = t('calculate_top_100');
  document.getElementById('criterion').innerHTML = REWARD_FIELDS.map(f => `<option value="${f}">${fieldLabel(f)}</option>`).join('');
  document.getElementById('farm-count').innerHTML = Array.from({length: 11}, (_, i) => `<option value="${i}">${i}</option>`).join('');
}

function calculateRewards() {
  const field = document.getElementById('criterion').value;
  const farmCount = Number(document.getElementById('farm-count').value);
  const byId = new Map(rewardPlayers.map(p => [String(p.role_id), p]));
  const farmIdSet = new Set(rewardPlayers.flatMap(p => Array.isArray(p.farm_role_ids) ? p.farm_role_ids.map(String) : []));
  const mains = rewardPlayers.filter(p => !farmIdSet.has(String(p.role_id)));
  const rows = mains.map(main => {
    const linked = (Array.isArray(main.farm_role_ids) ? main.farm_role_ids : [])
      .map(id => byId.get(String(id))).filter(Boolean)
      .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0)).slice(0, farmCount);
    const score = (Number(main[field]) || 0) + linked.reduce((sum, p) => sum + (Number(p[field]) || 0), 0);
    return { main, linked, score };
  }).sort((a, b) => b.score - a.score).slice(0, 100);
  document.getElementById('rewards-content').innerHTML = `<div class="table-wrapper"><table>
    <thead><tr><th>${t('rank')}</th><th>${t('main_account')}</th><th>${t('role_id')}</th><th>${t('farm_accounts')}</th><th>${fieldLabel(field)}</th><th>${t('combined_score')}</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr><td class="number">${i + 1}</td><td class="name"><a class="account-link" href="/player.html?id=${encodeURIComponent(r.main.role_id)}">${r.main.name || '-'}</a></td><td class="number"><a class="account-link" href="/player.html?id=${encodeURIComponent(r.main.role_id)}">${r.main.role_id}</a></td><td>${r.linked.length ? r.linked.map(p => `<a class="account-link farm-account-link" href="/player.html?id=${encodeURIComponent(p.role_id)}">${p.name || p.role_id} (${formatNumber(p[field])})</a>`).join('') : '-'}</td><td class="number">${formatNumber(r.main[field])}</td><td class="number"><strong>${formatNumber(r.score)}</strong></td></tr>`).join('')}</tbody>
  </table></div>`;
}

async function loadRewardData() {
  if (!rewardDataset) return;
  const content = document.getElementById('rewards-content');
  showLoading(content);
  try {
    const data = await API.get(`/api/servers/819/dataset/${rewardDataset}`);
    rewardPlayers = data.players || [];
    document.getElementById('header-subtitle').textContent = `SERVER 819 | ${formatDateRange(data.date_from, data.date_to)}`;
    calculateRewards();
  } catch (err) { showError(content, err.message); }
}

(async () => {
  await initSidebar('rewards');
  document.querySelector('.page-header h2').textContent = t('nav_rewards');
  setupRewardControls();
  rewardDataset = await initDatasetSelector('dataset-selector', '819', key => { rewardDataset = key; loadRewardData(); });
  document.getElementById('calculate-btn').addEventListener('click', calculateRewards);
  loadRewardData();
})();
