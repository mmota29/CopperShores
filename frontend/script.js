// Copper Shores Frontend - Main Script
// Shared UI helpers for homepage and player pages

const API_BASE_URL = '/api';
const TREASURY_API_BASE = `${API_BASE_URL}/treasury`;
const DEFAULT_COIN_VALUES = {
    pp: 1000,
    gp: 100,
    sp: 10,
    cp: 1
};

if ('serviceWorker' in navigator && !window.__CS_SW_REGISTERED) {
    window.__CS_SW_REGISTERED = true;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.warn('Service worker registration failed:', err.message);
        });
    });
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

function normalizeCoinValues(rawCoinValues) {
    const coinValues = rawCoinValues || {};
    return {
        pp: Math.max(1, Number(coinValues.pp) || DEFAULT_COIN_VALUES.pp),
        gp: Math.max(1, Number(coinValues.gp) || DEFAULT_COIN_VALUES.gp),
        sp: Math.max(1, Number(coinValues.sp) || DEFAULT_COIN_VALUES.sp),
        cp: Math.max(1, Number(coinValues.cp) || DEFAULT_COIN_VALUES.cp)
    };
}

function cpToCoins(totalCp, coinValues) {
    const normalizedCoinValues = normalizeCoinValues(coinValues);
    const sign = totalCp < 0 ? -1 : 1;
    let remaining = Math.abs(Math.trunc(Number(totalCp) || 0));

    const pp = Math.floor(remaining / normalizedCoinValues.pp);
    remaining -= pp * normalizedCoinValues.pp;
    const gp = Math.floor(remaining / normalizedCoinValues.gp);
    remaining -= gp * normalizedCoinValues.gp;
    const sp = Math.floor(remaining / normalizedCoinValues.sp);
    remaining -= sp * normalizedCoinValues.sp;
    const cp = Math.floor(remaining / normalizedCoinValues.cp);

    return {
        pp: pp * sign,
        gp: gp * sign,
        sp: sp * sign,
        cp: cp * sign
    };
}

function formatCoins(totalCp, coinValues) {
    const normalizedCoinValues = normalizeCoinValues(coinValues);
    const absolute = Math.abs(Math.trunc(Number(totalCp) || 0));
    const sign = totalCp < 0 ? '-' : '';
    let coins;

    // Keep small and medium totals in gp/sp/cp for readability.
    if (absolute < normalizedCoinValues.pp * 10) {
        let remaining = absolute;
        const gp = Math.floor(remaining / normalizedCoinValues.gp);
        remaining -= gp * normalizedCoinValues.gp;
        const sp = Math.floor(remaining / normalizedCoinValues.sp);
        remaining -= sp * normalizedCoinValues.sp;
        const cp = Math.floor(remaining / normalizedCoinValues.cp);
        coins = { pp: 0, gp, sp, cp };
    } else {
        coins = cpToCoins(absolute, normalizedCoinValues);
    }

    const parts = [];
    if (coins.pp > 0) parts.push(`${coins.pp} pp`);
    if (coins.gp > 0) parts.push(`${coins.gp} gp`);
    if (coins.sp > 0) parts.push(`${coins.sp} sp`);
    if (coins.cp > 0) parts.push(`${coins.cp} cp`);
    return parts.length ? `${sign}${parts.join(', ')}` : '0 cp';
}

function extractActivePartyFromPlayers(players) {
    if (!Array.isArray(players)) return [];

    return players
        .map((player, index) => {
            const currentCharacter = player && player.currentCharacter;
            if (!currentCharacter || !currentCharacter.id) return null;
            if ((currentCharacter.status || 'active') !== 'active') return null;

            return {
                characterId: currentCharacter.id,
                characterName: currentCharacter.name || 'Unnamed Character',
                playerName: player.name || 'Unknown Player',
                race: currentCharacter.race || '',
                className: currentCharacter.className || currentCharacter.class || '',
                level: Number(currentCharacter.level) || null,
                displayOrder: Number(currentCharacter.displayOrder) || index + 1
            };
        })
        .filter(Boolean);
}

