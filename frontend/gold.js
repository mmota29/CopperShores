const TREASURY_API_BASE = '/api/treasury';

const DEFAULT_SETTINGS = {
  patronEnabled: false,
  defaultPatronPercent: 10,
  defaultSplitMode: 'equal_split',
  coinValues: {
    pp: 1000,
    gp: 100,
    sp: 10,
    cp: 1
  }
};

const treasuryState = {
  characters: [],
  transactions: [],
  settings: { ...DEFAULT_SETTINGS },
  derived: {
    characterBalancesCp: {},
    patronBalanceCp: 0,
    combinedPartyWealthCp: 0,
    totalSpentThisSessionCp: 0
  },
  activeTab: 'wallets',
  logFilter: 'all',
  modal: {
    isOpen: false,
    mode: 'add',
    editingId: null,
    form: null,
    preview: null
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getCoinValues() {
  const coinValues = (treasuryState.settings && treasuryState.settings.coinValues) || DEFAULT_SETTINGS.coinValues;
  return {
    pp: Math.max(1, Number(coinValues.pp) || DEFAULT_SETTINGS.coinValues.pp),
    gp: Math.max(1, Number(coinValues.gp) || DEFAULT_SETTINGS.coinValues.gp),
    sp: Math.max(1, Number(coinValues.sp) || DEFAULT_SETTINGS.coinValues.sp),
    cp: Math.max(1, Number(coinValues.cp) || DEFAULT_SETTINGS.coinValues.cp)
  };
}

function normalizeCoinsInput(raw) {
  const coins = raw || {};
  return {
    pp: Math.max(0, Math.trunc(Number(coins.pp) || 0)),
    gp: Math.max(0, Math.trunc(Number(coins.gp) || 0)),
    sp: Math.max(0, Math.trunc(Number(coins.sp) || 0)),
    cp: Math.max(0, Math.trunc(Number(coins.cp) || 0))
  };
}

function coinsToCp(inputCoins) {
  const coinValues = getCoinValues();
  const coins = normalizeCoinsInput(inputCoins);
  return (
    coins.pp * coinValues.pp +
    coins.gp * coinValues.gp +
    coins.sp * coinValues.sp +
    coins.cp * coinValues.cp
  );
}

function cpToCoins(totalCp) {
  const coinValues = getCoinValues();
  const sign = totalCp < 0 ? -1 : 1;
  let remaining = Math.abs(Math.trunc(Number(totalCp) || 0));

  const pp = Math.floor(remaining / coinValues.pp);
  remaining -= pp * coinValues.pp;
  const gp = Math.floor(remaining / coinValues.gp);
  remaining -= gp * coinValues.gp;
  const sp = Math.floor(remaining / coinValues.sp);
  remaining -= sp * coinValues.sp;
  const cp = Math.floor(remaining / coinValues.cp);

  return {
    pp: pp * sign,
    gp: gp * sign,
    sp: sp * sign,
    cp: cp * sign
  };
}

function formatCoins(totalCp) {
  const sign = totalCp < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(Number(totalCp) || 0));
  const coinValues = getCoinValues();
  let coins;

  // Keep small/medium totals in gp/sp/cp for readability.
  if (absolute < coinValues.pp * 10) {
    let remaining = absolute;
    const gp = Math.floor(remaining / coinValues.gp);
    remaining -= gp * coinValues.gp;
    const sp = Math.floor(remaining / coinValues.sp);
    remaining -= sp * coinValues.sp;
    const cp = Math.floor(remaining / coinValues.cp);
    coins = { pp: 0, gp, sp, cp };
  } else {
    coins = cpToCoins(absolute);
  }

  const parts = [];
  if (coins.pp > 0) parts.push(`${coins.pp} pp`);
  if (coins.gp > 0) parts.push(`${coins.gp} gp`);
  if (coins.sp > 0) parts.push(`${coins.sp} sp`);
  if (coins.cp > 0) parts.push(`${coins.cp} cp`);
  return parts.length ? `${sign}${parts.join(', ')}` : '0 cp';
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSortedActiveCharacters() {
  return treasuryState.characters
    .filter(char => char.isActive)
    .slice()
    .sort((a, b) => {
      if ((a.displayOrder || 0) !== (b.displayOrder || 0)) {
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      }
      return (a.characterName || '').localeCompare(b.characterName || '');
    });
}

function splitByShares(totalCp, recipients) {
  const total = Math.max(0, Math.trunc(Number(totalCp) || 0));
  const ordered = recipients
    .map((recipient, index) => ({
      key: recipient.key,
      targetType: recipient.targetType,
      characterId: recipient.characterId,
      shareCount: Math.max(0, Math.trunc(Number(recipient.shareCount) || 0)),
      order: recipient.order !== undefined ? recipient.order : index
    }))
    .filter(recipient => recipient.shareCount > 0)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.key.localeCompare(b.key);
    });

  if (ordered.length === 0) return [];

  const totalShares = ordered.reduce((sum, recipient) => sum + recipient.shareCount, 0);
  if (totalShares <= 0) return [];

  const baseAllocations = ordered.map(recipient => {
    const rawAmount = total * (recipient.shareCount / totalShares);
    return {
      ...recipient,
      amountCp: Math.floor(rawAmount)
    };
  });

  let allocated = baseAllocations.reduce((sum, allocation) => sum + allocation.amountCp, 0);
  let remainder = total - allocated;
  let cursor = 0;

  while (remainder > 0) {
    baseAllocations[cursor].amountCp += 1;
    remainder -= 1;
    cursor = (cursor + 1) % baseAllocations.length;
  }

  return baseAllocations;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({
    status: 'error',
    message: 'Invalid JSON response'
  }));
  if (!response.ok || payload.status !== 'success') {
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload.data || {};
}

