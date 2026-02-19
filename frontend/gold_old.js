/**
 * Treasury System - Frontend Logic
 * Manages loot log, allocations, and wallets
 */

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

function currencyToCp(gp, sp, cp) {
  return (gp || 0) * 100 + (sp || 0) * 10 + (cp || 0);
}

function cpToCurrency(totalCp) {
  const gp = Math.floor(totalCp / 100);
  const remaining = totalCp % 100;
  const sp = Math.floor(remaining / 10);
  const cp = remaining % 10;
  return { gp, sp, cp };
}

function formatCp(totalCp) {
  const { gp, sp, cp } = cpToCurrency(totalCp);
  const parts = [];
  if (gp > 0) parts.push(`${gp} gp`);
  if (sp > 0) parts.push(`${sp} sp`);
  if (cp > 0) parts.push(`${cp} cp`);
  return parts.length > 0 ? parts.join(' ') : '0 cp';
}

function formatGpShort(totalCp) {
  const { gp } = cpToCurrency(totalCp);
  if (gp > 0) return `${gp} gp`;
  return cpToCurrency(totalCp).sp > 0 ? `${cpToCurrency(totalCp).sp} sp` : '0 cp';
}

// ============================================================================
// STATE
// ============================================================================

let treasuryState = {
  lootLog: [],
  wallets: {},
  players: [],
  accounts: [],
  categories: { loot: [] },
  settings: {},
  modal: {
    isOpen: false,
    currentStep: 1,
    lootTotalCp: 0,
    allocations: []
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', initializeTreasury);

async function initializeTreasury() {
  try {
    console.log('Loading treasury...');

    // Load categories and data in parallel
    await Promise.all([
      loadPlayers(),
      loadAccounts(),
      loadLootLogCategories(),
      loadLootLog(),
      loadWallets(),
      loadSettings()
    ]);

    // Setup event listeners
    setupEventListeners();

    // Render initial UI
    renderLootLog();
    renderWallets();
    populateLootCategorySelect();

    console.log('Treasury loaded successfully');
  } catch (err) {
    console.error('Failed to load treasury:', err);
    alert('Failed to load treasury. Check console.');
  }
}

async function loadPlayers() {
  const response = await fetch('/api/players');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.players = data.data.players;
}

async function loadAccounts() {
  const response = await fetch('/api/treasury/accounts');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.accounts = data.data.accounts;
}

async function loadLootLogCategories() {
  const response = await fetch('/api/treasury/categories');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.categories.loot = data.data.lootCategories;
}

async function loadLootLog() {
  const response = await fetch('/api/treasury/loot-log');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.lootLog = data.data.lootLog;
}

async function loadWallets() {
  const response = await fetch('/api/treasury/wallets');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.wallets = data.data.wallets;
}

async function loadSettings() {
  const response = await fetch('/api/treasury/settings');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.settings = data.data.settings;
}

// ============================================================================
// RENDERING & UI
// ============================================================================

function renderLootLog() {
  const body = document.getElementById('loot-log-body');
  const empty = document.getElementById('empty-loot-log');

  body.innerHTML = '';

  if (treasuryState.lootLog.length === 0) {
    body.parentElement.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  body.parentElement.style.display = 'table';
  empty.style.display = 'none';

  // Sort by date descending
  const sorted = [...treasuryState.lootLog].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(entry => {
    const date = new Date(entry.date).toLocaleDateString();
    const category = treasuryState.categories.loot.find(c => c.id === entry.category)?.name || entry.category;
    const total = formatCp(entry.totalCp);
    
    // Format allocations summary
    const allocSummary = entry.allocations
      .map(a => `${a.name}: ${formatCp(a.amountCp)}`)
      .join('; ');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date}</td>
      <td>${entry.description || '—'}</td>
      <td>${category}</td>
      <td class="amount-gold">${total}</td>
      <td class="allocation-summary">${allocSummary}</td>
      <td>${entry.session || '—'}</td>
      <td>
        <button class="action-btn" onclick="deleteLootEntry('${entry.id}')">Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
}

function renderWallets() {
  // Show Party Vault
  let partyElement = document.getElementById('wallet-party');
  if (partyElement) {
    const balance = treasuryState.wallets['party'] || 0;
    partyElement.textContent = formatGpShort(balance);
  }

  // Show Patron
  let patronElement = document.getElementById('wallet-patron');
  if (patronElement) {
    const balance = treasuryState.wallets['patron'] || 0;
    patronElement.textContent = formatGpShort(balance);
  }

  // Show player character wallets
  const playerWalletsContainer = document.getElementById('player-wallets-container');
  if (playerWalletsContainer) {
    playerWalletsContainer.innerHTML = '';
    
    treasuryState.players.forEach(player => {
      if (player.currentCharacter) {
        const accountId = `character:${player.currentCharacter.id}`;
        const balance = treasuryState.wallets[accountId] || 0;
        const displayName = `${player.name} — ${player.currentCharacter.name}`;
        
        const row = document.createElement('div');
        row.className = 'wallet-row';
        row.innerHTML = `
          <span class="wallet-name">${displayName}</span>
          <span class="wallet-balance">${formatGpShort(balance)}</span>
        `;
        playerWalletsContainer.appendChild(row);
      } else {
        const displayName = `${player.name} — (No current character)`;
        
        const row = document.createElement('div');
        row.className = 'wallet-row';
        row.innerHTML = `
          <span class="wallet-name">${displayName}</span>
          <span class="wallet-balance">0 cp</span>
        `;
        playerWalletsContainer.appendChild(row);
      }
    });
  }
}

function populateLootCategorySelect() {
  const select = document.getElementById('loot-category');
  select.innerHTML = treasuryState.categories.loot
    .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
    .join('');
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function setupTabNavigation() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Hide all, show selected
      document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

      const tabId = btn.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).style.display = 'block';
      btn.classList.add('active');
    });
  });
}

