# 🛠️ Development Notes - Where to Add Features

This document provides guidance on where and how to add real features to each section of the Copper Shores app.

## 📚 Table of Contents

1. [Gold Spending Tracker](#gold-spending-tracker)
2. [Interactive Map](#interactive-map)
3. [Players Management](#players-management)
4. [Campaign Notes](#campaign-notes)
5. [Database Integration](#database-integration)
6. [Advanced Features](#advanced-features)

---

## 💰 Gold Spending Tracker

### What It Will Do
Track party treasury, expenses, income, and member balances.

### Files to Modify

**Backend: `backend/server.js`**
```javascript
// Replace the /api/gold endpoint with:
app.get('/api/gold', (req, res) => {
  // TODO: Fetch from database
  res.json({
    status: 'success',
    data: {
      totalGold: 5000,
      members: [
        { name: 'Aragorn', gold: 1200 },
        { name: 'Legolas', gold: 2300 },
        { name: 'Gimli', gold: 1500 }
      ],
      expenses: [
        { date: '2026-01-15', description: 'Tavern', amount: 50 },
        { date: '2026-01-20', description: 'Equipment', amount: 200 }
      ]
    }
  });
});

// Add endpoints for:
app.post('/api/gold/add'); // Add income
app.post('/api/gold/spend'); // Record expense
app.post('/api/gold/member'); // Add party member
```

**Frontend: `frontend/gold.html` & `frontend/script.js`**

Add to `gold.html`:
```html
<section id="gold-tracker">
    <h2>Party Treasury: <span id="total-gold">-</span> GP</h2>
    <form id="add-expense-form">
        <input type="text" placeholder="Description" required>
        <input type="number" placeholder="Amount" required>
        <button type="submit" class="btn">Record Expense</button>
    </form>
    
    <div id="expenses-list" class="expenses-grid">
        <!-- Populated by JavaScript -->
    </div>
</section>
```

Add to `frontend/script.js`:
```javascript
function loadGoldData() {
    fetch(`${API_BASE_URL}/gold`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-gold').textContent = data.data.totalGold;
            // Render member balances
            // Render expense history
        });
}

function addExpense(description, amount) {
    fetch(`${API_BASE_URL}/gold/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, amount })
    })
    .then(response => response.json())
    .then(data => loadGoldData()); // Refresh list
}
```

### Future Enhancements
- [ ] Category-based expense tracking (Tavern, Equipment, Healing, etc.)
- [ ] Charts showing spending over time (use Chart.js)
- [ ] Per-character gold tracking
- [ ] Automatic splitting of group expenses
- [ ] Loot division calculator
- [ ] Transaction history with search/filter

---

## 🗺️ Interactive Map

### What It Will Do
Allow players to:
- View a campaign map (upload image or use SVG)
- Click to add locations/pins
- Track party position
- Add notes to locations
- See distance between points

### Files to Modify

**Backend: `backend/server.js`**
```javascript
app.get('/api/map', (req, res) => {
  // TODO: Fetch from database
  res.json({
    status: 'success',
    data: {
      map_image_url: '/images/map.png',
      locations: [
        { id: 1, name: 'Tavern', x: 150, y: 200, description: 'Our base' },
        { id: 2, name: 'Dragon Cave', x: 450, y: 100, description: 'Lair of the Red Dragon' }
      ],
      party_position: { x: 150, y: 200 }
    }
  });
});

// Add endpoints for:
app.post('/api/map/location'); // Add new location
app.put('/api/map/party-position'); // Update party position
app.delete('/api/map/location/:id'); // Remove location
```

**Frontend: `frontend/map.html`**

Replace placeholder with:
```html
<section id="map-container">
    <h2>Campaign Map</h2>
    <div id="map-canvas" style="position: relative; border: 2px solid #d4af37;">
        <img id="map-image" src="" alt="Campaign Map" style="max-width: 100%; cursor: crosshair;">
        <!-- Pins will be absolutely positioned here -->
    </div>
    
    <div id="location-form">
        <h3>Add Location</h3>
        <input type="text" id="location-name" placeholder="Location name">
        <textarea id="location-desc" placeholder="Description"></textarea>
        <button onclick="addLocation()" class="btn">Place Pin</button>
    </div>
    
    <div id="locations-list"></div>
</section>
```

**Frontend: `frontend/script.js` additions**

```javascript
let selectedCoords = null;

// Track click on map to get coordinates
function setupMapClickListener() {
    const mapCanvas = document.getElementById('map-canvas');
    mapCanvas.addEventListener('click', function(e) {
        const rect = mapCanvas.getBoundingClientRect();
        selectedCoords = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        console.log('Selected coordinates:', selectedCoords);
    });
}

function addLocation() {
    if (!selectedCoords) {
        alert('Click on the map to select a location first!');
        return;
    }
    
    const name = document.getElementById('location-name').value;
    const description = document.getElementById('location-desc').value;
    
    fetch(`${API_BASE_URL}/map/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            description,
            x: selectedCoords.x,
            y: selectedCoords.y
        })
    })
    .then(response => response.json())
    .then(data => {
        loadMapData();
        document.getElementById('location-name').value = '';
        document.getElementById('location-desc').value = '';
    });
}

function loadMapData() {
    fetch(`${API_BASE_URL}/map`)
        .then(response => response.json())
        .then(data => {
            // Render map image
            // Render location pins at correct coordinates
            // Draw line showing travel distance
        });
}
```

### Recommended Libraries
- **Leaflet.js** - For interactive maps with tiles
- **Fabric.js** - For drawing on canvas
- **Paperback.js** - Canvas drawing
- **Mapbox GL** - Professional mapping

### Future Enhancements
- [ ] Upload custom map images
- [ ] SVG-based vector maps
- [ ] Grid system for tactical encounters
- [ ] Mini-map in corner
- [ ] Distance calculator between locations
- [ ] Weather/season effects on map
- [ ] Fog of war (reveal areas as explored)
- [ ] Connections between locations (roads, paths)

---

## 👥 Players Management

### What It Will Do
- List all party members
- Store character details (race, class, level, stats)
- Track experience points
- Manage inventory
- Display character sheets

### Files to Modify

**Backend: `backend/server.js`**
```javascript
app.get('/api/players', (req, res) => {
  // TODO: Fetch from database
  res.json({
    status: 'success',
    data: {
      players: [
        {
          id: 1,
          name: 'Aragorn',
          player_name: 'Alice',
          race: 'Human',
          class: 'Ranger',
          level: 5,
          experience: 12000,
          hit_points: 45,
          armor_class: 14,
          stats: {
            strength: 16,
            dexterity: 15,
            constitution: 14,
            intelligence: 13,
            wisdom: 16,
            charisma: 12
          },
          inventory: [
            { item: 'Longsword', quantity: 1 },
            { item: 'Arrows', quantity: 20 }
          ]
        }
      ]
    }
  });
});

// Add endpoints for:
app.post('/api/players'); // Add new player
app.put('/api/players/:id'); // Update player
app.delete('/api/players/:id'); // Remove player
app.post('/api/players/:id/level-up'); // Level up
app.post('/api/players/:id/inventory'); // Add to inventory
```

**Frontend: `frontend/players.html`**

Replace placeholder with:
```html
<section id="players-section">
    <h2>Party Members</h2>
    
    <button onclick="showAddPlayerForm()" class="btn">Add Character</button>
    
    <div id="players-grid" class="links-grid">
        <!-- Characters rendered here -->
    </div>
    
    <div id="player-detail" style="display: none;">
        <h3 id="player-name"></h3>
        <div id="player-stats"></div>
        <div id="player-inventory"></div>
    </div>
</section>
```

**Frontend: `frontend/script.js` additions**

```javascript
function loadPlayers() {
    fetch(`${API_BASE_URL}/players`)
        .then(response => response.json())
        .then(data => {
            const grid = document.getElementById('players-grid');
            grid.innerHTML = data.data.players.map(player => `
                <div class="link-card" onclick="showPlayerDetail(${player.id})">
                    <h3>${player.name}</h3>
                    <p>${player.race} ${player.class}</p>
                    <p>Level ${player.level} | XP: ${player.experience}</p>
                    <p>HP: ${player.hit_points}</p>
                </div>
            `).join('');
        });
}

function showPlayerDetail(playerId) {
    fetch(`${API_BASE_URL}/players/${playerId}`)
        .then(response => response.json())
        .then(data => {
            const player = data.data;
            const detail = document.getElementById('player-detail');
            detail.innerHTML = `
                <h3>${player.name} (${player.player_name})</h3>
                <p>${player.race} ${player.class} - Level ${player.level}</p>
                <div id="stats">
                    <p>HP: ${player.hit_points} | AC: ${player.armor_class}</p>
                    <p>STR: ${player.stats.strength} | DEX: ${player.stats.dexterity}</p>
                    <!-- etc -->
                </div>
            `;
            detail.style.display = 'block';
        });
}
```

### Future Enhancements
- [ ] Full D&D 5e character sheet
- [ ] Quick level-up calculator
- [ ] Ability check roller
- [ ] Attack & damage roller
- [ ] Spell list and spell slots
- [ ] Feat and proficiency tracker
- [ ] Character portrait uploads
- [ ] Backstory and notes
- [ ] Integration with D&D Beyond API

---

## 📝 Campaign Notes

### What It Will Do
- Create, edit, delete campaign notes
- Organize notes by category (Quest, NPC, Lore, etc.)
- Tags and search functionality
- Rich text editor
- Timeline of events

### Files to Modify

**Backend: `backend/server.js`**
```javascript
app.get('/api/notes', (req, res) => {
  // TODO: Fetch from database
  res.json({
    status: 'success',
    data: {
      notes: [
        {
          id: 1,
          title: 'The Dragon Attack',
          category: 'Quest',
          content: 'A red dragon attacked the village...',
          tags: ['dragon', 'village', 'combat'],
          created_at: '2026-01-10',
          updated_at: '2026-01-15'
        }
      ]
    }
  });
});

// Add endpoints for:
app.post('/api/notes'); // Create note
app.put('/api/notes/:id'); // Update note
app.delete('/api/notes/:id'); // Delete note
app.get('/api/notes/search'); // Search notes
app.get('/api/notes/by-category/:category'); // Filter by category
```

**Frontend: `frontend/notes.html`**

```html
<section id="notes-section">
    <h2>Campaign Notes</h2>
    
    <div id="notes-toolbar">
        <button onclick="showNewNoteForm()" class="btn">New Note</button>
        <input type="text" id="search-notes" placeholder="Search notes...">
        <select id="category-filter">
            <option value="">All Categories</option>
            <option value="Quest">Quest</option>
            <option value="NPC">NPC</option>
            <option value="Lore">Lore</option>
            <option value="Combat">Combat</option>
            <option value="Other">Other</option>
        </select>
    </div>
    
    <div id="notes-list"></div>
    <div id="note-detail" style="display: none;"></div>
</section>
```

**Frontend: `frontend/script.js` additions**

```javascript
function loadNotes(filter = {}) {
    let url = `${API_BASE_URL}/notes`;
    if (filter.category) url += `?category=${filter.category}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const list = document.getElementById('notes-list');
            list.innerHTML = data.data.notes.map(note => `
                <div class="note-card" onclick="showNoteDetail(${note.id})">
                    <h3>${note.title}</h3>
                    <p class="category">${note.category}</p>
                    <p class="tags">${note.tags.join(', ')}</p>
                    <p class="date">${note.updated_at}</p>
                </div>
            `).join('');
        });
}