async function fetchTreasuryState() {
  const data = await requestJson(`${TREASURY_API_BASE}/state`);
  treasuryState.characters = Array.isArray(data.characters) ? data.characters : [];
  treasuryState.transactions = Array.isArray(data.transactions) ? data.transactions : [];
  treasuryState.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  treasuryState.derived = {
    characterBalancesCp: (data.derived && data.derived.characterBalancesCp) || {},
    patronBalanceCp: (data.derived && data.derived.patronBalanceCp) || 0,
    combinedPartyWealthCp: (data.derived && data.derived.combinedPartyWealthCp) || 0,
    totalSpentThisSessionCp: (data.derived && data.derived.totalSpentThisSessionCp) || 0
  };
}

function renderSummaryCards() {
  const combinedEl = document.getElementById('summary-combined');
  const spentEl = document.getElementById('summary-spent');
  const patronCard = document.getElementById('summary-patron-card');
  const patronEl = document.getElementById('summary-patron');

  combinedEl.textContent = formatCoins(treasuryState.derived.combinedPartyWealthCp);
  spentEl.textContent = formatCoins(treasuryState.derived.totalSpentThisSessionCp);
  patronEl.textContent = formatCoins(treasuryState.derived.patronBalanceCp);
  patronCard.style.display = treasuryState.settings.patronEnabled ? 'block' : 'none';
}

function renderWalletsTab() {
  const walletsGrid = document.getElementById('wallets-grid');
  const walletsEmpty = document.getElementById('wallets-empty');
  const activeCharacters = getSortedActiveCharacters();
  walletsGrid.innerHTML = '';

  if (!activeCharacters.length) {
    walletsEmpty.style.display = 'block';
    return;
  }
  walletsEmpty.style.display = 'none';

  activeCharacters.forEach(character => {
    const balance = treasuryState.derived.characterBalancesCp[character.id] || 0;
    const coins = cpToCoins(balance);
    const breakdown = [
      `${Math.max(0, coins.pp)} pp`,
      `${Math.max(0, coins.gp)} gp`,
      `${Math.max(0, coins.sp)} sp`,
      `${Math.max(0, coins.cp)} cp`
    ].join(' | ');

    const card = document.createElement('article');
    card.className = 'wallet-card';
    card.innerHTML = `
      <div class="wallet-character">${escapeHtml(character.characterName)}</div>
      <div class="wallet-player">Player: ${escapeHtml(character.playerName)}</div>
      <div class="wallet-balance">Wallet: ${formatCoins(balance)}</div>
      <div class="wallet-breakdown">${escapeHtml(breakdown)}</div>
    `;
    walletsGrid.appendChild(card);
  });
}

function buildCharacterNameMap() {
  const map = {};
  treasuryState.characters.forEach(character => {
    map[character.id] = {
      characterName: character.characterName,
      playerName: character.playerName
    };
  });
  return map;
}

function getAllocationSummary(transaction) {
  const nameMap = buildCharacterNameMap();
  const characterAllocs = transaction.allocations.filter(alloc => alloc.targetType === 'character');
  const patronAllocs = transaction.allocations.filter(alloc => alloc.targetType === 'patron');
  const parts = [];

  if (transaction.allocationMode === 'direct') {
    const target = transaction.allocations[0];
    if (target) {
      if (target.targetType === 'patron') {
        parts.push('Direct to Patron');
      } else {
        const names = nameMap[target.characterId] || { characterName: target.characterId };
        parts.push(`Direct to ${names.characterName}`);
      }
    }
  } else if (transaction.allocationMode === 'equal_split') {
    parts.push(`Even split among ${characterAllocs.length}${characterAllocs.length === 1 ? ' character' : ' characters'}`);
  } else if (transaction.allocationMode === 'custom_split') {
    const shareBits = characterAllocs.map(alloc => {
      const names = nameMap[alloc.characterId] || { characterName: alloc.characterId };
      const shares = alloc.shareCount !== undefined ? alloc.shareCount : 1;
      return `${names.characterName} ${shares} share${shares === 1 ? '' : 's'}`;
    });
    if (shareBits.length) {
      parts.push(`Custom split: ${shareBits.join(', ')}`);
    }
  }

  if (transaction.type === 'income' && transaction.patronCp > 0) {
    parts.push(`Patron received ${transaction.patronPercentAtTime || 0}% (${formatCoins(transaction.patronCp)})`);
  } else if (transaction.type === 'expense' && patronAllocs.length) {
    parts.push(`Patron paid ${formatCoins(Math.abs(patronAllocs.reduce((sum, a) => sum + a.cpDelta, 0)))}`);
  }

  return parts.join(' | ');
}

