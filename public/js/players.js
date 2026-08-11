let currentServer = Store.getServer();
let currentDataset = Store.getDataset();
let allPlayers = [];
let filteredPlayers = [];
let sortCol = 'rank';
let sortDir = 'desc';
let currentPage = 1;
const PAGE_SIZE = 50;
let visibleColumns = Store.getColumns() || [...DEFAULT_COLUMNS];
let isAdmin = false;

function renderColumnPicker() {
  const allCols = [...new Set([...DEFAULT_COLUMNS, ...allPlayers.length ? Object.keys(allPlayers[0]) : []])];
  const dropdown = document.getElementById('column-dropdown');
  dropdown.innerHTML = allCols.map(col => `
    <label>
      <input type="checkbox" value="${col}" ${visibleColumns.includes(col) ? 'checked' : ''}>
      ${fieldLabel(col)}
    </label>
  `).join('');

  dropdown.querySelectorAll('input').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!visibleColumns.includes(cb.value)) visibleColumns.push(cb.value);
      } else {
        visibleColumns = visibleColumns.filter(c => c !== cb.value);
      }
      Store.setColumns(visibleColumns);
      renderTable();
    });
  });
}

function filterPlayers(query) {
  const q = query.toLowerCase().trim();
  const migration = document.getElementById('migration-filter')?.value || 'active';
  filteredPlayers = allPlayers.filter(p => {
    const id = String(p.role_id || '');
    const name = (p.name || '').toLowerCase();
    const matchesQuery = !q || id.includes(q) || name.includes(q);
    const matchesStatus = migration === 'all' || (migration === 'migrated' ? p.migrated : !p.migrated);
    return matchesQuery && matchesStatus;
  });
  const count = document.getElementById('account-count');
  if (count) count.textContent = filteredPlayers.length;
}

function sortPlayers(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = NUMERIC_FIELDS.has(col) ? 'desc' : 'asc';
  }

  applyCurrentSort();
}

function applyCurrentSort() {
  filteredPlayers.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (NUMERIC_FIELDS.has(sortCol)) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
    } else {
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}

function renderCell(col, p) {
  if (col === 'mp_ratio') return formatMP(p.merit, p.power);
  if (CUSTOM_FIELDS.includes(col)) return renderCustomCell(col, p, isAdmin);
  if (col === 'red_artifact') {
    const yes = p[col] === true || p[col] === 'true' || p[col] === 1;
    return `<span class="badge ${yes ? 'badge-yes' : 'badge-no'}">${yes ? t('yes') : t('no')}</span>`;
  }
  if (col === 'main') return getMainLabel(p[col]);
  if (NUMERIC_FIELDS.has(col)) return formatNumber(p[col]);
  return p[col] ?? '-';
}

function renderTable() {
  const container = document.getElementById('table-content');
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filteredPlayers.slice(start, start + PAGE_SIZE);
  const cols = visibleColumns;

  container.innerHTML = `
    ${isAdmin ? `<div class="alert alert-info" style="margin-bottom:1rem">${t('admin_logged_in')} — ${t('edit')} Deco / Artifact / Main trực tiếp trong bảng.</div>` : ''}
    <div class="table-wrapper">
      <table>
        <thead><tr>
          ${cols.map(col => `
            <th class="${sortCol === col ? 'sorted' : ''}" data-col="${col}">
              ${fieldLabel(col)}
              <span class="sort-icon">${sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
          `).join('')}
        </tr></thead>
        <tbody>
          ${page.map(p => `
            <tr>
              ${cols.map(col => {
                if (col === 'role_id') {
                  return `<td class="role-id number" onclick="location.href='/player.html?id=${p.role_id}'">${p.role_id}</td>`;
                }
                if (col === 'name') return `<td class="name" onclick="location.href='/player.html?id=${p.role_id}'" style="cursor:pointer">${p.name || '-'} ${p.migrated ? `<span class="badge badge-migrated">${t('migrated_players')}</span>` : ''}</td>`;
                const cls = NUMERIC_FIELDS.has(col) || col === 'mp_ratio' ? 'number' : '';
                const editable = isAdmin && CUSTOM_FIELDS.includes(col);
                return `<td class="${cls}${editable ? ' editable-cell' : ''}">${renderCell(col, p)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination">
        <div class="pagination-info">${t('showing')} ${start + 1}–${Math.min(start + PAGE_SIZE, filteredPlayers.length)} ${t('of')} ${filteredPlayers.length}</div>
        <div class="pagination-buttons">
          <button ${currentPage <= 1 ? 'disabled' : ''} onclick="goPage(${currentPage - 1})">← ${t('prev')}</button>
          ${Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p;
            if (totalPages <= 7) p = i + 1;
            else if (currentPage <= 4) p = i + 1;
            else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
            else p = currentPage - 3 + i;
            return `<button class="${p === currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
          }).join('')}
          <button ${currentPage >= totalPages ? 'disabled' : ''} onclick="goPage(${currentPage + 1})">${t('next')} →</button>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      sortPlayers(th.dataset.col);
      currentPage = 1;
      renderTable();
    });
  });

  if (isAdmin) bindInlineEdits(currentServer, (roleId, field, value) => {
    const p = allPlayers.find(x => String(x.role_id) === String(roleId));
    if (p) p[field] = value;
  });
}