// ============================================================================
// MODAL: ADD LOOT
// ============================================================================

function openAddLootModal() {
  treasuryState.modal.isOpen = true;
  treasuryState.modal.currentStep = 1;
  treasuryState.modal.lootTotalCp = 0;
  treasuryState.modal.allocations = [];

  // Reset form
  document.getElementById('loot-gp').value = 0;
  document.getElementById('loot-sp').value = 0;
  document.getElementById('loot-cp').value = 0;
  document.getElementById('loot-description').value = '';
  document.getElementById('loot-session').value = '';

  // Show step 1
  document.getElementById('step-1-details').style.display = 'block';
  document.getElementById('step-2-allocation').style.display = 'none';
  document.getElementById('btn-next-step2').style.display = 'inline-block';
  document.getElementById('btn-confirm-loot').style.display = 'none';
  document.getElementById('btn-back-step1').style.display = 'none';

  document.getElementById('modal-add-loot').style.display = 'flex';
  updateLootDisplay();
}

function closeAddLootModal() {
  treasuryState.modal.isOpen = false;
  document.getElementById('modal-add-loot').style.display = 'none';
}

function updateLootDisplay() {
  const gp = Number(document.getElementById('loot-gp').value) || 0;
  const sp = Number(document.getElementById('loot-sp').value) || 0;
  const cp = Number(document.getElementById('loot-cp').value) || 0;

  treasuryState.modal.lootTotalCp = currencyToCp(gp, sp, cp);
  document.getElementById('total-amount-display').textContent = formatCp(treasuryState.modal.lootTotalCp);
}

function proceedToStep2() {
  if (treasuryState.modal.lootTotalCp <= 0) {
    alert('Please enter a loot amount greater than 0');
    return;
  }

  // Initialize allocations with all accounts (party, patron, characters)
  treasuryState.modal.allocations = treasuryState.accounts.map(account => ({
    accountId: account.id,
    name: account.displayName,
    amountCp: 0
  }));

  // Show step 2
  document.getElementById('step-1-details').style.display = 'none';
  document.getElementById('step-2-allocation').style.display = 'block';
  document.getElementById('btn-next-step2').style.display = 'none';
  document.getElementById('btn-confirm-loot').style.display = 'inline-block';
  document.getElementById('btn-back-step1').style.display = 'inline-block';

  treasuryState.modal.currentStep = 2;

  renderAllocationTable();
  updateAllocationCheck();
}

function backToStep1() {
  document.getElementById('step-2-allocation').style.display = 'none';
  document.getElementById('step-1-details').style.display = 'block';

  document.getElementById('btn-next-step2').style.display = 'inline-block';
  document.getElementById('btn-confirm-loot').style.display = 'none';
  document.getElementById('btn-back-step1').style.display = 'none';

  treasuryState.modal.currentStep = 1;
}