function renderLedgerTab() {
  const ledgerBody = document.getElementById('ledger-body');
  const ledgerEmpty = document.getElementById('ledger-empty');
  ledgerBody.innerHTML = '';

  let list = treasuryState.transactions.slice();
  if (treasuryState.logFilter !== 'all') {
    list = list.filter(entry => entry.type === treasuryState.logFilter);
  }

  if (!list.length) {
    ledgerEmpty.style.display = 'block';
    return;
  }
  ledgerEmpty.style.display = 'none';

  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.forEach(transaction => {
    const dateText = transaction.date || '';
    const summaryText = getAllocationSummary(transaction);
    const sessionNoteParts = [];
    if (transaction.sessionLabel) sessionNoteParts.push(transaction.sessionLabel);
    if (transaction.note) sessionNoteParts.push(transaction.note);
    const sessionText = sessionNoteParts.length ? sessionNoteParts.join(' | ') : '-';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(dateText)}</td>
      <td>${escapeHtml(transaction.description || '-')}</td>
      <td><span class="type-badge ${transaction.type === 'income' ? 'type-income' : 'type-expense'}">${escapeHtml(transaction.type)}</span></td>
      <td class="ledger-total">${formatCoins(transaction.totalCp)}</td>
      <td>${escapeHtml(summaryText || '-')}</td>
      <td>${escapeHtml(sessionText)}</td>
      <td>
        <div class="action-row">
          <button class="mini-btn" data-action="edit" data-id="${escapeHtml(transaction.id)}">Edit</button>
          <button class="mini-btn delete" data-action="delete" data-id="${escapeHtml(transaction.id)}">Delete</button>
        </div>
      </td>
    `;
    ledgerBody.appendChild(row);
  });
}

function syncFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === treasuryState.logFilter);
  });
}

function renderSettingsTab() {
  const settings = treasuryState.settings || DEFAULT_SETTINGS;
  const coinValues = getCoinValues();

  document.getElementById('setting-patron-enabled').checked = Boolean(settings.patronEnabled);
  document.getElementById('setting-default-patron-percent').value = Number(settings.defaultPatronPercent || 0);
  document.getElementById('setting-default-split-mode').value = settings.defaultSplitMode || 'equal_split';
  document.getElementById('setting-coin-pp').value = coinValues.pp;
  document.getElementById('setting-coin-gp').value = coinValues.gp;
  document.getElementById('setting-coin-sp').value = coinValues.sp;
  document.getElementById('setting-coin-cp').value = coinValues.cp;
  document.getElementById('settings-error').textContent = '';
}

function renderTabState() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === treasuryState.activeTab);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${treasuryState.activeTab}`);
  });
}

function renderAll() {
  renderSummaryCards();
  renderWalletsTab();
  renderLedgerTab();
  renderSettingsTab();
  syncFilterButtons();
  renderTabState();
  if (treasuryState.modal.isOpen) {
    renderModal();
  }
}

async function refreshAndRender() {
  try {
    await fetchTreasuryState();
    renderAll();
  } catch (err) {
    alert(`Failed to load treasury: ${err.message}`);
  }
}

function buildEmptyModalForm() {
  const activeCharacters = getSortedActiveCharacters();
  const selectedMap = {};
  const customShares = {};
  activeCharacters.forEach(character => {
    selectedMap[character.id] = true;
    customShares[character.id] = 1;
  });

  const defaultSplitMode = treasuryState.settings.defaultSplitMode || 'equal_split';
  const firstCharacter = activeCharacters[0];

  return {
    description: '',
    date: todayDate(),
    type: 'income',
    inputCoins: { pp: 0, gp: 0, sp: 0, cp: 0 },
    allocationMode: defaultSplitMode,
    directTarget: firstCharacter ? `character:${firstCharacter.id}` : '',
    equalSelected: selectedMap,
    equalIncludePatron: false,
    customShares,
    customPatronShare: 0,
    patronCutEnabled: Boolean(treasuryState.settings.patronEnabled),
    patronPercent: Number(treasuryState.settings.defaultPatronPercent || 10),
    sessionLabel: '',
    note: ''
  };
}

function openModalForCreate() {
  treasuryState.modal.isOpen = true;
  treasuryState.modal.mode = 'add';
  treasuryState.modal.editingId = null;
  treasuryState.modal.form = buildEmptyModalForm();
  treasuryState.modal.preview = calculateModalPreview();
  renderModal();
}

