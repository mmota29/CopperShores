const REPLACE_CONFIRMATION = 'REPLACE COPPER SHORES DATA';
const countLabels = {
  players: 'Players',
  characters: 'Characters',
  notes: 'Notes',
  mapWaypoints: 'Map Waypoints',
  treasuryTransactions: 'Treasury Transactions',
  contentEntries: 'Library Entries'
};

const adminState = {
  file: null,
  preview: null,
  safetyBackupDownloaded: false
};

const elements = {
  storageMode: document.getElementById('storage-mode'),
  currentCounts: document.getElementById('current-counts'),
  sourceCounts: document.getElementById('source-counts'),
  file: document.getElementById('backup-file'),
  validateButton: document.getElementById('validate-button'),
  previewPanel: document.getElementById('preview-panel'),
  backupMetadata: document.getElementById('backup-metadata'),
  exportMessage: document.getElementById('export-message'),
  importMessage: document.getElementById('import-message'),
  modeEmpty: document.getElementById('mode-empty'),
  modeReplace: document.getElementById('mode-replace'),
  replaceConfirmation: document.getElementById('replace-confirmation'),
  confirmationPhrase: document.getElementById('confirmation-phrase'),
  restoreButton: document.getElementById('restore-button')
};

function setMessage(element, text, type = '') {
  element.textContent = text;
  element.className = `admin-message${type ? ` ${type}` : ''}`;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({
    status: 'error',
    message: 'Server returned an invalid response.'
  }));
  if (response.status === 401) {
    window.location.replace('/admin/login/');
    throw new Error('Admin session expired.');
  }
  if (!response.ok || payload.status !== 'success') {
    const details = Array.isArray(payload.errors) && payload.errors.length
      ? ` ${payload.errors.slice(0, 8).join(' ')}`
      : '';
    throw new Error(`${payload.message || `Request failed (${response.status}).`}${details}`);
  }
  return payload.data;
}

function renderCounts(container, counts) {
  container.innerHTML = '';
  Object.entries(countLabels).forEach(([key, label]) => {
    const item = document.createElement('div');
    item.className = 'count-item';
    const value = document.createElement('strong');
    value.textContent = Number(counts && counts[key]) || 0;
    const caption = document.createElement('span');
    caption.textContent = label;
    item.append(value, caption);
    container.appendChild(item);
  });
}

async function loadStatus() {
  elements.storageMode.textContent = 'Loading storage information…';
  try {
    const data = await apiRequest('/api/admin/backups/status');
    elements.storageMode.textContent = `Active storage: ${data.storageMode}`;
    renderCounts(elements.currentCounts, data.counts);
  } catch (error) {
    elements.storageMode.textContent = error.message;
  }
}

function filenameFromDisposition(header) {
  const match = /filename="([^"]+)"/i.exec(header || '');
  return match ? match[1] : 'copper-shores-backup.json';
}

async function downloadBackup() {
  setMessage(elements.exportMessage, 'Creating backup…');
  try {
    const response = await fetch('/api/admin/backups/export');
    if (response.status === 401) {
      window.location.replace('/admin/login/');
      return;
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Export failed.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameFromDisposition(response.headers.get('content-disposition'));
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    adminState.safetyBackupDownloaded = true;
    setMessage(
      elements.exportMessage,
      'Backup downloaded. Store it outside Render and verify your browser saved it.',
      'success'
    );
  } catch (error) {
    setMessage(elements.exportMessage, error.message, 'error');
  }
}

function selectedMode() {
  return elements.modeReplace.checked ? 'replace' : 'empty';
}

function updateRestoreMode() {
  const replace = selectedMode() === 'replace';
  elements.replaceConfirmation.hidden = !replace;
  elements.restoreButton.textContent = replace
    ? 'Replace Data and Restore'
    : 'Restore Backup';
}

function renderPreview(preview) {
  const source = preview.source;
  elements.backupMetadata.innerHTML = '';
  const metadata = [
    ['Exported', source.exportedAt || 'Unknown'],
    ['Source storage', source.sourceStorage || 'Unknown'],
    ['Application version', source.applicationVersion || 'Unknown'],
    ['Checksum', source.checksum]
  ];
  metadata.forEach(([label, value]) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    elements.backupMetadata.append(term, detail);
  });
  renderCounts(elements.sourceCounts, source.counts);
  elements.previewPanel.hidden = false;
  elements.modeReplace.checked = preview.replaceRequired;
  elements.modeEmpty.checked = !preview.replaceRequired;
  updateRestoreMode();
}

async function validateSelectedFile() {
  if (!adminState.file) return;
  setMessage(elements.importMessage, 'Validating backup…');
  elements.validateButton.disabled = true;
  elements.previewPanel.hidden = true;
  try {
    const data = await apiRequest('/api/admin/backups/import?dryRun=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: adminState.file
    });
    adminState.preview = data;
    renderPreview(data);
    setMessage(elements.importMessage, 'Backup is valid. Review the preview before restoring.', 'success');
  } catch (error) {
    adminState.preview = null;
    setMessage(elements.importMessage, error.message, 'error');
  } finally {
    elements.validateButton.disabled = !adminState.file;
  }
}

async function restoreBackup() {
  if (!adminState.file || !adminState.preview) return;
  const mode = selectedMode();
  if (mode === 'replace') {
    if (!adminState.safetyBackupDownloaded) {
      setMessage(
        elements.importMessage,
        'Download a current backup before using replace mode.',
        'error'
      );
      return;
    }
    if (elements.confirmationPhrase.value !== REPLACE_CONFIRMATION) {
      setMessage(elements.importMessage, 'The replacement confirmation phrase does not match.', 'error');
      return;
    }
  }

  const question = mode === 'replace'
    ? 'Replace all current user-created data with this backup?'
    : 'Restore this backup into the empty database?';
  if (!window.confirm(question)) return;

  elements.restoreButton.disabled = true;
  setMessage(elements.importMessage, 'Restoring and verifying backup…');
  try {
    const headers = { 'Content-Type': 'application/octet-stream' };
    if (mode === 'replace') {
      headers['X-Restore-Confirmation'] = REPLACE_CONFIRMATION;
      headers['X-Safety-Backup-Downloaded'] = 'true';
    }
    const data = await apiRequest(`/api/admin/backups/import?mode=${mode}`, {
      method: 'POST',
      headers,
      body: adminState.file
    });
    setMessage(
      elements.importMessage,
      `Restore completed and verified (${data.checksum}).`,
      'success'
    );
    elements.previewPanel.hidden = true;
    adminState.preview = null;
    await loadStatus();
  } catch (error) {
    setMessage(elements.importMessage, error.message, 'error');
  } finally {
    elements.restoreButton.disabled = false;
  }
}

document.getElementById('refresh-status').addEventListener('click', loadStatus);
document.getElementById('export-button').addEventListener('click', downloadBackup);
document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('/api/admin/session', { method: 'DELETE' });
  window.location.replace('/admin/login/');
});
elements.file.addEventListener('change', () => {
  adminState.file = elements.file.files[0] || null;
  adminState.preview = null;
  elements.previewPanel.hidden = true;
  elements.validateButton.disabled = !adminState.file;
  setMessage(elements.importMessage, '');
});
elements.validateButton.addEventListener('click', validateSelectedFile);
elements.modeEmpty.addEventListener('change', updateRestoreMode);
elements.modeReplace.addEventListener('change', updateRestoreMode);
elements.restoreButton.addEventListener('click', restoreBackup);

loadStatus();
