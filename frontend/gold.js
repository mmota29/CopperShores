/**
 * Treasury System - Frontend Logic (Enhanced)
 * Complete gold, treasure, and spending management
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
  const { gp, sp, cp } = cpToCurrency(totalCp);
  if (gp > 0) return `${gp} gp`;
  if (sp > 0) return `${sp} sp`;
  return `${cp} cp`;
}

// ============================================================================
// STATE
// ============================================================================

let treasuryState = {
  lootLog: [],
  spendingLog: [],
  wallets: {},
  players: [],
  accounts: [],
  categories: { 
    loot: [], 
    spending: [] 
  },
  settings: {},
  modalLoot: {
    isOpen: false,
    currentStep: 1,
    lootTotalCp: 0,
    allocations: []
  },
  modalSpending: {
    isOpen: false,
    accountId: '',
    amountCp: 0
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', initializeTreasury);

async function initializeTreasury() {
  try {
    console.log('Loading treasury...');

    // Load all data in parallel
    await Promise.all([
      loadPlayers(),
      loadAccounts(),
      loadCategories(),
      loadLootLog(),
      loadSpendingLog(),
      loadWallets(),
      loadSettings()
    ]);

    // Setup event listeners
    setupEventListeners();

    // Render initial UI
    renderQuickStats();
    renderWallets();
    renderLootLog();
    renderSpendingLog();
    populateLootCategorySelect();
    populateSpendingFilters();

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

async function loadCategories() {
  const response = await fetch('/api/treasury/categories');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.categories.loot = data.data.lootCategories;
  treasuryState.categories.spending = data.data.spendingCategories;
}

async function loadLootLog() {
  const response = await fetch('/api/treasury/loot-log');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.lootLog = data.data.lootLog;
}

async function loadSpendingLog() {
  const response = await fetch('/api/treasury/spending-log');
  const data = await response.json();
  if (data.status !== 'success') throw new Error(data.message);
  treasuryState.spendingLog = data.data.spendingLog;
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
  
  // Update patron percentage button text
  const patronPct = treasuryState.settings.patronPercentage || 10;
  const patronBtn = document.getElementById('quick-patron-pct');
  if (patronBtn) {
    patronBtn.textContent = `Patron ${patronPct}%`;
  }
}

// ============================================================================
// RENDERING & UI
// ============================================================================

function renderQuickStats() {
  // Calculate total party funds
  const partyTotal = (treasuryState.wallets['party'] || 0) + (treasuryState.wallets['patron'] || 0);
  document.getElementById('stat-party').textContent = formatGpShort(partyTotal);

  // Calculate total individual character funds
  let individualTotal = 0;
  treasuryState.accounts.forEach(account => {
    if (account.id.startsWith('character:')) {
      individualTotal += treasuryState.wallets[account.id] || 0;
    }
  });
  document.getElementById('stat-individual').textContent = formatGpShort(individualTotal);

  // Calculate spending this session
  // For now, sum all spending (could be filtered by session later)
  const totalSpent = treasuryState.spendingLog.reduce((sum, entry) => sum + entry.amountCp, 0);
  document.getElementById('stat-spent').textContent = formatGpShort(totalSpent);
}

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
    
    // Format allocations summary (top 2)
    const topAllocations = entry.allocations.slice(0, 2)
      .map(a => `${a.name}: ${formatGpShort(a.amountCp)}`)
      .join(', ');
    const moreCount = entry.allocations.length > 2 ? ` (+ ${entry.allocations.length - 2} more)` : '';
    const allocSummary = topAllocations + moreCount;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date}</td>
      <td>${entry.description || '—'}</td>
      <td>${category}</td>
      <td class="amount-gold">${total}</td>
      <td>${allocSummary}</td>
      <td>${entry.session || '—'}</td>
      <td>
        <button class="action-btn delete-btn" onclick="deleteLootEntry('${entry.id}')">✕ Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
}

function renderSpendingLog() {
  const body = document.getElementById('spending-log-body');
  const empty = document.getElementById('empty-spending-log');

  body.innerHTML = '';

  let filtered = treasuryState.spendingLog;

  // Apply filters
  const accountFilter = document.getElementById('spending-filter-account')?.value || '';
  const categoryFilter = document.getElementById('spending-filter-category')?.value || '';

  if (accountFilter) {
    filtered = filtered.filter(s => s.accountId === accountFilter);
  }
  if (categoryFilter) {
    filtered = filtered.filter(s => s.category === categoryFilter);
  }

  if (filtered.length === 0) {
    body.parentElement.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  body.parentElement.style.display = 'table';
  empty.style.display = 'none';

  // Sort by date descending
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(entry => {
    const date = new Date(entry.date).toLocaleDateString();
    const account = treasuryState.accounts.find(a => a.id === entry.accountId);
    const accountName = account?.displayName || entry.accountId;
    const category = treasuryState.categories.spending.find(c => c.id === entry.category)?.name || entry.category;
    const amount = formatCp(entry.amountCp);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${date}</td>
      <td>${accountName}</td>
      <td>${entry.description || '—'}</td>
      <td>${category}</td>
      <td class="amount-warning">${amount}</td>
      <td>
        <button class="action-btn delete-btn" onclick="deleteSpendingEntry('${entry.id}')">✕ Delete</button>
      </td>
    `;
    body.appendChild(row);
  });
}

function renderWallets() {
  // Show Party Vault and Patron
  document.getElementById('wallet-party').textContent = formatGpShort(treasuryState.wallets['party'] || 0);
  document.getElementById('wallet-patron').textContent = formatGpShort(treasuryState.wallets['patron'] || 0);

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

function populateSpendingFilters() {
  const accountSelect = document.getElementById('spending-filter-account');
  accountSelect.innerHTML = '<option value="">All Accounts</option>';
  treasuryState.accounts.forEach(account => {
    const opt = document.createElement('option');
    opt.value = account.id;
    opt.textContent = account.displayName;
    accountSelect.appendChild(opt);
  });

  const categorySelect = document.getElementById('spending-filter-category');
  categorySelect.innerHTML = '<option value="">All Categories</option>';
  treasuryState.categories.spending.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

function populateSpendingAccountSelect() {
  const select = document.getElementById('spending-account');
  select.innerHTML = '';
  treasuryState.accounts.forEach(account => {
    const opt = document.createElement('option');
    opt.value = account.id;
    opt.textContent = account.displayName;
    select.appendChild(opt);
  });
  select.value = treasuryState.accounts[0]?.id || '';
}

function populateSpendingCategorySelect() {
  const select = document.getElementById('spending-category');
  select.innerHTML = treasuryState.categories.spending
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
      const tabElement = document.getElementById(`tab-${tabId}`);
      if (tabElement) {
        tabElement.style.display = 'block';
      }
      btn.classList.add('active');
    });
  });
}

// ============================================================================
// MODAL: ADD LOOT
// ============================================================================

function openAddLootModal() {
  treasuryState.modalLoot.isOpen = true;
  treasuryState.modalLoot.currentStep = 1;
  treasuryState.modalLoot.lootTotalCp = 0;
  treasuryState.modalLoot.allocations = [];

  // Reset form
  document.getElementById('loot-gp').value = 0;
  document.getElementById('loot-sp').value = 0;
  document.getElementById('loot-cp').value = 0;
  document.getElementById('loot-description').value = '';
  document.getElementById('loot-session').value = '';

  // Show step 1
  document.getElementById('step-1-details').classList.add('active');
  document.getElementById('step-2-allocation').classList.remove('active');
  document.getElementById('btn-next-step2').style.display = 'inline-block';
  document.getElementById('btn-confirm-loot').style.display = 'none';
  document.getElementById('btn-back-step1').style.display = 'none';

  document.getElementById('modal-add-loot').style.display = 'flex';
  updateLootDisplay();
}

function closeAddLootModal() {
  treasuryState.modalLoot.isOpen = false;
  document.getElementById('modal-add-loot').style.display = 'none';
}

function updateLootDisplay() {
  const gp = Number(document.getElementById('loot-gp').value) || 0;
  const sp = Number(document.getElementById('loot-sp').value) || 0;
  const cp = Number(document.getElementById('loot-cp').value) || 0;

  treasuryState.modalLoot.lootTotalCp = currencyToCp(gp, sp, cp);
  document.getElementById('total-amount-display').textContent = formatCp(treasuryState.modalLoot.lootTotalCp);
}

function proceedToStep2() {
  if (treasuryState.modalLoot.lootTotalCp <= 0) {
    alert('Please enter a loot amount greater than 0');
    return;
  }

  // Initialize allocations with all accounts
  treasuryState.modalLoot.allocations = treasuryState.accounts.map(account => ({
    accountId: account.id,
    name: account.displayName,
    amountCp: 0
  }));

  // Show step 2
  document.getElementById('step-1-details').classList.remove('active');
  document.getElementById('step-2-allocation').classList.add('active');
  document.getElementById('btn-next-step2').style.display = 'none';
  document.getElementById('btn-confirm-loot').style.display = 'inline-block';
  document.getElementById('btn-back-step1').style.display = 'inline-block';

  treasuryState.modalLoot.currentStep = 2;

  // Update patron percentage button with current setting
  const patronPct = treasuryState.settings.patronPercentage || 10;
  const patronBtn = document.getElementById('quick-patron-pct');
  if (patronBtn) {
    patronBtn.textContent = `Patron ${patronPct}%`;
  }

  renderAllocationTable();
  updateAllocationCheck();
}

function backToStep1() {
  document.getElementById('step-1-details').classList.add('active');
  document.getElementById('step-2-allocation').classList.remove('active');

  document.getElementById('btn-next-step2').style.display = 'inline-block';
  document.getElementById('btn-confirm-loot').style.display = 'none';
  document.getElementById('btn-back-step1').style.display = 'none';

  treasuryState.modalLoot.currentStep = 1;
}

function renderAllocationTable() {
  const body = document.getElementById('allocation-body');
  body.innerHTML = '';

  treasuryState.modalLoot.allocations.forEach((alloc, idx) => {
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
  treasuryState.modalLoot.allocations[idx].amountCp = amountCp;

  document.getElementById(`alloc-total-${idx}`).textContent = formatCp(amountCp);
  updateAllocationCheck();
}

function updateAllocationDisplay() {
  treasuryState.modalLoot.allocations.forEach((alloc, idx) => {
    document.getElementById(`alloc-total-${idx}`).textContent = formatCp(alloc.amountCp);
  });
}

function updateAllocationCheck() {
  const allocatedTotal = treasuryState.modalLoot.allocations.reduce((sum, a) => sum + a.amountCp, 0);

  document.getElementById('alloc-loot-total').textContent = formatCp(treasuryState.modalLoot.lootTotalCp);
  document.getElementById('alloc-allocated-total').textContent = formatCp(allocatedTotal);

  const statusEl = document.getElementById('alloc-match-status');
  const confirmBtn = document.getElementById('btn-confirm-loot');

  if (allocatedTotal === treasuryState.modalLoot.lootTotalCp) {
    statusEl.textContent = '✓ Allocations match!';
    statusEl.className = 'status-good';
    confirmBtn.disabled = false;
  } else {
    statusEl.textContent = '❌ Amounts don\'t match';
    statusEl.className = 'status-bad';
    confirmBtn.disabled = true;
  }
}

// Quick allocation helpers
function quickEvenSplit() {
  const total = treasuryState.modalLoot.lootTotalCp;
  const count = treasuryState.modalLoot.allocations.length;
  const perAccount = Math.floor(total / count);
  const remainder = total % count;

  treasuryState.modalLoot.allocations.forEach((alloc, idx) => {
    alloc.amountCp = perAccount + (idx < remainder ? 1 : 0);
  });

  renderAllocationTable();
  updateAllocationCheck();
}

function quickPartyAll() {
  const total = treasuryState.modalLoot.lootTotalCp;
  
  treasuryState.modalLoot.allocations.forEach(alloc => {
    alloc.amountCp = alloc.accountId === 'party' ? total : 0;
  });

  renderAllocationTable();
  updateAllocationCheck();
}

function quickClearAlloc() {
  treasuryState.modalLoot.allocations.forEach(alloc => {
    alloc.amountCp = 0;
  });

  renderAllocationTable();
  updateAllocationCheck();
}

function quickPatronPercentage() {
  const patronPct = treasuryState.settings.patronPercentage || 10;
  const total = treasuryState.modalLoot.lootTotalCp;
  
  // Calculate patriarch amount
  const patronAmountCp = Math.floor(total * patronPct / 100);
  const remainingCp = total - patronAmountCp;
  
  // Clear all
  treasuryState.modalLoot.allocations.forEach(alloc => {
    alloc.amountCp = 0;
  });
  
  // Allocate to patron and party
  treasuryState.modalLoot.allocations.forEach(alloc => {
    if (alloc.accountId === 'patron') {
      alloc.amountCp = patronAmountCp;
    } else if (alloc.accountId === 'party') {
      alloc.amountCp = remainingCp;
    }
  });

  renderAllocationTable();
  updateAllocationCheck();
  console.log(`Applied patron ${patronPct}% allocation: ${formatCp(patronAmountCp)} to patron, ${formatCp(remainingCp)} to party`);
}

function openCustomPercentageModal() {
  // Create percentage input fields for each account
  const container = document.getElementById('pct-inputs-container');
  container.innerHTML = '';
  
  treasuryState.modalLoot.allocations.forEach((alloc, idx) => {
    const div = document.createElement('div');
    div.className = 'pct-input-group';
    div.innerHTML = `
      <label for="pct-${idx}">${alloc.name}</label>
      <div class="pct-input-wrapper">
        <input type="number" id="pct-${idx}" class="pct-input" min="0" max="100" value="0" data-idx="${idx}" onchange="updatePercentageTotal()" oninput="updatePercentageTotal()" />
        <span class="pct-symbol">%</span>
      </div>
    `;
    container.appendChild(div);
  });
  
  document.getElementById('modal-custom-pct').style.display = 'flex';
  updatePercentageTotal();
}

function closeCustomPercentageModal() {
  document.getElementById('modal-custom-pct').style.display = 'none';
}

function updatePercentageTotal() {
  let totalPct = 0;
  document.querySelectorAll('.pct-input').forEach(input => {
    totalPct += Number(input.value) || 0;
  });
  
  const display = document.getElementById('pct-total-display');
  display.textContent = totalPct + '%';
  display.className = totalPct === 100 ? '' : 'warning';
}

function applyCustomPercentages() {
  const total = treasuryState.modalLoot.lootTotalCp;
  let totalPct = 0;
  const percentages = [];
  
  // Collect percentages
  document.querySelectorAll('.pct-input').forEach((input, idx) => {
    const pct = Number(input.value) || 0;
    percentages.push(pct);
    totalPct += pct;
  });
  
  if (totalPct !== 100) {
    alert(`Percentages must total 100%. Current total: ${totalPct}%`);
    return;
  }
  
  // Clear all
  treasuryState.modalLoot.allocations.forEach(alloc => {
    alloc.amountCp = 0;
  });
  
  // Apply percentages
  let allocated = 0;
  treasuryState.modalLoot.allocations.forEach((alloc, idx) => {
    const pct = percentages[idx];
    if (pct > 0) {
      const amountCp = Math.floor(total * pct / 100);
      alloc.amountCp = amountCp;
      allocated += amountCp;
    }
  });
  
  // Add any rounding remainder to party vault
  if (allocated < total) {
    const partyAlloc = treasuryState.modalLoot.allocations.find(a => a.accountId === 'party');
    if (partyAlloc) {
      partyAlloc.amountCp += (total - allocated);
    }
  }

  renderAllocationTable();
  updateAllocationCheck();
  closeCustomPercentageModal();
  console.log('Applied custom percentage allocation');
}

async function confirmLootEntry() {
  try {
    const description = document.getElementById('loot-description').value || 'Loot';
    const category = document.getElementById('loot-category').value;
    const session = document.getElementById('loot-session').value ? Number(document.getElementById('loot-session').value) : null;

    const payload = {
      totalCp: treasuryState.modalLoot.lootTotalCp,
      description,
      category,
      session,
      allocations: treasuryState.modalLoot.allocations.filter(a => a.amountCp > 0)
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
    renderQuickStats();
    renderLootLog();
    renderWallets();

    closeAddLootModal();
    alert('✓ Loot entry added successfully!');
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
    renderQuickStats();
    renderLootLog();
    renderWallets();

    console.log('Loot entry deleted:', lootId);
  } catch (err) {
    console.error('Error deleting loot:', err);
    alert(`Failed to delete loot: ${err.message}`);
  }
}

// ============================================================================
// MODAL: RECORD SPENDING
// ============================================================================

function openRecordSpendingModal() {
  treasuryState.modalSpending.isOpen = true;
  treasuryState.modalSpending.accountId = '';
  treasuryState.modalSpending.amountCp = 0;

  // Reset form
  document.getElementById('spending-gp').value = 0;
  document.getElementById('spending-sp').value = 0;
  document.getElementById('spending-cp').value = 0;
  document.getElementById('spending-description').value = '';

  populateSpendingAccountSelect();
  populateSpendingCategorySelect();

  document.getElementById('modal-record-spending').style.display = 'flex';
  updateSpendingDisplay();
}

function closeRecordSpendingModal() {
  treasuryState.modalSpending.isOpen = false;
  document.getElementById('modal-record-spending').style.display = 'none';
}

function updateSpendingDisplay() {
  const gp = Number(document.getElementById('spending-gp').value) || 0;
  const sp = Number(document.getElementById('spending-sp').value) || 0;
  const cp = Number(document.getElementById('spending-cp').value) || 0;

  treasuryState.modalSpending.amountCp = currencyToCp(gp, sp, cp);
  document.getElementById('spending-amount-display').textContent = formatCp(treasuryState.modalSpending.amountCp);
}

async function confirmSpendingEntry() {
  try {
    const accountId = document.getElementById('spending-account').value;
    const category = document.getElementById('spending-category').value;
    const description = document.getElementById('spending-description').value || 'Expense';
    const amountCp = treasuryState.modalSpending.amountCp;

    if (!accountId) {
      alert('Please select an account');
      return;
    }

    if (amountCp <= 0) {
      alert('Please enter an amount greater than 0');
      return;
    }

    const payload = {
      accountId,
      amountCp,
      description,
      category
    };

    console.log('Recording spending:', payload);

    const response = await fetch('/api/treasury/spending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    console.log('Spending recorded:', data);

    // Reload and refresh UI
    await loadSpendingLog();
    await loadWallets();
    renderQuickStats();
    renderSpendingLog();
    renderWallets();

    closeRecordSpendingModal();
    alert('✓ Spending recorded successfully!');
  } catch (err) {
    console.error('Error recording spending:', err);
    alert(`Failed to record spending: ${err.message}`);
  }
}

async function deleteSpendingEntry(spendingId) {
  if (!confirm('Delete this spending record?')) return;

  try {
    const response = await fetch(`/api/treasury/spending/${spendingId}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.status !== 'success') throw new Error(data.message);

    // Reload and refresh
    await loadSpendingLog();
    await loadWallets();
    renderQuickStats();
    renderSpendingLog();
    renderWallets();

    console.log('Spending entry deleted:', spendingId);
  } catch (err) {
    console.error('Error deleting spending:', err);
    alert(`Failed to delete spending: ${err.message}`);
  }
}

// ============================================================================
// SETTINGS & FILTERS
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
    alert('✓ Settings saved!');
    console.log('Settings saved:', treasuryState.settings);
  } catch (err) {
    console.error('Error saving settings:', err);
    alert(`Failed to save settings: ${err.message}`);
  }
}

function syncSettingsUI() {
  document.getElementById('setting-allocate-patron').checked = treasuryState.settings.allocateToPatron || false;
  document.getElementById('setting-patron-percent').value = treasuryState.settings.patronPercentage || 10;
}

function onSpendingFilterChange() {
  renderSpendingLog();
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Tab navigation
  setupTabNavigation();

  // Buttons for add loot (all instances)
  document.getElementById('btn-add-loot')?.addEventListener('click', openAddLootModal);
  document.getElementById('btn-add-loot-2')?.addEventListener('click', openAddLootModal);

  // Buttons for record spending (all instances)
  document.getElementById('btn-record-spending')?.addEventListener('click', openRecordSpendingModal);
  document.getElementById('btn-record-spending-2')?.addEventListener('click', openRecordSpendingModal);

  // Modal: Add Loot
  document.getElementById('modal-close-loot')?.addEventListener('click', closeAddLootModal);
  document.getElementById('btn-cancel-loot')?.addEventListener('click', closeAddLootModal);

  document.getElementById('loot-gp')?.addEventListener('input', updateLootDisplay);
  document.getElementById('loot-sp')?.addEventListener('input', updateLootDisplay);
  document.getElementById('loot-cp')?.addEventListener('input', updateLootDisplay);

  document.getElementById('btn-next-step2')?.addEventListener('click', proceedToStep2);
  document.getElementById('btn-back-step1')?.addEventListener('click', backToStep1);
  document.getElementById('btn-confirm-loot')?.addEventListener('click', confirmLootEntry);

  document.getElementById('quick-even-split')?.addEventListener('click', quickEvenSplit);
  document.getElementById('quick-party-all')?.addEventListener('click', quickPartyAll);
  document.getElementById('quick-patron-pct')?.addEventListener('click', quickPatronPercentage);
  document.getElementById('quick-custom-pct')?.addEventListener('click', openCustomPercentageModal);
  document.getElementById('quick-clear-alloc')?.addEventListener('click', quickClearAlloc);

  // Modal: Custom Percentages
  document.getElementById('modal-close-pct')?.addEventListener('click', closeCustomPercentageModal);
  document.getElementById('btn-cancel-pct')?.addEventListener('click', closeCustomPercentageModal);
  document.getElementById('btn-confirm-pct')?.addEventListener('click', applyCustomPercentages);

  document.getElementById('modal-custom-pct')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-custom-pct') closeCustomPercentageModal();
  });

  // Modal: Record Spending
  document.getElementById('modal-close-spending')?.addEventListener('click', closeRecordSpendingModal);
  document.getElementById('btn-cancel-spending')?.addEventListener('click', closeRecordSpendingModal);

  document.getElementById('spending-gp')?.addEventListener('input', updateSpendingDisplay);
  document.getElementById('spending-sp')?.addEventListener('input', updateSpendingDisplay);
  document.getElementById('spending-cp')?.addEventListener('input', updateSpendingDisplay);

  document.getElementById('btn-confirm-spending')?.addEventListener('click', confirmSpendingEntry);

  // Spending filters
  document.getElementById('spending-filter-account')?.addEventListener('change', onSpendingFilterChange);
  document.getElementById('spending-filter-category')?.addEventListener('change', onSpendingFilterChange);

  // Settings
  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);

  // Close modals when clicking outside
  document.getElementById('modal-add-loot')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-add-loot') closeAddLootModal();
  });

  document.getElementById('modal-record-spending')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-record-spending') closeRecordSpendingModal();
  });

  // Sync settings UI on load
  syncSettingsUI();

  console.log('Event listeners setup complete');
}

console.log('Treasury.js loaded');