function formFromTransaction(transaction) {
  const form = buildEmptyModalForm();
  form.description = transaction.description || '';
  form.date = transaction.date || todayDate();
  form.type = transaction.type || 'income';
  form.inputCoins = normalizeCoinsInput(transaction.inputCoins || cpToCoins(transaction.totalCp || 0));
  form.allocationMode = transaction.allocationMode || 'direct';
  form.patronCutEnabled = Boolean(transaction.type === 'income' && transaction.patronCp > 0);
  form.patronPercent = Number(transaction.patronPercentAtTime || treasuryState.settings.defaultPatronPercent || 10);
  form.sessionLabel = transaction.sessionLabel || '';
  form.note = transaction.note || '';

  const activeCharacters = getSortedActiveCharacters();
  const characterSet = new Set(activeCharacters.map(character => character.id));
  const allocs = Array.isArray(transaction.allocations) ? transaction.allocations : [];

  Object.keys(form.equalSelected).forEach(characterId => {
    form.equalSelected[characterId] = false;
  });
  Object.keys(form.customShares).forEach(characterId => {
    form.customShares[characterId] = 0;
  });

  const firstAlloc = allocs[0];
  if (form.allocationMode === 'direct') {
    if (firstAlloc && firstAlloc.targetType === 'character' && firstAlloc.characterId) {
      form.directTarget = `character:${firstAlloc.characterId}`;
    } else if (firstAlloc && firstAlloc.targetType === 'patron') {
      form.directTarget = 'patron';
    }
  }

  allocs.forEach(alloc => {
    if (alloc.targetType === 'character' && characterSet.has(alloc.characterId)) {
      form.equalSelected[alloc.characterId] = true;
      form.customShares[alloc.characterId] = Math.max(0, Number(alloc.shareCount !== undefined ? alloc.shareCount : 1));
    }
    if (alloc.targetType === 'patron' && transaction.type === 'expense') {
      form.equalIncludePatron = true;
      form.customPatronShare = Math.max(0, Number(alloc.shareCount !== undefined ? alloc.shareCount : 1));
    }
  });

  if (form.allocationMode === 'equal_split') {
    Object.keys(form.customShares).forEach(characterId => {
      form.customShares[characterId] = form.equalSelected[characterId] ? 1 : 0;
    });
  }

  if (form.allocationMode === 'custom_split') {
    const hasCustomShare = Object.values(form.customShares).some(value => value > 0);
    if (!hasCustomShare) {
      activeCharacters.forEach(character => {
        form.customShares[character.id] = 1;
      });
    }
  }

  return form;
}

function openModalForEdit(transactionId) {
  const transaction = treasuryState.transactions.find(item => item.id === transactionId);
  if (!transaction) {
    alert('Transaction not found.');
    return;
  }
  treasuryState.modal.isOpen = true;
  treasuryState.modal.mode = 'edit';
  treasuryState.modal.editingId = transactionId;
  treasuryState.modal.form = formFromTransaction(transaction);
  treasuryState.modal.preview = calculateModalPreview();
  renderModal();
}

function closeModal() {
  treasuryState.modal.isOpen = false;
  treasuryState.modal.form = null;
  treasuryState.modal.preview = null;
  document.getElementById('transaction-modal').style.display = 'none';
}

function getRecipientName(recipient) {
  if (recipient.targetType === 'patron') return 'Patron';
  const found = treasuryState.characters.find(character => character.id === recipient.characterId);
  return found ? found.characterName : recipient.characterId;
}

