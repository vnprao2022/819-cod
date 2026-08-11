document.getElementById('sidebar').innerHTML = renderSidebar('import');

let selectedFile = null;
let previewData = null;

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const content = document.getElementById('import-content');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.name.endsWith('.xlsx')) {
    content.innerHTML = '<div class="alert alert-danger">Please upload a .xlsx file.</div>';
    return;
  }
  selectedFile = file;
  previewImport();
}

async function previewImport() {
  content.innerHTML = '<div class="loading"><div class="spinner"></div>Analyzing file...</div>';

  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    previewData = await API.upload('/api/import/preview', formData);
    renderPreview();
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function renderPreview() {
  const d = previewData;
  let alerts = '';

  if (d.dataset_exists) {
    alerts += `<div class="alert alert-warning">⚠ Dataset already exists. Importing will require confirmation to overwrite.</div>`;
  }
  if (d.duplicate_role_ids && d.duplicate_role_ids.length) {
    alerts += `<div class="alert alert-warning">⚠ Duplicate role_ids found: ${d.duplicate_role_ids.slice(0, 5).join(', ')}${d.duplicate_role_ids.length > 5 ? '...' : ''}</div>`;
  }
  if (d.warnings && d.warnings.length) {
    alerts += `<div class="alert alert-info">${d.warnings.slice(0, 3).join('<br>')}</div>`;
  }

  content.innerHTML = `
    ${alerts}
    <div class="preview-card">
      <h4>Import Preview</h4>
      <div class="preview-row"><span class="key">File</span><span class="val">${d.filename}</span></div>
      <div class="preview-row"><span class="key">Server</span><span class="val">${d.server_id}</span></div>
      <div class="preview-row"><span class="key">Date</span><span class="val">${formatDateRange(d.date_from, d.date_to)}</span></div>
      <div class="preview-row"><span class="key">Players</span><span class="val">${d.player_count}</span></div>
      <div class="preview-row"><span class="key">Columns</span><span class="val">${Object.keys(d.column_map).length}</span></div>
    </div>

    ${d.preview_players && d.preview_players.length ? `
      <div class="preview-card">
        <h4>Sample Players</h4>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>Rank</th><th>ID</th><th>Name</th><th>Power</th><th>Merit</th>
            </tr></thead>
            <tbody>
              ${d.preview_players.map(p => `
                <tr>
                  <td>${p.rank}</td>
                  <td class="role-id">${p.role_id}</td>
                  <td>${p.name}</td>
                  <td class="number">${formatNumber(p.power)}</td>
                  <td class="number">${formatNumber(p.merit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div style="display:flex;gap:0.75rem">
      <button class="btn btn-primary" id="confirm-import">Import</button>
      <button class="btn btn-secondary" id="cancel-import">Cancel</button>
    </div>
  `;

  document.getElementById('confirm-import').addEventListener('click', confirmImport);
  document.getElementById('cancel-import').addEventListener('click', () => {
    selectedFile = null;
    previewData = null;
    content.innerHTML = '';
    fileInput.value = '';
  });
}

async function confirmImport() {
  const btn = document.getElementById('confirm-import');
  btn.disabled = true;
  btn.textContent = 'Importing...';

  const formData = new FormData();
  formData.append('file', selectedFile);
  if (previewData.dataset_exists) {
    formData.append('overwrite', 'true');
  }

  try {
    const result = await API.upload('/api/import/confirm', formData);
    content.innerHTML = `
      <div class="alert alert-success">
        ✓ Successfully imported ${result.player_count} players for Server ${result.server_id}
        (${result.dataset_key})
      </div>
      <div style="margin-top:1rem;display:flex;gap:0.75rem">
        <a href="/" class="btn btn-primary">Go to Dashboard</a>
        <a href="/players.html" class="btn btn-secondary">View Rankings</a>
      </div>
    `;
    Store.setServer(result.server_id);
    Store.setDataset(result.dataset_key);
    selectedFile = null;
    previewData = null;
  } catch (err) {
    if (err.message.includes('already exists')) {
      content.innerHTML += `<div class="alert alert-danger">${err.message} Click Import again to overwrite.</div>`;
      previewData.dataset_exists = true;
      btn.disabled = false;
      btn.textContent = 'Import (Overwrite)';
    } else {
      content.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  }
}