function createNote(title, content, category, tags) {
    fetch(`${API_BASE_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category, tags })
    })
    .then(response => response.json())
    .then(data => {
        loadNotes();
        closeNoteForm();
    });
}
```

### Recommended Libraries
- **TinyMCE** - Rich text editor
- **SimpleMDE** - Markdown editor
- **Quill** - Rich text editor
- **Lunr.js** - Full-text search

### Future Enhancements
- [ ] Rich text editor (formatting, images, links)
- [ ] Markdown support
- [ ] Timeline view of events
- [ ] NPC relationship graph
- [ ] Quest tracker with status
- [ ] Collaborative editing (multiple users)
- [ ] File attachments (maps, images)
- [ ] Export notes to PDF
- [ ] Wiki-style linking between notes

---

## 🗄️ Database Integration

### Recommended Database

Choose based on your needs:

#### **SQLite** (Easiest for beginners)
- Great for small projects
- No server setup needed
- Learn SQL fundamentals

```bash
npm install sqlite3
```

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    player_name TEXT,
    class TEXT,
    level INTEGER,
    experience INTEGER
  )`);
});
```

#### **MongoDB** (NoSQL - Flexible)
- Great for rapid development
- Flexible schema
- Popular with Node.js

```bash
npm install mongodb
```

#### **PostgreSQL** (Relational - Scalable)
- Professional production database
- Strong relationships
- Best for complex data

```bash
npm install pg
```

### Example: Add Database to Gold Endpoint

**Before (hardcoded):**
```javascript
app.get('/api/gold', (req, res) => {
  res.json({
    data: { totalGold: 5000 }
  });
});
```

**After (with SQLite):**
```javascript
db.get('SELECT SUM(amount) as total FROM gold_transactions', (err, row) => {
  if (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
  res.json({
    status: 'success',
    data: { totalGold: row.total || 0 }
  });
});
```

---

## 🚀 Advanced Features

### User Authentication
Implement so each campaign has an owner:
- Use **JWT** (json-web-token) for token-based auth
- Hash passwords with **bcryptjs**
- Restrict endpoints to authenticated users

```bash
npm install jsonwebtoken bcryptjs
```

### Real-time Updates
Use **WebSockets** to sync changes across browser tabs:

```bash
npm install socket.io
```

### File Uploads
Allow users to upload character portraits and maps:

```bash
npm install multer
```

### Hosting
- **Vercel** - Free hosting for frontend & backend
- **Heroku** - Simple backend deployment
- **Netlify** - Frontend only
- **DigitalOcean** - More control

---

## 📊 Database Schema Reference

When you add a database, create these tables:

```sql
-- Players Table
CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  name TEXT NOT NULL,
  player_name TEXT,
  race TEXT,
  class TEXT,
  level INTEGER,
  experience INTEGER,
  hit_points INTEGER,
  armor_class INTEGER,
  created_at TIMESTAMP
);

-- Gold Transactions Table
CREATE TABLE gold_transactions (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  type TEXT, -- 'income' or 'expense'
  amount INTEGER,
  description TEXT,
  date TIMESTAMP
);

-- Locations/Map Table
CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  name TEXT,
  description TEXT,
  x INTEGER,
  y INTEGER,
  created_at TIMESTAMP
);

-- Campaign Notes Table
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT, -- Store as JSON
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Campaign Table (Main)
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  user_id INTEGER,
  description TEXT,
  created_at TIMESTAMP
);
```

---

## 🧪 Testing Your Features

### Test in Browser Console
```javascript
// Test API endpoint
fetch('http://localhost:3000/api/gold')
  .then(r => r.json())
  .then(d => console.log(d));
```

### Test with cURL
```bash
curl http://localhost:3000/api/gold
curl -X POST http://localhost:3000/api/gold/spend -H "Content-Type: application/json" -d '{"amount":50}'
```

### Test with Postman
1. Download [Postman](https://www.postman.com/)
2. Create requests for each endpoint
3. Test different parameters
4. Export tests for documentation

---

## 📖 Next Steps

1. **Pick one feature** to build first (recommend starting with Gold Spending)
2. **Add a database** (SQLite is easiest)
3. **Design the data schema** for that feature
4. **Implement backend endpoints** (GET, POST, PUT, DELETE)
5. **Build the frontend UI** 
6. **Test thoroughly** before moving to next feature
7. **Refactor code** as your app grows

Happy building! 🐉