function calculateModalPreview() {
  const form = treasuryState.modal.form;
  const preview = {
    totalCp: 0,
    patronCp: 0,
    distributableCp: 0,
    allocations: [],
    errors: [],
    patronPercent: 0
  };
  if (!form) return preview;

  const totalCp = coinsToCp(form.inputCoins);
  preview.totalCp = totalCp;

  if (totalCp <= 0) {
    preview.errors.push('Total amount must be greater than 0.');
    return preview;
  }

  let distributableCp = totalCp;
  const canApplyPatronCut =
    form.type === 'income' &&
    treasuryState.settings.patronEnabled &&
    form.patronCutEnabled;

  if (canApplyPatronCut) {
    const percent = Number(form.patronPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      preview.errors.push('Patron percent must be between 0 and 100.');
      return preview;
    }
    preview.patronPercent = percent;
    preview.patronCp = Math.floor((totalCp * percent) / 100);
    distributableCp = totalCp - preview.patronCp;
    if (preview.patronCp > 0) {
      preview.allocations.push({
        targetType: 'patron',
        cpDelta: preview.patronCp
      });
    }
  }

  preview.distributableCp = distributableCp;
  const activeCharacters = getSortedActiveCharacters();

  if (form.allocationMode === 'direct') {
    if (!form.directTarget) {
      preview.errors.push('Direct mode requires a target.');
      return preview;
    }
    if (form.type === 'income' && form.directTarget === 'patron' && preview.patronCp > 0) {
      // allowed: both cut and direct distribution to patron
    }
    const amount = form.type === 'income' ? distributableCp : -totalCp;
    if (form.directTarget === 'patron') {
      preview.allocations.push({ targetType: 'patron', cpDelta: amount, shareCount: 1 });
    } else if (form.directTarget.startsWith('character:')) {
      preview.allocations.push({
        targetType: 'character',
        characterId: form.directTarget.slice('character:'.length),
        cpDelta: amount,
        shareCount: 1
      });
    } else {
      preview.errors.push('Direct target is invalid.');
      return preview;
    }
  } else if (form.allocationMode === 'equal_split') {
    const recipients = activeCharacters
      .filter(character => form.equalSelected[character.id])
      .map(character => ({
        key: `character:${character.id}`,
        targetType: 'character',
        characterId: character.id,
        shareCount: 1,
        order: character.displayOrder || 0
      }));

    if (form.type === 'expense' && form.equalIncludePatron) {
      recipients.push({
        key: 'patron',
        targetType: 'patron',
        shareCount: 1,
        order: 9999
      });
    }

    if (!recipients.length) {
      preview.errors.push('Select at least one recipient for even split.');
      return preview;
    }

    const baseAmount = form.type === 'income' ? distributableCp : totalCp;
    const split = splitByShares(baseAmount, recipients);
    split.forEach(item => {
      preview.allocations.push({
        targetType: item.targetType,
        characterId: item.characterId,
        shareCount: 1,
        cpDelta: form.type === 'income' ? item.amountCp : -item.amountCp
      });
    });
  } else if (form.allocationMode === 'custom_split') {
    const recipients = activeCharacters.map(character => ({
      key: `character:${character.id}`,
      targetType: 'character',
      characterId: character.id,
      shareCount: Number(form.customShares[character.id] || 0),
      order: character.displayOrder || 0
    }));

    if (form.type === 'expense' && Number(form.customPatronShare || 0) > 0) {
      recipients.push({
        key: 'patron',
        targetType: 'patron',
        shareCount: Number(form.customPatronShare || 0),
        order: 9999
      });
    }

    const totalShares = recipients.reduce((sum, recipient) => sum + Math.max(0, Number(recipient.shareCount || 0)), 0);
    if (totalShares <= 0) {
      preview.errors.push('Custom split must have at least one share.');
      return preview;
    }

    const baseAmount = form.type === 'income' ? distributableCp : totalCp;
    const split = splitByShares(baseAmount, recipients);
    split.forEach(item => {
      preview.allocations.push({
        targetType: item.targetType,
        characterId: item.characterId,
        shareCount: item.shareCount,
        cpDelta: form.type === 'income' ? item.amountCp : -item.amountCp
      });
    });
  } else {
    preview.errors.push('Invalid allocation mode.');
    return preview;
  }

  if (!preview.allocations.length) {
    preview.errors.push('No allocations were generated.');
    return preview;
  }

  const merged = new Map();
  preview.allocations.forEach(alloc => {
    const key = alloc.targetType === 'patron' ? 'patron' : `character:${alloc.characterId}`;
    const existing = merged.get(key);
    if (existing) {
      existing.cpDelta += alloc.cpDelta;
      if (alloc.shareCount !== undefined) {
        existing.shareCount = Math.max(existing.shareCount || 0, alloc.shareCount);
      }
    } else {
      merged.set(key, {
        targetType: alloc.targetType,
        characterId: alloc.characterId,
        cpDelta: alloc.cpDelta,
        shareCount: alloc.shareCount
      });
    }
  });
  preview.allocations = Array.from(merged.values()).filter(alloc => alloc.cpDelta !== 0);

  const allocationSum = preview.allocations.reduce((sum, alloc) => sum + alloc.cpDelta, 0);
  const expected = form.type === 'income' ? totalCp : -totalCp;
  if (allocationSum !== expected) {
    preview.errors.push(`Allocations do not match total (${allocationSum} cp vs ${expected} cp).`);
  }

  if (form.description.trim() === '') {
    preview.errors.push('Description is required.');
  }

  return preview;
}

