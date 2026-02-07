// Simple JSON file database helpers for Copper Shores
// Provides safe read/write and basic player/character operations

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ players: [] }, null, 2));
  }
}

function readDB() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    // If corrupted, reset to empty DB to avoid crashes
    const empty = { players: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
}

function writeDB(data) {
  // atomic write: write to temp then rename
  const tmpPath = DB_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

function generateId(prefix = '') {
  return (
    prefix +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

// Player helpers
function listPlayers() {
  const db = readDB();
  return db.players;
}

function getPlayer(id) {
  const players = listPlayers();
  return players.find(p => p.id === id) || null;
}

function createPlayer({ name, bio, currentCharacter }) {
  const db = readDB();
  const newPlayer = {
    id: generateId('pl_'),
    name: name || 'Unnamed Player',
    bio: bio || '',
    currentCharacter: currentCharacter || null,
    characters: []
  };
  // If currentCharacter provided, ensure it has an id and add to characters
  if (currentCharacter) {
    const char = Object.assign({}, currentCharacter);
    char.id = char.id || generateId('ch_');
    char.status = char.status || 'active';
    newPlayer.currentCharacter = char;
    newPlayer.characters.push(char);
  }
  db.players.push(newPlayer);
  writeDB(db);
  return newPlayer;
}

function updatePlayer(id, patch) {
  const db = readDB();
  const idx = db.players.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const player = db.players[idx];
  player.name = patch.name !== undefined ? patch.name : player.name;
  player.bio = patch.bio !== undefined ? patch.bio : player.bio;
  // do not allow direct overwrite of characters/currentCharacter here
  db.players[idx] = player;
  writeDB(db);
  return player;
}

function deletePlayer(id) {
  const db = readDB();
  const idx = db.players.findIndex(p => p.id === id);
  if (idx === -1) return false;
  db.players.splice(idx, 1);
  writeDB(db);
  return true;
}

// Character management
function addCharacter(playerId, charObj) {
  const db = readDB();
  const pl = db.players.find(p => p.id === playerId);
  if (!pl) return null;
  const char = Object.assign({}, charObj);
  char.id = char.id || generateId('ch_');
  char.level = Number(char.level) || 1;
  char.status = char.status || 'retired'; // by default added to previous list unless specified
  pl.characters.push(char);
  writeDB(db);
  return char;
}

function updateCharacter(playerId, charId, patch) {
  const db = readDB();
  const pl = db.players.find(p => p.id === playerId);
  if (!pl) return null;
  const char = pl.characters.find(c => c.id === charId);
  if (!char) return null;
  // Update character fields
  if (patch.name !== undefined) char.name = patch.name;
  if (patch.race !== undefined) char.race = patch.race;
  if (patch.className !== undefined) char.className = patch.className;
  if (patch.level !== undefined) char.level = Number(patch.level) || 1;
  if (patch.status !== undefined) char.status = patch.status;
  // If this is current character, update that too
  if (pl.currentCharacter && pl.currentCharacter.id === charId) {
    pl.currentCharacter = char;
  }
  writeDB(db);
  return char;
}

function deleteCharacter(playerId, charId) {
  const db = readDB();
  const pl = db.players.find(p => p.id === playerId);
  if (!pl) return false;
  const idx = pl.characters.findIndex(c => c.id === charId);
  if (idx === -1) return false;
  // If character is currentCharacter, clear it
  if (pl.currentCharacter && pl.currentCharacter.id === charId) {
    pl.currentCharacter = null;
  }
  pl.characters.splice(idx, 1);
  writeDB(db);
  return true;
}

function setCurrentCharacter(playerId, charIdOrObject) {
  const db = readDB();
  const pl = db.players.find(p => p.id === playerId);
  if (!pl) return null;
  let char = null;
  if (typeof charIdOrObject === 'string') {
    char = pl.characters.find(c => c.id === charIdOrObject) || null;
    if (!char) return null;
    // mark as active
    char.status = 'active';
  } else if (typeof charIdOrObject === 'object') {
    char = Object.assign({}, charIdOrObject);
    char.id = char.id || generateId('ch_');
    char.level = Number(char.level) || 1;
    char.status = char.status || 'active';
    // add to characters if not already present
    const exists = pl.characters.find(c => c.id === char.id);
    if (!exists) pl.characters.push(char);
  }
  pl.currentCharacter = char;
  writeDB(db);
  return char;
}

function moveCurrentToPrevious(playerId, status = 'dead') {
  const db = readDB();
  const pl = db.players.find(p => p.id === playerId);
  if (!pl) return null;
  if (!pl.currentCharacter) return null;
  // mark status and ensure it's in characters
  const cur = pl.currentCharacter;
  cur.status = status;
  const exists = pl.characters.find(c => c.id === cur.id);
  if (!exists) pl.characters.push(cur);
  pl.currentCharacter = null;
  writeDB(db);
  return cur;
}

/* -------------------- Notes Helpers -------------------- */

const NOTE_CATEGORIES = {
  pc: 'PC Notes',
  npc: 'NPC Notes',
  event: 'Event Notes',
  enemy: 'Enemy Notes',
  location: 'Location Notes',
  item: 'Item Notes',
  session: 'Session Recaps'
};

function getCategories() {
  return NOTE_CATEGORIES;
}

function listNotes(category) {
  if (!NOTE_CATEGORIES[category]) return null;
  const db = readDB();
  if (!db.notes) db.notes = {};
  if (!db.notes[category]) db.notes[category] = [];
  return db.notes[category];
}

function getNote(category, noteId) {
  const notes = listNotes(category);
  if (!notes) return null;
  return notes.find(n => n.id === noteId) || null;
}

function createNote(category, { title, content, tags }) {
  if (!NOTE_CATEGORIES[category]) return null;
  if (!title || typeof title !== 'string' || title.trim() === '') return null;
  
  const db = readDB();
  if (!db.notes) db.notes = {};
  if (!db.notes[category]) db.notes[category] = [];
  
  const now = new Date().toISOString();
  const newNote = {
    id: generateId('note_'),
    title: title.trim(),
    content: content || '',
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
    createdAt: now,
    updatedAt: now
  };
  
  db.notes[category].push(newNote);
  writeDB(db);
  return newNote;
}

function updateNote(category, noteId, patch) {
  if (!NOTE_CATEGORIES[category]) return null;
  const db = readDB();
  if (!db.notes || !db.notes[category]) return null;
  
  const idx = db.notes[category].findIndex(n => n.id === noteId);
  if (idx === -1) return null;
  
  const note = db.notes[category][idx];
  if (patch.title !== undefined) note.title = patch.title;
  if (patch.content !== undefined) note.content = patch.content;
  if (patch.tags !== undefined) {
    note.tags = Array.isArray(patch.tags) ? patch.tags : (patch.tags ? patch.tags.split(',').map(t => t.trim()) : []);
  }
  note.updatedAt = new Date().toISOString();
  
  db.notes[category][idx] = note;
  writeDB(db);
  return note;
}

function deleteNote(category, noteId) {
  if (!NOTE_CATEGORIES[category]) return false;
  const db = readDB();
  if (!db.notes || !db.notes[category]) return false;
  
  const idx = db.notes[category].findIndex(n => n.id === noteId);
  if (idx === -1) return false;
  
  db.notes[category].splice(idx, 1);
  writeDB(db);
  return true;
}

/* -------------------- Map Helpers -------------------- */

// Map definitions (hardcoded for now)
const MAPS_DEFINITION = [
  {
    id: 'world',
    name: 'World Map',
    imagePath: '/allmaps/coppershores.png'
  },
  {
    id: 'alsita',
    name: 'Alsita',
    imagePath: '/allmaps/Alsita.PNG'
  },
  {
    id: 'tosatina',
    name: 'Tosatina',
    imagePath: '/allmaps/Tosatina.PNG'
  },
  {
    id: 'tormsicle',
    name: 'Tormsicle',
    imagePath: '/allmaps/Tormsicle.png'
  }
];

function getMapsDefinition() {
  return MAPS_DEFINITION;
}

function ensureMapWaypointsStructure() {
  const db = readDB();
  if (!db.mapWaypoints) {
    db.mapWaypoints = {};
    MAPS_DEFINITION.forEach(map => {
      db.mapWaypoints[map.id] = [];
    });
    writeDB(db);
  }
}

function listWaypoints(mapId) {
  ensureMapWaypointsStructure();
  const db = readDB();
  if (!db.mapWaypoints[mapId]) return null;
  return db.mapWaypoints[mapId];
}

function getWaypoint(mapId, waypointId) {
  const waypoints = listWaypoints(mapId);
  if (!waypoints) return null;
  return waypoints.find(w => w.id === waypointId) || null;
}

function createWaypoint(mapId, { x, y, title, note }) {
  const waypoints = listWaypoints(mapId);
  if (!waypoints) return null;
  
  const now = new Date().toISOString();
  const newWaypoint = {
    id: generateId('wp_'),
    mapId: mapId,
    x: Number(x) || 0,
    y: Number(y) || 0,
    title: title || '',
    note: note || '',
    createdAt: now,
    updatedAt: now
  };
  
  const db = readDB();
  db.mapWaypoints[mapId].push(newWaypoint);
  writeDB(db);
  return newWaypoint;
}

function updateWaypoint(mapId, waypointId, patch) {
  const db = readDB();
  const waypoints = db.mapWaypoints[mapId];
  if (!waypoints) return null;
  
  const idx = waypoints.findIndex(w => w.id === waypointId);
  if (idx === -1) return null;
  
  const waypoint = waypoints[idx];
  if (patch.x !== undefined) waypoint.x = Number(patch.x) || 0;
  if (patch.y !== undefined) waypoint.y = Number(patch.y) || 0;
  if (patch.title !== undefined) waypoint.title = patch.title;
  if (patch.note !== undefined) waypoint.note = patch.note;
  waypoint.updatedAt = new Date().toISOString();
  
  db.mapWaypoints[mapId][idx] = waypoint;
  writeDB(db);
  return waypoint;
}

function deleteWaypoint(mapId, waypointId) {
  const db = readDB();
  const waypoints = db.mapWaypoints[mapId];
  if (!waypoints) return false;
  
  const idx = waypoints.findIndex(w => w.id === waypointId);
  if (idx === -1) return false;
  
  waypoints.splice(idx, 1);
  writeDB(db);
  return true;
}

/* -------------------- Gold Treasury Helpers -------------------- */

// Category definitions for loot allocation
const LOOT_CATEGORIES = [
  { id: 'quest', name: 'Quest Reward' },
  { id: 'treasure', name: 'Treasure' },
  { id: 'vendor', name: 'Vendor Sale' },
  { id: 'other', name: 'Other' }
];

// Allocation categories for distribution
const ALLOCATION_CATEGORIES = [
  { id: 'party', name: 'Party Vault' },
  { id: 'patron', name: 'Patron' },
  { id: 'ship', name: 'Ship Fund' },
  { id: 'crew', name: 'Crew Fund' },
  { id: 'player_pool', name: 'Players Pool' },
  { id: 'direct_player', name: 'Direct to Player' }
];

function ensureTreasuryStructure() {
  const db = readDB();
  if (!db.gold) {
    db.gold = {
      lootLog: [],
      allocationsSnapshot: {
        party: 0,
        patron: 0
      },
      settings: {
        allocateToPatron: false,
        patronPercentage: 10
      }
    };
    writeDB(db);
  }
}

function getLootCategories() {
  return LOOT_CATEGORIES;
}

function getAllocationCategories() {
  return ALLOCATION_CATEGORIES;
}

function getTreasurySettings() {
  ensureTreasuryStructure();
  const db = readDB();
  return db.gold.settings;
}

function updateTreasurySettings(patch) {
  const db = readDB();
  if (!db.gold) ensureTreasuryStructure();
  if (patch.allocateToPatron !== undefined) db.gold.settings.allocateToPatron = patch.allocateToPatron;
  if (patch.patronPercentage !== undefined) db.gold.settings.patronPercentage = patch.patronPercentage;
  writeDB(db);
  return db.gold.settings;
}

function listLootLog() {
  ensureTreasuryStructure();
  const db = readDB();
  return db.gold.lootLog || [];
}

function addLootEntry(lootData) {
  const { totalCp, description, category, session, allocations } = lootData;
  
  // Validate inputs
  if (typeof totalCp !== 'number' || totalCp <= 0) return null;
  if (!Array.isArray(allocations) || allocations.length === 0) return null;
  
  // Validate allocations sum to total
  const allocSum = allocations.reduce((sum, a) => sum + (a.amountCp || 0), 0);
  if (allocSum !== totalCp) return null;
  
  const db = readDB();
  if (!db.gold) ensureTreasuryStructure();
  
  const now = new Date().toISOString();
  const entry = {
    id: generateId('loot_'),
    date: now,
    totalCp,
    description: description || '',
    category: category || 'other',
    session: session || null,
    allocations: allocations // Array of { accountId, amountCp, name } - accountId can be "party", "patron", or "character:charId"
  };
  
  db.gold.lootLog.push(entry);
  
  // Update allocations snapshot
  allocations.forEach(alloc => {
    const accountId = alloc.accountId || alloc.recipientId; // Support both field names
    if (!db.gold.allocationsSnapshot[accountId]) {
      db.gold.allocationsSnapshot[accountId] = 0;
    }
    db.gold.allocationsSnapshot[accountId] += alloc.amountCp;
  });
  
  writeDB(db);
  return entry;
}

function deleteLootEntry(lootId) {
  const db = readDB();
  if (!db.gold) return false;
  
  const idx = db.gold.lootLog.findIndex(l => l.id === lootId);
  if (idx === -1) return false;
  
  const entry = db.gold.lootLog[idx];
  
  // Reverse the allocations snapshot
  entry.allocations.forEach(alloc => {
    const accountId = alloc.accountId || alloc.recipientId; // Support both field names
    if (db.gold.allocationsSnapshot[accountId]) {
      db.gold.allocationsSnapshot[accountId] -= alloc.amountCp;
      if (db.gold.allocationsSnapshot[accountId] < 0) {
        db.gold.allocationsSnapshot[accountId] = 0;
      }
    }
  });
  
  db.gold.lootLog.splice(idx, 1);
  writeDB(db);
  return true;
}

function getAllocationsSnapshot() {
  ensureTreasuryStructure();
  const db = readDB();
  return db.gold.allocationsSnapshot;
}

/**
 * Get accounts list for treasury allocations
 * Returns: party, patron, and all players' current characters
 */
function getAccounts() {
  const accounts = [];
  
  // Add fixed accounts
  accounts.push({
    id: 'party',
    name: 'Party Vault',
    displayName: 'Party Vault'
  });
  accounts.push({
    id: 'patron',
    name: 'Patron',
    displayName: 'Patron'
  });
  
  // Add current character accounts for each player
  const players = listPlayers();
  players.forEach(player => {
    if (player.currentCharacter) {
      const char = player.currentCharacter;
      const accountId = `character:${char.id}`;
      const displayName = `${player.name} — ${char.name}`;
      accounts.push({
        id: accountId,
        name: displayName,
        displayName: displayName,
        playerId: player.id,
        characterId: char.id
      });
    }
  });
  
  return accounts;
}

module.exports = {
  readDB,
  writeDB,
  listPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  addCharacter,
  updateCharacter,
  deleteCharacter,
  setCurrentCharacter,
  moveCurrentToPrevious,
  generateId,
  // Notes
  getCategories,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  // Maps
  getMapsDefinition,
  listWaypoints,
  getWaypoint,
  createWaypoint,
  updateWaypoint,
  deleteWaypoint,
  // Treasury (replaces old gold)
  getLootCategories,
  getAllocationCategories,
  getTreasurySettings,
  updateTreasurySettings,
  listLootLog,
  addLootEntry,
  deleteLootEntry,
  getAllocationsSnapshot,
  getAccounts
};
