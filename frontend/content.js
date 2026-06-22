const CONTENT_API_BASE = `${API_BASE_URL}/content`;
const ADMIN_TOKEN_KEY = 'copperShoresAdminToken';

const contentState = {
  entries: [],
  selectedId: null,
  editingId: null,
  contentTypes: {},
  adminWriteRequired: false
};

document.addEventListener('DOMContentLoaded', initContentPage);

async function initContentPage() {
  setupContentEvents();
  loadStoredAdminToken();
  await loadContentConfig();
  populateTypeControls();
  await loadContentEntries();
}

function setupContentEvents() {
  document.getElementById('add-entry-btn').addEventListener('click', () => openEntryModal());
  document.getElementById('cancel-entry').addEventListener('click', closeEntryModal);
  document.getElementById('entry-modal-overlay').addEventListener('click', closeEntryModal);
  document.getElementById('save-entry').addEventListener('click', saveEntry);
  document.getElementById('type-filter').addEventListener('change', loadContentEntries);
  document.getElementById('search-content').addEventListener('input', debounce(loadContentEntries, 220));
  document.getElementById('save-admin-token').addEventListener('click', saveAdminToken);
  document.getElementById('clear-admin-token').addEventListener('click', clearAdminToken);
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function loadStoredAdminToken() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  document.getElementById('admin-token-input').value = token;
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function saveAdminToken() {
  const token = document.getElementById('admin-token-input').value.trim();
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    showContentMessage('Admin token saved.');
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    showContentMessage('Admin token cleared.');
  }
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  document.getElementById('admin-token-input').value = '';
  showContentMessage('Admin token cleared.');
}

async function contentRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const method = (options.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    const token = getAdminToken();
    if (token) headers['X-Admin-Token'] = token;
  }

  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({
    status: 'error',
    message: 'Invalid JSON response'
  }));

  if (!response.ok || payload.status !== 'success') {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }

  return payload.data;
}

async function loadContentConfig() {
  try {
    const data = await contentRequest(`${API_BASE_URL}/config`);
    contentState.contentTypes = data.contentTypes || {};
    contentState.adminWriteRequired = Boolean(data.adminWriteRequired);
    const panel = document.getElementById('admin-token-panel');
    panel.style.display = contentState.adminWriteRequired || getAdminToken() ? 'grid' : 'none';
  } catch (err) {
    const types = await contentRequest(`${CONTENT_API_BASE}/types`);
    contentState.contentTypes = types || {};
  }
}

function populateTypeControls() {
  const filter = document.getElementById('type-filter');
  const entryType = document.getElementById('entry-type');
  filter.innerHTML = '';
  entryType.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All Types';
  filter.appendChild(allOption);

  Object.entries(contentState.contentTypes).forEach(([value, label]) => {
    const filterOption = document.createElement('option');
    filterOption.value = value;
    filterOption.textContent = label;
    filter.appendChild(filterOption);

    const formOption = document.createElement('option');
    formOption.value = value;
    formOption.textContent = label;
    entryType.appendChild(formOption);
  });
}

async function loadContentEntries() {
  try {
    const params = new URLSearchParams();
    const type = document.getElementById('type-filter').value;
    const q = document.getElementById('search-content').value.trim();
    if (type) params.set('type', type);
    if (q) params.set('q', q);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const data = await contentRequest(`${CONTENT_API_BASE}${suffix}`);
    contentState.entries = data.entries || [];
    renderContentList();

    if (contentState.selectedId) {
      const selected = contentState.entries.find(entry => entry.id === contentState.selectedId);
      renderContentDetail(selected || null);
    }
  } catch (err) {
    showContentMessage(err.message, true);
  }
}

function renderContentList() {
  const list = document.getElementById('content-list');
  list.innerHTML = '';

  if (!contentState.entries.length) {
    const empty = document.createElement('p');
    empty.className = 'players-empty';
    empty.textContent = 'No entries yet. Add one to start the library.';
    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  contentState.entries.forEach(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'content-list-item';
    if (entry.id === contentState.selectedId) button.classList.add('active');
    button.addEventListener('click', () => {
      contentState.selectedId = entry.id;
      renderContentList();
      renderContentDetail(entry);
    });

    const title = document.createElement('strong');
    title.textContent = entry.title;

    const meta = document.createElement('span');
    meta.textContent = contentState.contentTypes[entry.type] || entry.type;

    const summary = document.createElement('span');
    summary.className = 'content-list-summary';
    summary.textContent = entry.summary || truncateContent(entry.content, 110) || 'No summary yet.';

    button.appendChild(title);
    button.appendChild(meta);
    button.appendChild(summary);
    fragment.appendChild(button);
  });

  list.appendChild(fragment);
}