function renderModal() {
  if (!treasuryState.modal.isOpen || !treasuryState.modal.form) return;
  const modal = document.getElementById('transaction-modal');
  const form = treasuryState.modal.form;
  treasuryState.modal.preview = calculateModalPreview();
  const preview = treasuryState.modal.preview;
  const activeCharacters = getSortedActiveCharacters();

  document.getElementById('transaction-modal-title').textContent =
    treasuryState.modal.mode === 'edit' ? 'Edit Transaction' : 'Add Transaction';
  document.getElementById('tx-description').value = form.description;
  document.getElementById('tx-date').value = form.date;
  document.getElementById('tx-type').value = form.type;
  document.getElementById('tx-allocation-mode').value = form.allocationMode;
  document.getElementById('tx-pp').value = form.inputCoins.pp;
  document.getElementById('tx-gp').value = form.inputCoins.gp;
  document.getElementById('tx-sp').value = form.inputCoins.sp;
  document.getElementById('tx-cp').value = form.inputCoins.cp;
  document.getElementById('tx-session-label').value = form.sessionLabel;
  document.getElementById('tx-note').value = form.note;
  document.getElementById('tx-patron-cut-enabled').checked = form.patronCutEnabled;
  document.getElementById('tx-patron-percent').value = form.patronPercent;

  const patronSection = document.getElementById('patron-cut-section');
  patronSection.style.display = treasuryState.settings.patronEnabled && form.type === 'income' ? 'block' : 'none';

  const directSection = document.getElementById('direct-section');
  const equalSection = document.getElementById('equal-section');
  const customSection = document.getElementById('custom-section');
  directSection.style.display = form.allocationMode === 'direct' ? 'block' : 'none';
  equalSection.style.display = form.allocationMode === 'equal_split' ? 'block' : 'none';
  customSection.style.display = form.allocationMode === 'custom_split' ? 'block' : 'none';

  const directTargetSelect = document.getElementById('tx-direct-target');
  const targetOptions = activeCharacters.map(character => (
    `<option value="character:${escapeHtml(character.id)}">${escapeHtml(character.characterName)} - Player: ${escapeHtml(character.playerName)}</option>`
  ));
  if (form.type === 'expense' && treasuryState.settings.patronEnabled) {
    targetOptions.push('<option value="patron">Patron Fund</option>');
  }
  directTargetSelect.innerHTML = targetOptions.join('');
  const hasDirectTarget = Array.from(directTargetSelect.options).some(option => option.value === form.directTarget);
  if (form.directTarget && hasDirectTarget) {
    directTargetSelect.value = form.directTarget;
  } else if (directTargetSelect.options.length > 0) {
    directTargetSelect.selectedIndex = 0;
    form.directTarget = directTargetSelect.value;
  }

  const equalRecipientList = document.getElementById('equal-recipient-list');
  equalRecipientList.innerHTML = activeCharacters.map(character => `
    <label class="recipient-row">
      <input type="checkbox" data-equal-char="${escapeHtml(character.id)}" ${form.equalSelected[character.id] ? 'checked' : ''}>
      <span>${escapeHtml(character.characterName)} - Player: ${escapeHtml(character.playerName)}</span>
    </label>
  `).join('');

  const equalPatronToggleWrap = document.getElementById('equal-patron-toggle-wrap');
  const equalPatronCheckbox = document.getElementById('tx-equal-include-patron');
  equalPatronToggleWrap.style.display =
    form.type === 'expense' && treasuryState.settings.patronEnabled ? 'inline-flex' : 'none';
  equalPatronCheckbox.checked = Boolean(form.equalIncludePatron);

  const previewAmounts = new Map();
  preview.allocations.forEach(alloc => {
    const key = alloc.targetType === 'patron' ? 'patron' : `character:${alloc.characterId}`;
    previewAmounts.set(key, alloc.cpDelta);
  });

  const customList = document.getElementById('custom-share-list');
  const totalShares = activeCharacters.reduce((sum, character) => (
    sum + Math.max(0, Number(form.customShares[character.id] || 0))
  ), 0) + (form.type === 'expense' ? Math.max(0, Number(form.customPatronShare || 0)) : 0);

  const customRows = activeCharacters.map(character => {
    const key = `character:${character.id}`;
    const share = Math.max(0, Number(form.customShares[character.id] || 0));
    const percent = totalShares > 0 ? ((share / totalShares) * 100).toFixed(1) : '0.0';
    const projected = previewAmounts.get(key) || 0;
    return `
      <div class="share-row">
        <div>
          <div>${escapeHtml(character.characterName)} <span class="wallet-player">Player: ${escapeHtml(character.playerName)}</span></div>
          <div class="share-meta">${percent}% | Projected: ${formatCoins(Math.abs(projected))}</div>
        </div>
        <div class="share-controls">
          <button type="button" class="share-btn" data-share-adjust="${escapeHtml(character.id)}" data-delta="-1">-</button>
          <span class="share-count">${share}</span>
          <button type="button" class="share-btn" data-share-adjust="${escapeHtml(character.id)}" data-delta="1">+</button>
        </div>
      </div>
    `;
  });

  if (form.type === 'expense' && treasuryState.settings.patronEnabled) {
    const patronShare = Math.max(0, Number(form.customPatronShare || 0));
    const percent = totalShares > 0 ? ((patronShare / totalShares) * 100).toFixed(1) : '0.0';
    const projected = Math.abs(previewAmounts.get('patron') || 0);
    customRows.push(`
      <div class="share-row">
        <div>
          <div>Patron Fund</div>
          <div class="share-meta">${percent}% | Projected: ${formatCoins(projected)}</div>
        </div>
        <div class="share-controls">
          <button type="button" class="share-btn" data-share-adjust="patron" data-delta="-1">-</button>
          <span class="share-count">${patronShare}</span>
          <button type="button" class="share-btn" data-share-adjust="patron" data-delta="1">+</button>
        </div>
      </div>
    `);
  }
  customList.innerHTML = customRows.join('');

  document.getElementById('preview-total').textContent = formatCoins(preview.totalCp);
  document.getElementById('preview-patron').textContent = formatCoins(preview.patronCp);
  document.getElementById('preview-distributable').textContent = formatCoins(preview.distributableCp);

  const previewList = document.getElementById('preview-allocation-list');
  previewList.innerHTML = preview.allocations.map(alloc => {
    const name = getRecipientName(alloc);
    if (form.type === 'income') {
      return `<div class="preview-row">${escapeHtml(name)} gets: <strong>${formatCoins(alloc.cpDelta)}</strong></div>`;
    }
    return `<div class="preview-row">${escapeHtml(name)} pays: <strong>${formatCoins(Math.abs(alloc.cpDelta))}</strong></div>`;
  }).join('');

  const errorContainer = document.getElementById('transaction-errors');
  if (preview.errors.length) {
    errorContainer.innerHTML = preview.errors.map(error => `<div>${escapeHtml(error)}</div>`).join('');
  } else {
    errorContainer.textContent = '';
  }

  document.getElementById('btn-save-transaction').disabled = preview.errors.length > 0;
  modal.style.display = 'flex';
}

