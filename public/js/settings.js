document.getElementById('sidebar').innerHTML = renderSidebar('settings');

let currentServer = Store.getServer();

async function loadSettings() {
  const info = document.getElementById('server-info');
  if (!currentServer) {
    info.innerHTML = '<div class="empty-state"><div class="icon">⚙️</div><p>Select a server to view details.</p></div>';
    return;
  }

  showLoading(info);

  try {
    const [datasets, custom] = await Promise.all([
      API.get(`/api/servers/${currentServer}/datasets`),
      API.get(`/api/servers/${currentServer}/custom`),
    ]);

    const customCount = Object.keys(custom).length;

    info.innerHTML = `
      <div class="stats-grid" style="margin-bottom:2rem">
        <div class="stat-card">
          <div class="label">Server</div>
          <div class="value gold">${currentServer}</div>
        </div>
        <div class="stat-card">
          <div class="label">Datasets</div>
          <div class="value">${datasets.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Custom Entries</div>
          <div class="value">${customCount}</div>
        </div>
      </div>

      <div class="preview-card">
        <h4>Datasets</h4>
        ${datasets.length ? `
          <div class="table-wrapper">
            <table>
              <thead><tr>
                <th>Period</th><th>Source File</th><th>Players</th>
              </tr></thead>
              <tbody>
                ${datasets.map(d => `
                  <tr>
                    <td>${formatDateRange(d.date_from, d.date_to)}</td>
                    <td>${d.source_file}</td>
                    <td class="number">${d.player_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:var(--text-muted)">No datasets imported yet.</p>'}
      </div>

      <div class="preview-card" style="margin-top:1.5rem">
        <h4>Data Storage</h4>
        <div class="preview-row"><span class="key">Datasets path</span><span class="val">public/data/datasets/${currentServer}/</span></div>
        <div class="preview-row"><span class="key">Custom data path</span><span class="val">public/data/custom/${currentServer}.json</span></div>
      </div>
    `;
  } catch (err) {
    showError(info, err.message);
  }
}

async function onServerChange(serverId) {
  currentServer = serverId;
  document.getElementById('sidebar').innerHTML = renderSidebar('settings');
  loadSettings();
}

(async () => {
  await initServerSelector('server-selector', onServerChange);
  loadSettings();
})();