function renderContentDetail(entry) {
  const detail = document.getElementById('content-detail');
  detail.innerHTML = '';

  if (!entry) {
    const empty = document.createElement('p');
    empty.className = 'players-empty';
    empty.textContent = 'Select an entry to inspect it.';
    detail.appendChild(empty);
    return;
  }

  const header = document.createElement('div');
  header.className = 'content-detail-header';

  const title = document.createElement('h2');
  title.textContent = entry.title;

  const badge = document.createElement('span');
  badge.className = 'content-type-badge';
  badge.textContent = contentState.contentTypes[entry.type] || entry.type;

  header.appendChild(title);
  header.appendChild(badge);

  const body = document.createElement('p');
  body.className = 'content-body';
  body.textContent = entry.content || entry.summary || 'No content yet.';

  detail.appendChild(header);

  if (entry.summary) {
    const summary = document.createElement('p');
    summary.className = 'content-summary';
    summary.textContent = entry.summary;
    detail.appendChild(summary);
  }

  detail.appendChild(body);

  if (entry.tags && entry.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'content-tags';
    entry.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.textContent = tag;
      tags.appendChild(chip);
    });
    detail.appendChild(tags);
  }

  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  if (Object.keys(details).length) {
    const detailsBlock = document.createElement('dl');
    detailsBlock.className = 'content-details-list';
    Object.entries(details).forEach(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = Array.isArray(value) ? value.join(', ') : String(value);
      detailsBlock.appendChild(dt);
      detailsBlock.appendChild(dd);
    });
    detail.appendChild(detailsBlock);
  }

  const meta = document.createElement('p');
  meta.className = 'meta-text';
  const updated = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'Unknown';
  const creator = entry.createdByName ? `Added by ${entry.createdByName}. ` : '';
  meta.textContent = `${creator}Updated ${updated}.`;
  detail.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'button-row';

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn';
  edit.textContent = 'Edit';
  edit.addEventListener('click', () => openEntryModal(entry));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn-danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteEntry(entry.id));

  actions.appendChild(edit);
  actions.appendChild(remove);
  detail.appendChild(actions);
}

function openEntryModal(entry = null) {
  contentState.editingId = entry ? entry.id : null;
  document.getElementById('entry-modal-title').textContent = entry ? 'Edit Entry' : 'Add Entry';
  document.getElementById('entry-type').value = entry ? entry.type : 'note';
  document.getElementById('entry-title').value = entry ? entry.title : '';
  document.getElementById('entry-summary').value = entry ? entry.summary || '' : '';
  document.getElementById('entry-content').value = entry ? entry.content || '' : '';
  document.getElementById('entry-tags').value = entry && entry.tags ? entry.tags.join(', ') : '';
  document.getElementById('entry-created-by').value = entry ? entry.createdByName || '' : '';
  document.getElementById('entry-details').value = entry && entry.details
    ? JSON.stringify(entry.details, null, 2)
    : '';
  document.getElementById('entry-modal').style.display = 'block';
  document.getElementById('entry-modal-overlay').style.display = 'block';
  document.getElementById('entry-title').focus();
}

function closeEntryModal() {
  contentState.editingId = null;
  document.getElementById('entry-modal').style.display = 'none';
  document.getElementById('entry-modal-overlay').style.display = 'none';
}

async function saveEntry() {
  const title = document.getElementById('entry-title').value.trim();
  if (!title) {
    showContentMessage('Title is required.', true);
    return;
  }

  let details = {};
  const detailsRaw = document.getElementById('entry-details').value.trim();
  if (detailsRaw) {
    try {
      details = JSON.parse(detailsRaw);
    } catch (err) {
      showContentMessage('Details JSON is not valid.', true);
      return;
    }
  }

  const payload = {
    type: document.getElementById('entry-type').value,
    title,
    summary: document.getElementById('entry-summary').value,
    content: document.getElementById('entry-content').value,
    tags: document.getElementById('entry-tags').value,
    createdByName: document.getElementById('entry-created-by').value,
    details
  };

  try {
    const editingId = contentState.editingId;
    const saved = editingId
      ? await contentRequest(`${CONTENT_API_BASE}/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      : await contentRequest(CONTENT_API_BASE, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

    contentState.selectedId = saved.id;
    closeEntryModal();
    await loadContentEntries();
    renderContentDetail(saved);
    showContentMessage(editingId ? 'Entry updated.' : 'Entry added.');
  } catch (err) {
    showContentMessage(err.message, true);
  }
}

async function deleteEntry(id) {
  if (!id || !confirm('Delete this entry permanently?')) return;

  try {
    await contentRequest(`${CONTENT_API_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    contentState.selectedId = null;
    await loadContentEntries();
    renderContentDetail(null);
    showContentMessage('Entry deleted.');
  } catch (err) {
    showContentMessage(err.message, true);
  }
}

function showContentMessage(msg, isError = false) {
  const el = document.getElementById('message');
  el.textContent = '';
  const p = document.createElement('p');
  p.className = `status-message ${isError ? 'error' : 'success'}`;
  p.textContent = msg;
  el.appendChild(p);
  if (!isError) setTimeout(() => { el.textContent = ''; }, 4000);
}

function truncateContent(text, limit) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;
}