function syncModalFormFromInputs() {
  if (!treasuryState.modal.form) return;
  const form = treasuryState.modal.form;
  form.description = document.getElementById('tx-description').value || '';
  form.date = document.getElementById('tx-date').value || todayDate();
  form.type = document.getElementById('tx-type').value || 'income';
  form.allocationMode = document.getElementById('tx-allocation-mode').value || 'direct';
  form.inputCoins = {
    pp: Number(document.getElementById('tx-pp').value || 0),
    gp: Number(document.getElementById('tx-gp').value || 0),
    sp: Number(document.getElementById('tx-sp').value || 0),
    cp: Number(document.getElementById('tx-cp').value || 0)
  };
  form.sessionLabel = document.getElementById('tx-session-label').value || '';
  form.note = document.getElementById('tx-note').value || '';
  form.patronCutEnabled = document.getElementById('tx-patron-cut-enabled').checked;
  form.patronPercent = Number(document.getElementById('tx-patron-percent').value || 0);
  form.directTarget = document.getElementById('tx-direct-target').value || '';
  form.equalIncludePatron = document.getElementById('tx-equal-include-patron').checked;

  document.querySelectorAll('[data-equal-char]').forEach(checkbox => {
    const charId = checkbox.getAttribute('data-equal-char');
    form.equalSelected[charId] = checkbox.checked;
  });
}

function adjustShare(target, delta) {
  const form = treasuryState.modal.form;
  const intDelta = Number(delta) > 0 ? 1 : -1;
  if (target === 'patron') {
    form.customPatronShare = Math.max(0, Number(form.customPatronShare || 0) + intDelta);
    return;
  }
  form.customShares[target] = Math.max(0, Number(form.customShares[target] || 0) + intDelta);
}

function setAllEqualRecipients(enabled) {
  const form = treasuryState.modal.form;
  getSortedActiveCharacters().forEach(character => {
    form.equalSelected[character.id] = enabled;
  });
}

function applyEvenCustomShares() {
  const form = treasuryState.modal.form;
  getSortedActiveCharacters().forEach(character => {
    form.customShares[character.id] = 1;
  });
  if (form.type === 'expense') {
    form.customPatronShare = form.customPatronShare > 0 ? 1 : 0;
  }
}

function resetCustomShares() {
  const form = treasuryState.modal.form;
  getSortedActiveCharacters().forEach(character => {
    form.customShares[character.id] = 0;
  });
  form.customPatronShare = 0;
}

function buildTransactionPayload() {
  const form = treasuryState.modal.form;
  const preview = calculateModalPreview();
  if (preview.errors.length) {
    return { error: preview.errors.join(' ') };
  }

  return {
    value: {
      date: form.date,
      description: form.description.trim(),
      type: form.type,
      totalCp: preview.totalCp,
      inputCoins: normalizeCoinsInput(form.inputCoins),
      allocationMode: form.allocationMode,
      patronEnabledAtTime: Boolean(form.patronCutEnabled && form.type === 'income' && treasuryState.settings.patronEnabled),
      patronPercentAtTime: Number(preview.patronPercent || 0),
      patronCp: Number(preview.patronCp || 0),
      allocations: preview.allocations.map(alloc => ({
        targetType: alloc.targetType,
        characterId: alloc.characterId,
        shareCount: alloc.shareCount,
        cpDelta: alloc.cpDelta
      })),
      sessionLabel: form.sessionLabel.trim() || undefined,
      note: form.note.trim() || undefined
    }
  };
}