function renderAllocationTable() {
  const body = document.getElementById('allocation-body');
  body.innerHTML = '';

  treasuryState.modal.allocations.forEach((alloc, idx) => {
    const { gp, sp, cp } = cpToCurrency(alloc.amountCp);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${alloc.name}</td>
      <td><input type="number" min="0" class="alloc-gp" data-idx="${idx}" value="${gp}" onchange="updateAllocationAmount(${idx})" /></td>
      <td><input type="number" min="0" class="alloc-sp" data-idx="${idx}" value="${sp}" onchange="updateAllocationAmount(${idx})" /></td>
      <td><input type="number" min="0" class="alloc-cp" data-idx="${idx}" value="${cp}" onchange="updateAllocationAmount(${idx})" /></td>
      <td class="amount-gold" id="alloc-total-${idx}">${formatCp(alloc.amountCp)}</td>
    `;
    body.appendChild(row);
  });

  updateAllocationDisplay();
}

function updateAllocationAmount(idx) {
  const gp = Number(document.querySelector(`.alloc-gp[data-idx="${idx}"]`).value) || 0;
  const sp = Number(document.querySelector(`.alloc-sp[data-idx="${idx}"]`).value) || 0;
  const cp = Number(document.querySelector(`.alloc-cp[data-idx="${idx}"]`).value) || 0;

  const amountCp = currencyToCp(gp, sp, cp);
  treasuryState.modal.allocations[idx].amountCp = amountCp;

  document.getElementById(`alloc-total-${idx}`).textContent = formatCp(amountCp);
  updateAllocationCheck();
}

function updateAllocationDisplay() {
  treasuryState.modal.allocations.forEach((alloc, idx) => {
    document.getElementById(`alloc-total-${idx}`).textContent = formatCp(alloc.amountCp);
  });
}

function updateAllocationCheck() {
  const allocatedTotal = treasuryState.modal.allocations.reduce((sum, a) => sum + a.amountCp, 0);

  document.getElementById('alloc-loot-total').textContent = `${treasuryState.modal.lootTotalCp} cp`;
  document.getElementById('alloc-allocated-total').textContent = `${allocatedTotal} cp`;

  const statusEl = document.getElementById('alloc-match-status');
  const confirmBtn = document.getElementById('btn-confirm-loot');

  if (allocatedTotal === treasuryState.modal.lootTotalCp) {
    statusEl.textContent = '✓ Allocations match!';
    statusEl.className = 'status-good';
    confirmBtn.disabled = false;
  } else {
    statusEl.textContent = '❌ Allocations don\'t match';
    statusEl.className = 'status-bad';
    confirmBtn.disabled = true;
  }
}

async function confirmLootEntry() {
  try {
    const description = document.getElementById('loot-description').value || 'Loot';
    const category = document.getElementById('loot-category').value;
    const session = document.getElementById('loot-session').value ? Number(document.getElementById('loot-session').value) : null;

    const payload = {
      totalCp: treasuryState.modal.lootTotalCp,
      description,
      category,
      session,
      allocations: treasuryState.modal.allocations.filter(a => a.amountCp > 0)
    };

    console.log('Adding loot entry:', payload);

    const response = await fetch('/api/treasury/loot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    console.log('Loot entry added:', data);

    // Reload and refresh UI
    await loadLootLog();
    await loadWallets();
    renderLootLog();
    renderWallets();

    closeAddLootModal();
    alert('Loot entry added successfully!');
  } catch (err) {
    console.error('Error adding loot:', err);
    alert(`Failed to add loot: ${err.message}`);
  }
}

async function deleteLootEntry(lootId) {
  if (!confirm('Delete this loot entry?')) return;

  try {
    const response = await fetch(`/api/treasury/loot/${lootId}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.status !== 'success') throw new Error(data.message);

    // Reload and refresh
    await loadLootLog();
    await loadWallets();
    renderLootLog();
    renderWallets();

    console.log('Loot entry deleted:', lootId);
  } catch (err) {
    console.error('Error deleting loot:', err);
    alert(`Failed to delete loot: ${err.message}`);
  }
}

// ============================================================================
// SETTINGS
// ============================================================================

async function saveSettings() {
  try {
    const allocateToPatron = document.getElementById('setting-allocate-patron').checked;
    const patronPercentage = Number(document.getElementById('setting-patron-percent').value) || 10;

    const response = await fetch('/api/treasury/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocateToPatron,
        patronPercentage
      })
    });

    const data = await response.json();

    if (data.status !== 'success') throw new Error(data.message);

    treasuryState.settings = data.data.settings;
    alert('Settings saved!');
    console.log('Settings saved:', treasuryState.settings);
  } catch (err) {
    console.error('Error saving settings:', err);
    alert(`Failed to save settings: ${err.message}`);
  }
}

function syncSettingsUI() {
  document.getElementById('setting-allocate-patron').checked = treasuryState.settings.allocateToPatron;
  document.getElementById('setting-patron-percent').value = treasuryState.settings.patronPercentage;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Tab navigation
  setupTabNavigation();

  // Modal buttons
  document.getElementById('btn-add-loot').addEventListener('click', openAddLootModal);
  document.getElementById('modal-close-loot').addEventListener('click', closeAddLootModal);
  document.getElementById('btn-cancel-loot').addEventListener('click', closeAddLootModal);

  // Loot form
  document.getElementById('loot-gp').addEventListener('input', updateLootDisplay);
  document.getElementById('loot-sp').addEventListener('input', updateLootDisplay);
  document.getElementById('loot-cp').addEventListener('input', updateLootDisplay);

  // Step navigation
  document.getElementById('btn-next-step2').addEventListener('click', proceedToStep2);
  document.getElementById('btn-back-step1').addEventListener('click', backToStep1);
  document.getElementById('btn-confirm-loot').addEventListener('click', confirmLootEntry);

  // Settings
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // Close modal when clicking outside
  document.getElementById('modal-add-loot').addEventListener('click', (e) => {
    if (e.target.id === 'modal-add-loot') closeAddLootModal();
  });

  // Sync settings UI on load
  syncSettingsUI();

  console.log('Event listeners setup complete');
}

console.log('Treasury.js loaded');