window.goPage = (p) => { currentPage = p; renderTable(); };

async function loadPlayers() {
  const container = document.getElementById('table-content');
  const subtitle = document.getElementById('header-subtitle');

  if (!currentServer || !currentDataset) {
    showEmpty(container, t('select_server_dataset'));
    return;
  }

  showLoading(container);

  try {
    const data = await API.get(`/api/servers/${currentServer}/dataset/${currentDataset}`);
    allPlayers = (data.players || []).map(enrichPlayer);
    filterPlayers(document.getElementById('search-input').value);
    sortPlayers(sortCol);

    subtitle.innerHTML = `
      SERVER <strong>${data.server_id}</strong> &nbsp;|&nbsp;
      <span class="date-range">${formatDateRange(data.date_from, data.date_to)}</span>
      &nbsp;|&nbsp; <span id="account-count">${filteredPlayers.length}</span> ${t('players_count')}
    `;

    renderColumnPicker();
    renderTable();
  } catch (err) {
    showError(container, err.message);
  }
}

async function onServerChange(serverId) {
  currentServer = serverId;
  await initSidebar('players');
  currentDataset = await initDatasetSelector('dataset-selector', serverId, onDatasetChange);
  loadPlayers();
}

function onDatasetChange(datasetKey) {
  currentDataset = datasetKey;
  currentPage = 1;
  loadPlayers();
}

document.getElementById('search-input').addEventListener('input', (e) => {
  filterPlayers(e.target.value);
  currentPage = 1;
  applyCurrentSort();
  renderTable();
});
document.getElementById('migration-filter').addEventListener('change', () => {
  filterPlayers(document.getElementById('search-input').value);
  currentPage = 1;
  applyCurrentSort();
  renderTable();
});

document.getElementById('column-toggle').addEventListener('click', () => {
  document.getElementById('column-dropdown').classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.column-picker')) {
    document.getElementById('column-dropdown').classList.remove('open');
  }
});

(async () => {
  isAdmin = await API.checkAdmin();
  await initSidebar('players');
  document.querySelector('.page-header h2').textContent = t('player_rankings');
  document.querySelector('label[for="search-input"], .control-group label').textContent;
  document.querySelector('#controls .control-group label').textContent = t('search');
  document.getElementById('search-input').placeholder = t('search_placeholder');
  document.getElementById('column-toggle').textContent = t('columns') + ' ▾';
  document.getElementById('migration-filter-label').textContent = t('status');
  document.querySelector('#migration-filter option[value="all"]').textContent = t('all_players');
  document.querySelector('#migration-filter option[value="active"]').textContent = t('active_players');
  document.querySelector('#migration-filter option[value="migrated"]').textContent = t('migrated_players');
  await initServerSelector('server-selector', onServerChange);
  if (currentServer) {
    currentDataset = await initDatasetSelector('dataset-selector', currentServer, onDatasetChange);
    loadPlayers();
  }
})();