async function saveTransactionFromModal() {
  syncModalFormFromInputs();
  const payloadResult = buildTransactionPayload();
  if (payloadResult.error) {
    document.getElementById('transaction-errors').textContent = payloadResult.error;
    return;
  }

  try {
    const payload = payloadResult.value;
    if (treasuryState.modal.mode === 'edit' && treasuryState.modal.editingId) {
      await requestJson(`${TREASURY_API_BASE}/transactions/${encodeURIComponent(treasuryState.modal.editingId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await requestJson(`${TREASURY_API_BASE}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    closeModal();
    await refreshAndRender();
  } catch (err) {
    document.getElementById('transaction-errors').textContent = err.message;
  }
}

async function deleteTransaction(transactionId) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await requestJson(`${TREASURY_API_BASE}/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'DELETE'
    });
    await refreshAndRender();
  } catch (err) {
    alert(`Failed to delete transaction: ${err.message}`);
  }
}

async function saveSettings() {
  const settingsError = document.getElementById('settings-error');
  settingsError.textContent = '';

  const patch = {
    patronEnabled: document.getElementById('setting-patron-enabled').checked,
    defaultPatronPercent: Number(document.getElementById('setting-default-patron-percent').value || 0),
    defaultSplitMode: document.getElementById('setting-default-split-mode').value,
    coinValues: {
      pp: Number(document.getElementById('setting-coin-pp').value || 0),
      gp: Number(document.getElementById('setting-coin-gp').value || 0),
      sp: Number(document.getElementById('setting-coin-sp').value || 0),
      cp: Number(document.getElementById('setting-coin-cp').value || 0)
    }
  };

  if (patch.defaultPatronPercent < 0 || patch.defaultPatronPercent > 100) {
    settingsError.textContent = 'Default patron percent must be between 0 and 100.';
    return;
  }

  if (patch.coinValues.pp <= 0 || patch.coinValues.gp <= 0 || patch.coinValues.sp <= 0 || patch.coinValues.cp <= 0) {
    settingsError.textContent = 'Coin conversion values must be positive integers.';
    return;
  }

  try {
    await requestJson(`${TREASURY_API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    await refreshAndRender();
  } catch (err) {
    settingsError.textContent = err.message;
  }
}

function handleTabClick(event) {
  const button = event.target.closest('.tab-btn');
  if (!button) return;
  treasuryState.activeTab = button.dataset.tab || 'wallets';
  renderTabState();
}

function handleLogFilterClick(event) {
  const button = event.target.closest('.filter-btn');
  if (!button) return;
  treasuryState.logFilter = button.dataset.filter || 'all';
  renderLedgerTab();
  syncFilterButtons();
}

function handleLedgerActionClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const transactionId = button.getAttribute('data-id');
  if (!transactionId) return;

  const action = button.getAttribute('data-action');
  if (action === 'edit') {
    openModalForEdit(transactionId);
  } else if (action === 'delete') {
    deleteTransaction(transactionId);
  }
}

function bindStaticEventListeners() {
  document.querySelector('.treasury-tabs').addEventListener('click', handleTabClick);
  document.getElementById('log-filter-group').addEventListener('click', handleLogFilterClick);
  document.getElementById('ledger-body').addEventListener('click', handleLedgerActionClick);

  document.getElementById('btn-add-transaction').addEventListener('click', () => {
    openModalForCreate();
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    saveSettings();
  });

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
  document.getElementById('btn-save-transaction').addEventListener('click', () => {
    saveTransactionFromModal();
  });

  document.getElementById('transaction-modal').addEventListener('click', event => {
    if (event.target.id === 'transaction-modal') {
      closeModal();
    }
  });

  const modalFields = [
    'tx-description',
    'tx-date',
    'tx-type',
    'tx-allocation-mode',
    'tx-pp',
    'tx-gp',
    'tx-sp',
    'tx-cp',
    'tx-session-label',
    'tx-note',
    'tx-patron-cut-enabled',
    'tx-patron-percent',
    'tx-direct-target',
    'tx-equal-include-patron'
  ];

  modalFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const eventName = field.tagName === 'SELECT' || field.type === 'checkbox' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      if (!treasuryState.modal.isOpen) return;
      syncModalFormFromInputs();
      renderModal();
    });
  });

  document.getElementById('equal-recipient-list').addEventListener('change', event => {
    const checkbox = event.target.closest('[data-equal-char]');
    if (!checkbox || !treasuryState.modal.form) return;
    treasuryState.modal.form.equalSelected[checkbox.getAttribute('data-equal-char')] = checkbox.checked;
    renderModal();
  });

  document.getElementById('custom-share-list').addEventListener('click', event => {
    const button = event.target.closest('[data-share-adjust]');
    if (!button || !treasuryState.modal.form) return;
    const target = button.getAttribute('data-share-adjust');
    const delta = Number(button.getAttribute('data-delta') || 0);
    adjustShare(target, delta);
    renderModal();
  });

  document.getElementById('btn-equal-select-all').addEventListener('click', () => {
    if (!treasuryState.modal.form) return;
    setAllEqualRecipients(true);
    renderModal();
  });

  document.getElementById('btn-custom-even').addEventListener('click', () => {
    if (!treasuryState.modal.form) return;
    applyEvenCustomShares();
    renderModal();
  });

  document.getElementById('btn-custom-reset').addEventListener('click', () => {
    if (!treasuryState.modal.form) return;
    resetCustomShares();
    renderModal();
  });

  document.getElementById('btn-custom-select-all').addEventListener('click', () => {
    if (!treasuryState.modal.form) return;
    getSortedActiveCharacters().forEach(character => {
      treasuryState.modal.form.customShares[character.id] = 1;
    });
    renderModal();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindStaticEventListeners();
  await refreshAndRender();
});
