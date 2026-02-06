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
  generateId
};