function extractActivePartyFromTreasury(characters) {
    if (!Array.isArray(characters)) return [];

    return characters
        .filter(character => character && character.id && character.isActive)
        .map((character, index) => ({
            characterId: character.id,
            characterName: character.characterName || 'Unnamed Character',
            playerName: character.playerName || 'Unknown Player',
            race: '',
            className: '',
            level: null,
            displayOrder: Number(character.displayOrder) || index + 1
        }));
}

function sortPartyEntries(entries) {
    return entries
        .slice()
        .sort((a, b) => {
            const aOrder = Number(a.displayOrder) || 0;
            const bOrder = Number(b.displayOrder) || 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.characterName || '').localeCompare(b.characterName || '');
        });
}

function buildCharacterDetails(entry) {
    const details = [];
    if (entry.race) details.push(entry.race);
    if (entry.className) details.push(entry.className);

    let line = details.join(' ');
    if (entry.level) {
        line = line ? `${line}, Level ${entry.level}` : `Level ${entry.level}`;
    }

    return line;
}

function renderPartyBanner(container, partyEntries) {
    container.innerHTML = '';

    if (!partyEntries.length) {
        container.innerHTML = '<p class="overview-empty">No active characters are assigned right now.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    partyEntries.forEach(entry => {
        const card = document.createElement('article');
        card.className = 'party-entry';

        const characterName = document.createElement('h4');
        characterName.className = 'party-entry-name';
        characterName.textContent = entry.characterName || 'Unnamed Character';

        const playerName = document.createElement('p');
        playerName.className = 'party-entry-player';
        playerName.textContent = `Player: ${entry.playerName || 'Unknown Player'}`;

        card.appendChild(characterName);
        card.appendChild(playerName);

        const details = buildCharacterDetails(entry);
        if (details) {
            const meta = document.createElement('p');
            meta.className = 'party-entry-meta';
            meta.textContent = details;
            card.appendChild(meta);
        }

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

function renderWalletPreview(container, partyEntries, treasuryData) {
    container.innerHTML = '';

    if (!partyEntries.length) {
        container.innerHTML = '<p class="overview-empty">No active characters are assigned right now.</p>';
        return;
    }

    if (!treasuryData) {
        container.innerHTML = '<p class="overview-error">Unable to load party overview right now.</p>';
        return;
    }

    const coinValues = normalizeCoinValues(treasuryData.settings && treasuryData.settings.coinValues);
    const balancesByCharacter = (treasuryData.derived && treasuryData.derived.characterBalancesCp) || {};
    let totalCp = 0;

    const list = document.createElement('div');
    list.className = 'wallet-preview-list';

    partyEntries.forEach(entry => {
        const balanceCp = Math.trunc(Number(balancesByCharacter[entry.characterId]) || 0);
        totalCp += balanceCp;

        const row = document.createElement('div');
        row.className = 'wallet-preview-row';

        const name = document.createElement('span');
        name.className = 'wallet-preview-name';
        name.textContent = entry.characterName || 'Unnamed Character';

        const amount = document.createElement('span');
        amount.className = 'wallet-preview-value';
        amount.textContent = formatCoins(balanceCp, coinValues);

        row.appendChild(name);
        row.appendChild(amount);
        list.appendChild(row);
    });

    const totalRow = document.createElement('div');
    totalRow.className = 'wallet-preview-total';

    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total Party Wealth';

    const totalAmount = document.createElement('strong');
    totalAmount.textContent = formatCoins(totalCp, coinValues);

    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalAmount);

    container.appendChild(list);
    container.appendChild(totalRow);
}

async function loadHomePartyOverview() {
    const partyBannerEl = document.getElementById('party-banner');
    const walletPreviewEl = document.getElementById('wallet-preview');
    if (!partyBannerEl || !walletPreviewEl) return;

    partyBannerEl.innerHTML = '<p class="overview-loading">Gathering adventurers...</p>';
    walletPreviewEl.innerHTML = '<p class="overview-loading">Counting coins...</p>';

    const [playersResult, treasuryResult] = await Promise.allSettled([
        requestJson(`${API_BASE_URL}/players`),
        requestJson(`${TREASURY_API_BASE}/state`)
    ]);

    const treasuryData = treasuryResult.status === 'fulfilled' ? treasuryResult.value : null;
    let partyEntries = [];

    if (playersResult.status === 'fulfilled') {
        partyEntries = extractActivePartyFromPlayers(playersResult.value.players);
    }

    if (!partyEntries.length && treasuryData) {
        partyEntries = extractActivePartyFromTreasury(treasuryData.characters);
    }

    partyEntries = sortPartyEntries(partyEntries);

    if (playersResult.status === 'rejected' && !partyEntries.length) {
        partyBannerEl.innerHTML = '<p class="overview-error">Unable to load party overview right now.</p>';
    } else {
        renderPartyBanner(partyBannerEl, partyEntries);
    }

    if (!treasuryData) {
        walletPreviewEl.innerHTML = '<p class="overview-error">Unable to load party overview right now.</p>';
    } else {
        renderWalletPreview(walletPreviewEl, partyEntries, treasuryData);
    }
}
/**
 * Update active navigation link based on current page
 */
function updateActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        link.classList.remove('active');
        
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
}

