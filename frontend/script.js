// Copper Shores Frontend - Main Script
// This script demonstrates frontend-backend connection and handles DOM interactions

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Fetch campaign status from the backend when page loads
 * This demonstrates the frontend-backend connection
 */
function loadCampaignStatus() {
    const apiInfoDiv = document.getElementById('api-info');
    if (!apiInfoDiv) return; // Only runs on pages with #api-info (index.html)
    
    // Fetch data from the Gold API endpoint (as an example)
    fetch(`${API_BASE_URL}/gold`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Display the API response on the page
            apiInfoDiv.innerHTML = `
                <p class="success">✓ Backend Connected</p>
                <p class="message"><strong>Message:</strong> ${data.message}</p>
                <p class="message"><strong>Status:</strong> ${data.status}</p>
                <p class="message"><em>API endpoint: GET /api/gold</em></p>
            `;
        })
        .catch(error => {
            console.error('Error fetching campaign data:', error);
            apiInfoDiv.innerHTML = `
                <p style="color: #ff6b6b;"><strong>⚠️ Connection Error</strong></p>
                <p style="color: #ff6b6b;">Unable to reach backend server at ${API_BASE_URL}</p>
                <p style="color: #ffd93d;">Make sure the Node.js server is running on port 3000</p>
            `;
        });
}

/**
 * Setup refresh button to reload campaign status
 */
function setupRefreshButton() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCampaignStatus);
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
    loadCampaignStatus();
    setupRefreshButton();
    // Page-specific initialization
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'players.html') {
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
    el.innerHTML = `<p style="color:${isError? '#ff6b6b':'#90ee90'}">${msg}</p>`;
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
    return text.length > n ? text.slice(0,n-1) + '…' : text;
}

function loadPlayersList() {
    fetch(`${API_BASE_URL}/players`)
        .then(r => r.json())
        .then(resp => {
            if (resp.status !== 'success') { showMessage('Failed to load players', true); return; }
            const tbody = document.getElementById('players-tbody');
            tbody.innerHTML = '';
            resp.data.players.forEach(p => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', ()=>{ window.location = `player.html?id=${p.id}`; });

                const tdName = document.createElement('td');
                tdName.style.padding = '0.75rem';
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
        box.innerHTML = '<p>No current character</p>';
        return;
    }
    box.innerHTML = `
        <div style="background: rgba(0,0,0,0.2); padding:0.75rem; border-radius:6px;">
            <strong>${cur.name}</strong> — ${cur.race || ''} ${cur.className || cur.class || ''} (Level ${cur.level || 1})
        </div>
    `;
}

function renderPreviousCharacters(player) {
    const list = document.getElementById('previous-characters-list');
    list.innerHTML = '';
    const chars = player.characters || [];
    if (!chars.length) { list.innerHTML = '<p>No previous characters</p>'; return; }
    chars.forEach(c => {
        const div = document.createElement('div');
        div.className = 'char-row';
        div.innerHTML = `
            <div>
                <strong>${c.name}</strong> — ${c.race || ''} ${c.className || c.class || ''} (Lv ${c.level || 1})
                <div style="font-size:0.9rem; color:#ccc">${c.status || ''}</div>
            </div>
            <div style="display:flex; gap:0.5rem;">
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

