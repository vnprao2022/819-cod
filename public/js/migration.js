function migrationCountdown(deadline) {
  if (!deadline) return { className: '', label: '-' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${deadline}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { className: 'overdue', label: t('migration_overdue', { days: Math.abs(days) }) };
  if (days === 0) return { className: 'due-today', label: t('migration_due_today') };
  return { className: days <= 7 ? 'due-soon' : '', label: t('migration_days_left', { days }) };
}

async function loadMigrationPage() {
  const content = document.getElementById('migration-content');
  document.getElementById('migration-title').textContent = t('migration_title');
  document.getElementById('migration-subtitle').textContent = t('migration_subtitle');
  showLoading(content);
  try {
    const data = await API.get(`/api/servers/${Store.getServer()}/migration`);
    await initSidebar('migration');
    if (!data.visible) {
      showEmpty(content, t('migration_hidden'));
      return;
    }
    const players = data.players || [];
    if (!players.length) {
      showEmpty(content, t('migration_empty'));
      return;
    }
    const countdown = migrationCountdown(data.deadline);
    content.innerHTML = `
      <section class="migration-overview ${countdown.className}">
        <div><span class="migration-overview-label">${t('migration_total')}</span><strong>${players.length}</strong><small>${t('players_count')}</small></div>
        <div><span class="migration-overview-label">${t('migration_deadline')}</span><strong>${formatDate(data.deadline) || '-'}</strong><small class="migration-countdown">${countdown.label}</small></div>
      </section>
      <div class="migration-warning">${t('migration_notice')}</div>
      <div class="migration-meta">${data.dataset ? formatDateRange(data.dataset.date_from, data.dataset.date_to) : ''}</div>
      <div class="migration-list">
        ${players.map(player => {
          return `<article class="migration-card ${countdown.className}">
            <div class="migration-card-main">
              <a href="/player.html?id=${encodeURIComponent(player.role_id)}"><strong>${escapeHtml(player.name || player.role_id)}</strong></a>
              <span class="role-id-display">${escapeHtml(player.role_id)} · ${formatNumber(player.power)}</span>
            </div>
            <dl>
              <div><dt>${t('migration_reason')}</dt><dd>${escapeHtml(player.reason || '-')}</dd></div>
            </dl>
          </article>`;
        }).join('')}
      </div>`;
  } catch (error) {
    showError(content, error.message);
  }
}

(async () => {
  await initSidebar('migration');
  await loadMigrationPage();
})();