/**
 * Initialize the page when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    updateActiveNav();

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'index.html') {
        loadHomePartyOverview();
    } else if (currentPage === 'players.html') {
        initPlayersPage();
    } else if (currentPage === 'player.html') {
        // player.html has its own DOMContentLoaded inline but expose helper
    }
});

/* -------------------- Players Frontend -------------------- */

function initPlayersPage() {
    document.getElementById('add-player-btn').addEventListener('click', () => {
        document.getElementById('add-player-form').style.display = 'block';
    });
    document.getElementById('cancel-add-player').addEventListener('click', () => {
        clearAddPlayerForm();
        document.getElementById('add-player-form').style.display = 'none';
    });
    document.getElementById('submit-add-player').addEventListener('click', submitAddPlayer);
    loadPlayersList();
}

function showMessage(msg, isError) {
    const el = document.getElementById('message') || document.getElementById('player-message');
    if (!el) return;
    el.innerHTML = `<p class="status-message ${isError ? 'error' : 'success'}">${msg}</p>`;
    setTimeout(()=>{ if (el) el.innerHTML=''; }, 4000);
}

function clearAddPlayerForm() {
    ['input-player-name','input-player-bio','input-char-name','input-char-race','input-char-class','input-char-level'].forEach(id=>{
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function truncate(text, n=80) {
    if (!text) return '';
    return text.length > n ? text.slice(0, Math.max(0, n - 3)) + '...' : text;
}

function loadPlayersList() {
    fetch(`${API_BASE_URL}/players`)
        .then(r => r.json())
        .then(resp => {
            if (resp.status !== 'success') { showMessage('Failed to load players', true); return; }
            const tbody = document.getElementById('players-tbody');
            tbody.innerHTML = '';
            const players = resp.data.players || [];
            if (!players.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="3" class="players-empty">No players yet. Add one to get started.</td>';
                tbody.appendChild(tr);
                return;
            }
            players.forEach(p => {
                const tr = document.createElement('tr');
                tr.addEventListener('click', ()=>{ window.location = `player.html?id=${p.id}`; });

                const tdName = document.createElement('td');
                tdName.textContent = p.name;

                const tdChar = document.createElement('td');
                const cur = p.currentCharacter;
                tdChar.textContent = cur ? `${cur.name} (${cur.className||cur.class||''} Lv${cur.level||1})` : '-';

                const tdBio = document.createElement('td');
                tdBio.textContent = truncate(p.bio, 100);

                tr.appendChild(tdName);
                tr.appendChild(tdChar);
                tr.appendChild(tdBio);
                tbody.appendChild(tr);
            });
        })
        .catch(err => { showMessage('Network error loading players', true); });
}

function submitAddPlayer() {
    const name = (document.getElementById('input-player-name')||{}).value || '';
    const bio = (document.getElementById('input-player-bio')||{}).value || '';
    if (!name.trim()) { showMessage('Player name is required', true); return; }
    const charName = (document.getElementById('input-char-name')||{}).value || '';
    const charRace = (document.getElementById('input-char-race')||{}).value || '';
    const charClass = (document.getElementById('input-char-class')||{}).value || '';
    const charLevel = (document.getElementById('input-char-level')||{}).value || 1;

    const payload = { name: name.trim(), bio: bio };
    if (charName.trim()) {
        payload.currentCharacter = { name: charName.trim(), race: charRace.trim(), className: charClass.trim(), level: Number(charLevel)||1 };
    }

    fetch(`${API_BASE_URL}/players`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        .then(r=>r.json())
        .then(resp=>{
            if (resp.status === 'success') {
                showMessage('Player added');
                clearAddPlayerForm();
                document.getElementById('add-player-form').style.display = 'none';
                loadPlayersList();
            } else {
                showMessage(resp.message || 'Failed to add', true);
            }
        })
        .catch(err=>{ showMessage('Network error', true); });
}

/* -------------------- Player Detail Helpers -------------------- */

function loadPlayerDetail(id) {
    fetch(`${API_BASE_URL}/players/${id}`)
        .then(r=>r.json())
        .then(resp=>{
            if (resp.status !== 'success') { showMessage('Player not found', true); return; }
            const p = resp.data;
            window.__CURRENT_PLAYER = p; // Store for editing
            document.getElementById('player-name').textContent = p.name;
            document.getElementById('player-bio').value = p.bio || '';
            renderCurrentCharacter(p);
            renderPreviousCharacters(p);
        })
        .catch(err=>showMessage('Network error', true));
}

function updatePlayerBio(id, bio) {
    fetch(`${API_BASE_URL}/players/${id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ bio }) })
        .then(r=>r.json())
        .then(resp=>{ if (resp.status==='success') showMessage('Bio saved'); else showMessage(resp.message||'Failed to save', true); })
        .catch(err=>showMessage('Network error', true));
}

function renderCurrentCharacter(player) {
    const box = document.getElementById('current-character-box');
    box.innerHTML = '';
    const cur = player.currentCharacter;
    if (!cur) {
        box.innerHTML = '<p class="players-empty">No current character.</p>';
        return;
    }
    const classText = cur.className || cur.class || '';
    const detailParts = [cur.race, classText].filter(Boolean);
    const details = detailParts.length ? `${detailParts.join(' ')} (Level ${cur.level || 1})` : `Level ${cur.level || 1}`;
    box.innerHTML = `
        <div class="current-character-card">
            <strong>${cur.name}</strong>
            <div class="char-meta">${details}</div>
        </div>
    `;
}

function renderPreviousCharacters(player) {
    const list = document.getElementById('previous-characters-list');
    list.innerHTML = '';
    const chars = player.characters || [];
    if (!chars.length) { list.innerHTML = '<p class="players-empty">No previous characters.</p>'; return; }
    chars.forEach(c => {
        const div = document.createElement('div');
        div.className = 'char-row';
        const classText = c.className || c.class || '';
        const detailParts = [c.race, classText].filter(Boolean);
        const details = detailParts.length ? ` - ${detailParts.join(' ')}` : '';
        div.innerHTML = `
            <div>
                <strong>${c.name}</strong>${details} (Lv ${c.level || 1})
                <div class="char-meta">${c.status || ''}</div>
            </div>
            <div class="button-row">
                <button class="btn" onclick="editCharacter('${player.id}','${c.id}')">Edit</button>
                <button class="btn" onclick="setAsCurrent('${player.id}','${c.id}')">Set as Current</button>
                <button class="btn" onclick="removeCharacter('${player.id}','${c.id}')">Remove</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function setAsCurrent(playerId, charId) {
    fetch(`${API_BASE_URL}/players/${playerId}/current`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ characterId: charId }) })
        .then(r=>r.json())
        .then(resp=>{ if (resp.status==='success') loadPlayerDetail(playerId); else showMessage(resp.message||'Failed', true); })
        .catch(err=>showMessage('Network error', true));
}

function removeCharacter(playerId, charId) {
    if (!confirm('Delete this character?')) return;
    fetch(`${API_BASE_URL}/players/${playerId}/characters/${charId}`, { method: 'DELETE' })
        .then(r=>r.json())
        .then(resp=>{ if (resp.status==='success') loadPlayerDetail(playerId); else showMessage(resp.message||'Failed', true); })
        .catch(err=>showMessage('Network error', true));
}

function openAddCharacterForm(setAsCurrent) {
    const id = window.__PLAYER_ID;
    const name = prompt('Character name');
    if (!name) return;
    const race = prompt('Race (optional)') || '';
    const className = prompt('Class (optional)') || '';
    const level = Number(prompt('Level (default 1)') || 1);
    const payload = { name, race, className, level, status: setAsCurrent ? 'active' : 'retired' };
    // First add character
    fetch(`${API_BASE_URL}/players/${id}/characters`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        .then(r=>r.json())
        .then(resp=>{
            if (resp.status === 'success') {
                if (setAsCurrent) {
                    // set current to the returned character
                    fetch(`${API_BASE_URL}/players/${id}/current`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ characterId: resp.data.id }) })
                        .then(()=>loadPlayerDetail(id));
                } else {
                    loadPlayerDetail(id);
                }
            } else {
                showMessage(resp.message||'Failed to add', true);
            }
        })
        .catch(err=>showMessage('Network error', true));
}

function editCharacter(playerId, charId) {
    const player = window.__CURRENT_PLAYER;
    if (!player) return;
    const char = player.characters.find(c => c.id === charId);
    if (!char) return;
    // Populate form
    document.getElementById('edit-char-name').value = char.name || '';
    document.getElementById('edit-char-race').value = char.race || '';
    document.getElementById('edit-char-class').value = char.className || char.class || '';
    document.getElementById('edit-char-level').value = char.level || 1;
    document.getElementById('edit-char-status').value = char.status || 'active';
    // Show modal
    document.getElementById('edit-character-modal').style.display = 'block';
    document.getElementById('edit-modal-overlay').style.display = 'block';
    window.__EDIT_CHAR_ID = charId;
}

function saveEditCharacter(playerId) {
    const charId = window.__EDIT_CHAR_ID;
    if (!charId) { showMessage('No character selected', true); return; }
    if (!playerId) { showMessage('No player selected', true); return; }
    
    const patch = {
        name: document.getElementById('edit-char-name').value,
        race: document.getElementById('edit-char-race').value,
        className: document.getElementById('edit-char-class').value,
        level: Number(document.getElementById('edit-char-level').value) || 1,
        status: document.getElementById('edit-char-status').value
    };
    
    const url = `${API_BASE_URL}/players/${playerId}/characters/${charId}`;
    console.log('Updating character:', { playerId, charId, url, patch });
    
    fetch(url, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(patch) })
        .then(r => {
            console.log('Response status:', r.status);
            return r.json();
        })
        .then(resp=>{
            console.log('Response data:', resp);
            if (resp.status === 'success') {
                showMessage('Character updated');
                closeEditModal();
                loadPlayerDetail(playerId);
            } else {
                showMessage(resp.message || 'Failed to update', true);
            }
        })
        .catch(err=>{ 
            console.error('Fetch error:', err);
            showMessage('Network error: ' + err.message, true);
        });
}


