// Persistent storage helpers for Copper Shores.
// Uses Render/Postgres when DATABASE_URL is configured, with a JSON-file
// fallback for local development.

require('dotenv').config({ quiet: true });
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { Pool } = require('pg');
const mysqlStore = require('./mysql-store');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const DB_PATH = process.env.JSON_DB_PATH || path.join(BACKEND_ROOT, 'data', 'db.json');
const MIGRATIONS_PATH = path.join(BACKEND_ROOT, 'database', 'migrations', 'postgres');
const APP_STATE_KEY = 'main';

const isMySqlEnabled = mysqlStore.isConfigured();
const isPostgresEnabled = !isMySqlEnabled && Boolean(process.env.DATABASE_URL);
let pool = null;

function createEmptyDbState() {
  return { players: [], notes: {}, mapWaypoints: {}, gold: null, contentEntries: [] };
}

let dbCache = null;
let dbInitialized = false;
let persistChain = Promise.resolve();

function getPostgresSslConfig() {
  const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
  const databaseSsl = (process.env.DATABASE_SSL || '').toLowerCase();
  if (sslMode === 'require' || databaseSsl === 'true') {
    return { rejectUnauthorized: false };
  }
  return false;
}

function getPool() {
  if (!isPostgresEnabled) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: getPostgresSslConfig()
    });
  }
  return pool;
}

async function runMigrations() {
  if (!isPostgresEnabled) return;

  const client = getPool();
  const files = (await fsp.readdir(MIGRATIONS_PATH))
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await fsp.readFile(path.join(MIGRATIONS_PATH, file), 'utf8');
    await client.query(sql);
  }
}

async function readJsonSeedState() {
  await ensureDb();
  const raw = await fsp.readFile(DB_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return normalizeDbState(parsed);
  } catch (err) {
    console.warn('Unable to parse db.json seed file:', err.message);
  }
  return createEmptyDbState();
}

function normalizeDbState(state) {
  const normalized = state && typeof state === 'object' ? state : createEmptyDbState();
  if (!Array.isArray(normalized.players)) normalized.players = [];
  if (!normalized.notes || typeof normalized.notes !== 'object') normalized.notes = {};
  if (!normalized.mapWaypoints || typeof normalized.mapWaypoints !== 'object') normalized.mapWaypoints = {};
  if (!Array.isArray(normalized.contentEntries)) normalized.contentEntries = [];
  return normalized;
}

async function ensureDb() {
  const dir = path.dirname(DB_PATH);
  await fsp.mkdir(dir, { recursive: true });

  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(DB_PATH, JSON.stringify(createEmptyDbState(), null, 2), 'utf8');
  }
}

async function initializeDb() {
  if (isMySqlEnabled) {
    await mysqlStore.runMigrations();
    const storedState = await mysqlStore.loadState();

    if (storedState) {
      dbCache = normalizeDbState(storedState);
    } else {
      dbCache = await readJsonSeedState();
      await mysqlStore.saveState(dbCache);
    }

    dbInitialized = true;
    return;
  }

  if (isPostgresEnabled) {
    await runMigrations();

    const result = await getPool().query(
      'SELECT data FROM app_state WHERE key = $1',
      [APP_STATE_KEY]
    );

    if (result.rows.length) {
      dbCache = normalizeDbState(result.rows[0].data);
    } else {
      dbCache = await readJsonSeedState();
      await persistAppStateSnapshot(dbCache);
    }

    await seedContentEntriesFromNotes(dbCache);
    dbInitialized = true;
    return;
  }

  await ensureDb();
  const raw = await fsp.readFile(DB_PATH, 'utf8');

  try {
    dbCache = normalizeDbState(JSON.parse(raw));
  } catch (err) {
    // If corrupted, reset to empty DB to avoid crashes.
    dbCache = createEmptyDbState();
    await fsp.writeFile(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
  }

  dbCache = normalizeDbState(dbCache);

  dbInitialized = true;
}

const dbReadyPromise = initializeDb();

function assertDbInitialized() {
  if (!dbInitialized || !dbCache) {
    throw new Error('Database is not initialized yet.');
  }
}

async function persistAppStateSnapshot(snapshot) {
  const serialized = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  await getPool().query(
    `INSERT INTO app_state (key, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [APP_STATE_KEY, serialized]
  );
}

function queuePersist() {
  const snapshot = JSON.stringify(dbCache, null, 2);

  if (isMySqlEnabled) {
    persistChain = persistChain
      .then(() => mysqlStore.saveState(JSON.parse(snapshot)))
      .catch(err => {
        console.error('Failed to persist MySQL state:', err.message);
      });

    return persistChain;
  }

  if (isPostgresEnabled) {
    persistChain = persistChain
      .then(() => persistAppStateSnapshot(snapshot))
      .catch(err => {
        console.error('Failed to persist app_state:', err.message);
      });

    return persistChain;
  }

  persistChain = persistChain
    .then(async () => {
      const tmpPath = DB_PATH + '.tmp';
      await fsp.writeFile(tmpPath, snapshot, 'utf8');
      await fsp.rename(tmpPath, DB_PATH);
    })
    .catch(err => {
      console.error('Failed to persist db.json:', err.message);
    });

  return persistChain;
}

function readDB() {
  assertDbInitialized();
  return dbCache;
}

function writeDB(data) {
  assertDbInitialized();
  dbCache = data;
  queuePersist();
}

function generateId(prefix = '') {
  return (
    prefix +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

const CONTENT_TYPES = Object.freeze({
  monster: 'Monster',
  npc: 'NPC',
  item: 'Item',
  note: 'Note',
  spell: 'Spell',
  location: 'Location',
  quest: 'Quest',
  lore: 'Lore',
  other: 'Other'
});

function normalizeString(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeTags(tags) {
  const source = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',')
      : [];

  const seen = new Set();
  return source
    .map(tag => normalizeString(tag, 40))
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function normalizeDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const normalized = {};
  Object.entries(details).slice(0, 30).forEach(([rawKey, rawValue]) => {
    const key = normalizeString(rawKey, 40).replace(/[^\w -]/g, '');
    if (!key) return;

    if (typeof rawValue === 'string') {
      normalized[key] = rawValue.trim().slice(0, 2000);
    } else if (typeof rawValue === 'number' || typeof rawValue === 'boolean' || rawValue === null) {
      normalized[key] = rawValue;
    } else if (Array.isArray(rawValue)) {
      normalized[key] = rawValue
        .filter(item => ['string', 'number', 'boolean'].includes(typeof item))
        .slice(0, 30);
    }
  });

  return normalized;
}

function validateContentPayload(payload, existing = {}) {
  const source = payload || {};
  const type = normalizeString(source.type || existing.type || 'note', 30).toLowerCase();
  if (!CONTENT_TYPES[type]) {
    return { error: 'Invalid content type.' };
  }

  const title = normalizeString(
    source.title !== undefined ? source.title : existing.title,
    140
  );
  if (!title) {
    return { error: 'Title is required.' };
  }

  const content = normalizeString(
    source.content !== undefined ? source.content : existing.content,
    20000
  );
  const summary = normalizeString(
    source.summary !== undefined ? source.summary : existing.summary,
    500
  );
  const createdByName = normalizeString(
    source.createdByName !== undefined ? source.createdByName : existing.createdByName,
    80
  );
  const tags = source.tags !== undefined ? normalizeTags(source.tags) : normalizeTags(existing.tags);
  const details = source.details !== undefined ? normalizeDetails(source.details) : normalizeDetails(existing.details);

  return {
    value: {
      type,
      title,
      summary,
      content,
      tags,
      details,
      createdByName
    }
  };
}

function rowToContentEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary || '',
    content: row.content || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    details: row.details && typeof row.details === 'object' ? row.details : {},
    createdByName: row.created_by_name || '',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
  };
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
  if (patch.displayOrder !== undefined) char.displayOrder = Number(patch.displayOrder) || undefined;
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
  session: 'Session Recaps',
  gillcorner: 'Gill corner'
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

const MAPS_DEFINITION = [
  { id: 'world', name: 'World Map', imagePath: '/maps/assets/coppershores.png' },
  { id: 'alsita', name: 'Alsita', imagePath: '/maps/assets/Alsita.PNG' },
  { id: 'tosatina', name: 'Tosatina', imagePath: '/maps/assets/Tosatina.PNG' },
  { id: 'tormsicle', name: 'Tormsicle', imagePath: '/maps/assets/Tormsicle.png' },
  { id: 'pinchester', name: 'Pinchester', imagePath: '/maps/assets/Pinchester.PNG' }
];

function getMapsDefinition() {
  return MAPS_DEFINITION;
}

function ensureMapWaypointsStructure() {
  const db = readDB();
  let shouldWrite = false;

  if (!db.mapWaypoints || typeof db.mapWaypoints !== 'object') {
    db.mapWaypoints = {};
    shouldWrite = true;
  }

  // Backfill newly added maps without removing existing waypoint data.
  MAPS_DEFINITION.forEach(map => {
    if (!Array.isArray(db.mapWaypoints[map.id])) {
      db.mapWaypoints[map.id] = [];
      shouldWrite = true;
    }
  });

  if (shouldWrite) {
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
    mapId,
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

/* -------------------- Treasury Helpers -------------------- */

const DEFAULT_COIN_VALUES = Object.freeze({
  pp: 1000,
  gp: 100,
  sp: 10,
  cp: 1
});

const DEFAULT_TREASURY_SETTINGS = Object.freeze({
  patronEnabled: false,
  defaultPatronPercent: 10,
  defaultSplitMode: 'equal_split',
  coinValues: DEFAULT_COIN_VALUES
});

const ALLOCATION_MODES = new Set(['direct', 'equal_split', 'custom_split', 'percentage_split']);
const PERCENT_SCALE = 100;
const PERCENT_TOTAL_BASIS_POINTS = 100 * PERCENT_SCALE;

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.trunc(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizePercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * PERCENT_SCALE) / PERCENT_SCALE;
}

function percentToBasisPoints(value) {
  const parsed = normalizePercent(value);
  if (parsed === null) return null;
  return Math.round(parsed * PERCENT_SCALE);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDate(value) {
  if (!value || typeof value !== 'string') return todayIsoDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return todayIsoDate();
  return value.slice(0, 10);
}

function normalizeCoinValues(coinValues) {
  const raw = coinValues || {};
  return {
    pp: clampInt(raw.pp, 1, Number.MAX_SAFE_INTEGER, DEFAULT_COIN_VALUES.pp),
    gp: clampInt(raw.gp, 1, Number.MAX_SAFE_INTEGER, DEFAULT_COIN_VALUES.gp),
    sp: clampInt(raw.sp, 1, Number.MAX_SAFE_INTEGER, DEFAULT_COIN_VALUES.sp),
    cp: clampInt(raw.cp, 1, Number.MAX_SAFE_INTEGER, DEFAULT_COIN_VALUES.cp)
  };
}

function normalizeTreasurySettings(settings) {
  const raw = settings || {};
  const defaultSplitMode = ALLOCATION_MODES.has(raw.defaultSplitMode)
    ? raw.defaultSplitMode
    : DEFAULT_TREASURY_SETTINGS.defaultSplitMode;

  return {
    patronEnabled: Boolean(
      raw.patronEnabled !== undefined ? raw.patronEnabled : raw.allocateToPatron
    ),
    defaultPatronPercent: clampInt(
      raw.defaultPatronPercent !== undefined ? raw.defaultPatronPercent : raw.patronPercentage,
      0,
      100,
      DEFAULT_TREASURY_SETTINGS.defaultPatronPercent
    ),
    defaultSplitMode,
    coinValues: normalizeCoinValues(raw.coinValues)
  };
}

function coinsToCp(coins, coinValues = DEFAULT_COIN_VALUES) {
  const pp = toInt(coins && coins.pp, 0);
  const gp = toInt(coins && coins.gp, 0);
  const sp = toInt(coins && coins.sp, 0);
  const cp = toInt(coins && coins.cp, 0);
  return (
    pp * coinValues.pp +
    gp * coinValues.gp +
    sp * coinValues.sp +
    cp * coinValues.cp
  );
}

function cpToCoins(totalCp, coinValues = DEFAULT_COIN_VALUES) {
  const sign = totalCp < 0 ? -1 : 1;
  let remaining = Math.abs(toInt(totalCp, 0));
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

function formatCoins(totalCp, coinValues = DEFAULT_COIN_VALUES) {
  const sign = totalCp < 0 ? '-' : '';
  const absolute = Math.abs(toInt(totalCp, 0));
  let coinBreakdown;

  // Keep small/medium totals in gp/sp/cp for readability.
  if (absolute < coinValues.pp * 10) {
    let remaining = absolute;
    const gp = Math.floor(remaining / coinValues.gp);
    remaining -= gp * coinValues.gp;
    const sp = Math.floor(remaining / coinValues.sp);
    remaining -= sp * coinValues.sp;
    const cp = Math.floor(remaining / coinValues.cp);
    coinBreakdown = { pp: 0, gp, sp, cp };
  } else {
    coinBreakdown = cpToCoins(absolute, coinValues);
  }

  const parts = [];
  if (coinBreakdown.pp > 0) parts.push(`${coinBreakdown.pp} pp`);
  if (coinBreakdown.gp > 0) parts.push(`${coinBreakdown.gp} gp`);
  if (coinBreakdown.sp > 0) parts.push(`${coinBreakdown.sp} sp`);
  if (coinBreakdown.cp > 0) parts.push(`${coinBreakdown.cp} cp`);
  return parts.length === 0 ? '0 cp' : `${sign}${parts.join(', ')}`;
}

function getTreasuryCharacters() {
  const players = listPlayers();
  const characters = [];

  players.forEach((player, index) => {
    const currentCharacter = player.currentCharacter;
    if (!currentCharacter || !currentCharacter.id) return;

    const derivedOrder = clampInt(
      currentCharacter.displayOrder,
      1,
      Number.MAX_SAFE_INTEGER,
      index + 1
    );

    characters.push({
      id: currentCharacter.id,
      characterName: currentCharacter.name || 'Unnamed Character',
      playerName: player.name || 'Unknown Player',
      isActive: (currentCharacter.status || 'active') === 'active',
      displayOrder: derivedOrder
    });
  });

  return characters.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.characterName.localeCompare(b.characterName);
  });
}

function normalizeAllocation(alloc, type) {
  if (!alloc || typeof alloc !== 'object') return null;

  const targetType =
    alloc.targetType === 'patron'
      ? 'patron'
      : alloc.targetType === 'character'
        ? 'character'
        : null;
  if (!targetType) return null;

  const allocationPercent = normalizePercent(
    alloc.allocationPercent !== undefined ? alloc.allocationPercent : alloc.percent
  );

  const cpDelta = toInt(alloc.cpDelta, 0);
  if (cpDelta === 0 && allocationPercent === null) return null;
  if (type === 'income' && cpDelta < 0) return null;
  if (type === 'expense' && cpDelta > 0) return null;

  if (targetType === 'character' && (!alloc.characterId || typeof alloc.characterId !== 'string')) {
    return null;
  }

  const normalized = { targetType, cpDelta };
  if (targetType === 'character') normalized.characterId = alloc.characterId;

  const shareCount = toInt(alloc.shareCount, -1);
  if (shareCount >= 0) normalized.shareCount = shareCount;

  if (allocationPercent !== null) normalized.allocationPercent = allocationPercent;

  return normalized;
}

function inferAllocationMode(allocations) {
  const percentAllocs = allocations.filter(a => a.allocationPercent !== undefined);
  const percentTotal = percentAllocs.reduce((sum, alloc) => {
    const basisPoints = percentToBasisPoints(alloc.allocationPercent);
    return sum + (basisPoints === null ? 0 : basisPoints);
  }, 0);
  if (percentAllocs.length > 0 && percentTotal === PERCENT_TOTAL_BASIS_POINTS) {
    return 'percentage_split';
  }

  const characterAllocs = allocations.filter(a => a.targetType === 'character');
  if (characterAllocs.length <= 1) return 'direct';
  const firstValue = characterAllocs[0].cpDelta;
  const isEven = characterAllocs.every(a => a.cpDelta === firstValue);
  return isEven ? 'equal_split' : 'custom_split';
}

function validatePercentageSplitAllocations(allocations, type) {
  const percentageAllocations = allocations.filter(alloc => (
    alloc.allocationPercent !== undefined ||
    type === 'expense' ||
    alloc.targetType === 'character'
  ));

  if (percentageAllocations.length === 0) {
    return 'Percentage split requires at least one percentage allocation.';
  }

  let totalBasisPoints = 0;
  for (const alloc of percentageAllocations) {
    const basisPoints = percentToBasisPoints(alloc.allocationPercent);
    if (basisPoints === null) {
      return 'Percentage split allocations must include percentages between 0 and 100.';
    }
    totalBasisPoints += basisPoints;
  }

  if (totalBasisPoints !== PERCENT_TOTAL_BASIS_POINTS) {
    return `Percentage split must total 100%. Current total is ${totalBasisPoints / PERCENT_SCALE}%.`;
  }

  return null;
}

function normalizeInputCoins(inputCoins, totalCp, coinValues) {
  if (inputCoins && typeof inputCoins === 'object') {
    return {
      pp: Math.max(0, toInt(inputCoins.pp, 0)),
      gp: Math.max(0, toInt(inputCoins.gp, 0)),
      sp: Math.max(0, toInt(inputCoins.sp, 0)),
      cp: Math.max(0, toInt(inputCoins.cp, 0))
    };
  }

  const fromTotal = cpToCoins(totalCp, coinValues);
  return {
    pp: Math.max(0, fromTotal.pp),
    gp: Math.max(0, fromTotal.gp),
    sp: Math.max(0, fromTotal.sp),
    cp: Math.max(0, fromTotal.cp)
  };
}

function normalizeTransactionPayload(payload, existingId = null, settings = DEFAULT_TREASURY_SETTINGS) {
  const source = payload || {};
  const type = source.type === 'expense' ? 'expense' : source.type === 'income' ? 'income' : null;
  if (!type) return { error: 'Transaction type must be income or expense.' };

  const totalCp = toInt(source.totalCp, 0);
  if (totalCp <= 0) return { error: 'Total amount must be greater than 0 cp.' };

  if (!Array.isArray(source.allocations) || source.allocations.length === 0) {
    return { error: 'At least one allocation is required.' };
  }

  const normalizedAllocations = source.allocations
    .map(alloc => normalizeAllocation(alloc, type))
    .filter(Boolean);
  if (normalizedAllocations.length === 0) {
    return { error: 'No valid allocations were provided.' };
  }

  const allocationTotal = normalizedAllocations.reduce((sum, alloc) => sum + alloc.cpDelta, 0);
  const expectedTotal = type === 'income' ? totalCp : -totalCp;
  if (allocationTotal !== expectedTotal) {
    return { error: `Allocation total ${allocationTotal} cp does not match expected ${expectedTotal} cp.` };
  }

  const allocationMode = ALLOCATION_MODES.has(source.allocationMode)
    ? source.allocationMode
    : inferAllocationMode(normalizedAllocations);

  if (allocationMode === 'percentage_split') {
    const percentageError = validatePercentageSplitAllocations(normalizedAllocations, type);
    if (percentageError) return { error: percentageError };
  }

  const patronCp = normalizedAllocations
    .filter(alloc => alloc.targetType === 'patron' && alloc.cpDelta > 0)
    .reduce((sum, alloc) => sum + alloc.cpDelta, 0);

  const nowIso = new Date().toISOString();
  const note = typeof source.note === 'string' ? source.note.trim() : '';
  const sessionLabel = typeof source.sessionLabel === 'string' ? source.sessionLabel.trim() : '';
  const date = normalizeDate(source.date);

  return {
    value: {
      id: existingId || (typeof source.id === 'string' && source.id ? source.id : generateId('txn_')),
      date,
      description: typeof source.description === 'string' ? source.description.trim() : '',
      type,
      totalCp,
      inputCoins: normalizeInputCoins(source.inputCoins, totalCp, settings.coinValues),
      allocationMode,
      patronEnabledAtTime: Boolean(source.patronEnabledAtTime),
      patronPercentAtTime: clampInt(source.patronPercentAtTime, 0, 100, 0),
      patronCp,
      allocations: normalizedAllocations,
      sessionLabel: sessionLabel || undefined,
      note: note || undefined,
      createdAt: existingId ? (source.createdAt || nowIso) : nowIso,
      updatedAt: nowIso
    }
  };
}

function buildAccountIdFromAllocation(allocation) {
  if (allocation.targetType === 'patron') return 'patron';
  return allocation.characterId ? `character:${allocation.characterId}` : null;
}

function normalizeStoredTransaction(tx, settings) {
  if (!tx || typeof tx !== 'object') return null;

  const type = tx.type === 'expense' ? 'expense' : tx.type === 'income' ? 'income' : null;
  if (!type) return null;
  if (!Array.isArray(tx.allocations) || tx.allocations.length === 0) return null;

  const normalizedAllocations = tx.allocations
    .map(alloc => normalizeAllocation(alloc, type))
    .filter(Boolean);
  if (normalizedAllocations.length === 0) return null;

  const allocationTotal = normalizedAllocations.reduce((sum, alloc) => sum + alloc.cpDelta, 0);
  if (allocationTotal === 0) return null;

  const inferredTotalCp = Math.abs(allocationTotal);
  const totalCp = toInt(tx.totalCp, inferredTotalCp) > 0 ? toInt(tx.totalCp, inferredTotalCp) : inferredTotalCp;
  const expected = type === 'income' ? totalCp : -totalCp;
  if (allocationTotal !== expected) return null;

  const allocationMode = ALLOCATION_MODES.has(tx.allocationMode)
    ? tx.allocationMode
    : inferAllocationMode(normalizedAllocations);
  if (allocationMode === 'percentage_split' && validatePercentageSplitAllocations(normalizedAllocations, type)) {
    return null;
  }

  return {
    id: typeof tx.id === 'string' && tx.id ? tx.id : generateId('txn_'),
    date: normalizeDate(tx.date),
    description: typeof tx.description === 'string' ? tx.description.trim() : '',
    type,
    totalCp,
    inputCoins: normalizeInputCoins(tx.inputCoins, totalCp, settings.coinValues),
    allocationMode,
    patronEnabledAtTime: Boolean(tx.patronEnabledAtTime),
    patronPercentAtTime: clampInt(tx.patronPercentAtTime, 0, 100, 0),
    patronCp: normalizedAllocations
      .filter(alloc => alloc.targetType === 'patron' && alloc.cpDelta > 0)
      .reduce((sum, alloc) => sum + alloc.cpDelta, 0),
    allocations: normalizedAllocations,
    sessionLabel: typeof tx.sessionLabel === 'string' && tx.sessionLabel.trim() ? tx.sessionLabel.trim() : undefined,
    note: typeof tx.note === 'string' && tx.note.trim() ? tx.note.trim() : undefined,
    createdAt: typeof tx.createdAt === 'string' ? tx.createdAt : new Date().toISOString(),
    updatedAt: typeof tx.updatedAt === 'string' ? tx.updatedAt : new Date().toISOString()
  };
}

function ensureUniqueId(preferredId, seenIds) {
  const base = preferredId || generateId('txn_');
  if (!seenIds.has(base)) {
    seenIds.add(base);
    return base;
  }
  let counter = 1;
  while (seenIds.has(`${base}_${counter}`)) counter += 1;
  const next = `${base}_${counter}`;
  seenIds.add(next);
  return next;
}

function convertLegacyAllocation(accountId, amountCp, isExpense) {
  const rawAmount = toInt(amountCp, 0);
  if (rawAmount <= 0) return null;
  const cpDelta = isExpense ? -rawAmount : rawAmount;

  if (accountId === 'patron') {
    return { targetType: 'patron', cpDelta };
  }
  if (typeof accountId === 'string' && accountId.startsWith('character:')) {
    return {
      targetType: 'character',
      characterId: accountId.slice('character:'.length),
      shareCount: 1,
      cpDelta
    };
  }
  return null;
}

function migrateLegacyGold(legacyGold, normalizedSettings) {
  const skipped = [];
  const seenIds = new Set();
  const transactions = [];
  let legacyPartyVaultDetected = false;

  const legacyLootLog = Array.isArray(legacyGold.lootLog) ? legacyGold.lootLog : [];
  legacyLootLog.forEach((entry, index) => {
    const allocations = [];
    let ignoredPartyCp = 0;

    const rawAllocations = Array.isArray(entry.allocations) ? entry.allocations : [];
    rawAllocations.forEach(rawAlloc => {
      const accountId = rawAlloc.accountId || rawAlloc.recipientId;
      if (accountId === 'party') {
        ignoredPartyCp += Math.max(0, toInt(rawAlloc.amountCp, 0));
        return;
      }
      const converted = convertLegacyAllocation(accountId, rawAlloc.amountCp, false);
      if (converted) allocations.push(converted);
    });

    if (ignoredPartyCp > 0) legacyPartyVaultDetected = true;
    if (allocations.length === 0) {
      skipped.push({
        source: 'lootLog',
        legacyId: entry.id || `loot_${index + 1}`,
        reason: ignoredPartyCp > 0
          ? 'Only Party Vault allocations were present and were omitted.'
          : 'No usable allocations were found.'
      });
      return;
    }

    const allocationTotal = allocations.reduce((sum, alloc) => sum + alloc.cpDelta, 0);
    const patronCp = allocations
      .filter(alloc => alloc.targetType === 'patron' && alloc.cpDelta > 0)
      .reduce((sum, alloc) => sum + alloc.cpDelta, 0);

    const noteParts = ['Migrated from legacy loot log entry.'];
    if (ignoredPartyCp > 0) noteParts.push(`Ignored legacy Party Vault portion: ${ignoredPartyCp} cp.`);
    if (entry.category) noteParts.push(`Legacy category: ${entry.category}.`);

    transactions.push({
      id: ensureUniqueId(entry.id || generateId('txn_'), seenIds),
      date: normalizeDate(entry.date),
      description: typeof entry.description === 'string' ? entry.description : '',
      type: 'income',
      totalCp: allocationTotal,
      inputCoins: normalizeInputCoins(null, allocationTotal, normalizedSettings.coinValues),
      allocationMode: inferAllocationMode(allocations),
      patronEnabledAtTime: patronCp > 0,
      patronPercentAtTime: clampInt(
        legacyGold.settings && legacyGold.settings.patronPercentage,
        0,
        100,
        normalizedSettings.defaultPatronPercent
      ),
      patronCp,
      allocations,
      sessionLabel: entry.session ? `Session ${entry.session}` : undefined,
      note: noteParts.join(' '),
      createdAt: typeof entry.date === 'string' ? entry.date : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  const legacySpendingLog = Array.isArray(legacyGold.spendingLog) ? legacyGold.spendingLog : [];
  legacySpendingLog.forEach((entry, index) => {
    const accountId = entry.accountId;
    if (accountId === 'party') {
      legacyPartyVaultDetected = true;
      skipped.push({
        source: 'spendingLog',
        legacyId: entry.id || `spending_${index + 1}`,
        reason: 'Legacy Party Vault spending was omitted during migration.'
      });
      return;
    }

    const allocation = convertLegacyAllocation(accountId, entry.amountCp, true);
    if (!allocation) {
      skipped.push({
        source: 'spendingLog',
        legacyId: entry.id || `spending_${index + 1}`,
        reason: 'No usable account mapping was found.'
      });
      return;
    }

    const totalCp = Math.abs(allocation.cpDelta);
    const noteParts = ['Migrated from legacy spending log entry.'];
    if (entry.category) noteParts.push(`Legacy category: ${entry.category}.`);

    transactions.push({
      id: ensureUniqueId(entry.id || generateId('txn_'), seenIds),
      date: normalizeDate(entry.date),
      description: typeof entry.description === 'string' ? entry.description : '',
      type: 'expense',
      totalCp,
      inputCoins: normalizeInputCoins(null, totalCp, normalizedSettings.coinValues),
      allocationMode: 'direct',
      patronEnabledAtTime: false,
      patronPercentAtTime: 0,
      patronCp: 0,
      allocations: [allocation],
      note: noteParts.join(' '),
      createdAt: typeof entry.date === 'string' ? entry.date : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  return {
    transactions,
    skipped,
    legacyPartyVaultDetected
  };
}

function deriveTreasuryState(transactions, characters) {
  const characterBalancesCp = {};
  characters.forEach(char => {
    characterBalancesCp[char.id] = 0;
  });

  let patronBalanceCp = 0;
  let totalSpentThisSessionCp = 0;

  transactions.forEach(transaction => {
    if (transaction.type === 'expense') {
      totalSpentThisSessionCp += transaction.totalCp;
    }

    transaction.allocations.forEach(allocation => {
      if (allocation.targetType === 'patron') {
        patronBalanceCp += allocation.cpDelta;
        return;
      }
      if (allocation.targetType === 'character' && allocation.characterId) {
        if (characterBalancesCp[allocation.characterId] === undefined) {
          characterBalancesCp[allocation.characterId] = 0;
        }
        characterBalancesCp[allocation.characterId] += allocation.cpDelta;
      }
    });
  });

  const combinedPartyWealthCp = characters
    .filter(char => char.isActive)
    .reduce((sum, char) => sum + (characterBalancesCp[char.id] || 0), 0);

  return {
    characterBalancesCp,
    patronBalanceCp,
    combinedPartyWealthCp,
    totalSpentThisSessionCp
  };
}

function createEmptyTreasuryRoot() {
  return {
    version: 2,
    transactions: [],
    settings: normalizeTreasurySettings(DEFAULT_TREASURY_SETTINGS),
    migration: {
      migratedAt: new Date().toISOString(),
      skippedLegacyEntries: [],
      skippedCount: 0,
      legacyPartyVaultDetected: false
    }
  };
}

function ensureTreasuryStructure() {
  const db = readDB();
  let changed = false;

  if (!db.gold || typeof db.gold !== 'object') {
    db.gold = createEmptyTreasuryRoot();
    changed = true;
  } else {
    const hasLegacyShape =
      Array.isArray(db.gold.lootLog) ||
      Array.isArray(db.gold.spendingLog) ||
      db.gold.allocationsSnapshot !== undefined;

    if (hasLegacyShape || !Array.isArray(db.gold.transactions)) {
      const normalizedSettings = normalizeTreasurySettings(db.gold.settings);
      const migration = migrateLegacyGold(db.gold, normalizedSettings);
      db.gold = {
        version: 2,
        transactions: migration.transactions,
        settings: normalizedSettings,
        migration: {
          migratedAt: new Date().toISOString(),
          skippedLegacyEntries: migration.skipped,
          skippedCount: migration.skipped.length,
          legacyPartyVaultDetected: migration.legacyPartyVaultDetected
        }
      };
      changed = true;
    } else {
      const normalizedSettings = normalizeTreasurySettings(db.gold.settings);
      const normalizedTransactions = db.gold.transactions
        .map(tx => normalizeStoredTransaction(tx, normalizedSettings))
        .filter(Boolean);

      if (JSON.stringify(normalizedSettings) !== JSON.stringify(db.gold.settings)) {
        db.gold.settings = normalizedSettings;
        changed = true;
      }
      if (JSON.stringify(normalizedTransactions) !== JSON.stringify(db.gold.transactions)) {
        db.gold.transactions = normalizedTransactions;
        changed = true;
      }
      if (db.gold.version !== 2) {
        db.gold.version = 2;
        changed = true;
      }
      if (!db.gold.migration || typeof db.gold.migration !== 'object') {
        db.gold.migration = {
          migratedAt: new Date().toISOString(),
          skippedLegacyEntries: [],
          skippedCount: 0,
          legacyPartyVaultDetected: false
        };
        changed = true;
      }
    }
  }

  if (changed) {
    writeDB(db);
  }
}

function getTreasurySettings() {
  ensureTreasuryStructure();
  const db = readDB();
  return normalizeTreasurySettings(db.gold.settings);
}

function updateTreasurySettings(patch) {
  ensureTreasuryStructure();
  const db = readDB();
  const current = normalizeTreasurySettings(db.gold.settings);
  const source = patch || {};

  const updated = {
    patronEnabled: source.patronEnabled !== undefined ? Boolean(source.patronEnabled) : current.patronEnabled,
    defaultPatronPercent: source.defaultPatronPercent !== undefined
      ? clampInt(source.defaultPatronPercent, 0, 100, current.defaultPatronPercent)
      : current.defaultPatronPercent,
    defaultSplitMode: ALLOCATION_MODES.has(source.defaultSplitMode)
      ? source.defaultSplitMode
      : current.defaultSplitMode,
    coinValues: normalizeCoinValues(source.coinValues || current.coinValues)
  };

  db.gold.settings = normalizeTreasurySettings(updated);
  writeDB(db);
  return db.gold.settings;
}

function listTreasuryTransactions() {
  ensureTreasuryStructure();
  const db = readDB();
  const settings = normalizeTreasurySettings(db.gold.settings);

  return (db.gold.transactions || [])
    .map(tx => normalizeStoredTransaction(tx, settings))
    .filter(Boolean)
    .sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

function addTreasuryTransaction(payload) {
  ensureTreasuryStructure();
  const db = readDB();
  const settings = normalizeTreasurySettings(db.gold.settings);
  const normalized = normalizeTransactionPayload(payload, null, settings);
  if (normalized.error) return { error: normalized.error };

  db.gold.transactions.push(normalized.value);
  writeDB(db);
  return { transaction: normalized.value };
}

function updateTreasuryTransaction(id, payload) {
  ensureTreasuryStructure();
  const db = readDB();
  const idx = (db.gold.transactions || []).findIndex(tx => tx.id === id);
  if (idx === -1) return { error: 'Transaction not found.' };

  const existing = db.gold.transactions[idx];
  const settings = normalizeTreasurySettings(db.gold.settings);
  const mergedPayload = Object.assign({}, existing, payload || {});
  const normalized = normalizeTransactionPayload(mergedPayload, id, settings);
  if (normalized.error) return { error: normalized.error };
  normalized.value.createdAt = existing.createdAt || normalized.value.createdAt;

  db.gold.transactions[idx] = normalized.value;
  writeDB(db);
  return { transaction: normalized.value };
}

function deleteTreasuryTransaction(id) {
  ensureTreasuryStructure();
  const db = readDB();
  const idx = (db.gold.transactions || []).findIndex(tx => tx.id === id);
  if (idx === -1) return false;
  db.gold.transactions.splice(idx, 1);
  writeDB(db);
  return true;
}

function getTreasuryState() {
  const settings = getTreasurySettings();
  const transactions = listTreasuryTransactions();
  const characters = getTreasuryCharacters();
  const derived = deriveTreasuryState(transactions, characters);

  return {
    settings,
    characters,
    transactions,
    derived
  };
}

function getTreasuryAccounts() {
  const characters = getTreasuryCharacters().slice().sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.characterName.localeCompare(b.characterName);
  });

  const accounts = characters.map(char => ({
    id: `character:${char.id}`,
    characterId: char.id,
    displayName: `${char.characterName} - Player: ${char.playerName}`,
    targetType: 'character'
  }));

  accounts.push({
    id: 'patron',
    displayName: 'Patron Fund',
    targetType: 'patron'
  });

  return accounts;
}

function getLegacyWalletSnapshotFromLedger() {
  const state = getTreasuryState();
  const wallets = {};

  Object.keys(state.derived.characterBalancesCp).forEach(characterId => {
    wallets[`character:${characterId}`] = state.derived.characterBalancesCp[characterId];
  });
  wallets.patron = state.derived.patronBalanceCp;

  return wallets;
}

function listLegacyLootLogFromTransactions() {
  return listTreasuryTransactions()
    .filter(tx => tx.type === 'income')
    .map(tx => ({
      id: tx.id,
      date: tx.date,
      totalCp: tx.totalCp,
      description: tx.description,
      session: tx.sessionLabel || null,
      allocations: tx.allocations
        .filter(alloc => alloc.cpDelta > 0)
        .map(alloc => ({
          accountId: buildAccountIdFromAllocation(alloc),
          amountCp: alloc.cpDelta
        }))
    }));
}

function listLegacySpendingLogFromTransactions() {
  return listTreasuryTransactions()
    .filter(tx => tx.type === 'expense')
    .map(tx => {
      const first = tx.allocations[0];
      return {
        id: tx.id,
        date: tx.date,
        accountId: buildAccountIdFromAllocation(first),
        amountCp: Math.abs(first.cpDelta),
        description: tx.description
      };
    });
}

function noteCategoryToContentType(category) {
  if (category === 'npc') return 'npc';
  if (category === 'item') return 'item';
  if (category === 'location') return 'location';
  if (category === 'enemy') return 'monster';
  return 'note';
}

async function seedContentEntriesFromNotes(state) {
  if (!isPostgresEnabled) return { inserted: 0 };

  const countResult = await getPool().query('SELECT COUNT(*)::int AS count FROM content_entries');
  if (countResult.rows[0].count > 0) return { inserted: 0 };

  const notesRoot = state.notes || {};
  let inserted = 0;

  for (const [category, notes] of Object.entries(notesRoot)) {
    if (!Array.isArray(notes)) continue;

    for (const note of notes) {
      if (!note || !note.title) continue;
      const normalized = validateContentPayload({
        type: noteCategoryToContentType(category),
        title: note.title,
        summary: '',
        content: note.content || '',
        tags: note.tags || [],
        details: { source: 'campaign_notes', category },
        createdByName: ''
      });
      if (normalized.error) continue;

      await getPool().query(
        `INSERT INTO content_entries (
          id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
        [
          note.id || generateId('entry_'),
          normalized.value.type,
          normalized.value.title,
          normalized.value.summary,
          normalized.value.content,
          normalized.value.tags,
          JSON.stringify(normalized.value.details),
          normalized.value.createdByName,
          note.createdAt || new Date().toISOString(),
          note.updatedAt || note.createdAt || new Date().toISOString()
        ]
      );
      inserted += 1;
    }
  }

  return { inserted };
}

async function seedFromJson({ force = false } = {}) {
  if (isMySqlEnabled) {
    if (!force && (await mysqlStore.loadState())) {
      return {
        message: 'MySQL already contains Copper Shores data. Use npm run seed -- --force to overwrite it from db.json.'
      };
    }

    const state = await readJsonSeedState();
    await mysqlStore.saveState(state);
    dbCache = state;
    dbInitialized = true;
    return { message: 'Seeded MySQL feature tables from db.json.' };
  }

  if (!isPostgresEnabled) {
    return { message: 'DATABASE_URL is not configured; local JSON fallback is already active.' };
  }

  const existing = await getPool().query('SELECT key FROM app_state WHERE key = $1', [APP_STATE_KEY]);
  if (existing.rows.length && !force) {
    await seedContentEntriesFromNotes(dbCache || (await readJsonSeedState()));
    return { message: 'Postgres already has app_state. Use npm run seed -- --force to overwrite it from db.json.' };
  }

  const state = await readJsonSeedState();
  await persistAppStateSnapshot(state);
  dbCache = state;
  dbInitialized = true;
  const seeded = await seedContentEntriesFromNotes(state);
  return { message: `Seeded app_state from db.json and inserted ${seeded.inserted} content entries.` };
}

function getContentTypes() {
  return CONTENT_TYPES;
}

async function listContentEntries(filters = {}) {
  if (!isPostgresEnabled) {
    const db = readDB();
    const entries = Array.isArray(db.contentEntries) ? db.contentEntries : [];
    return entries
      .filter(entry => !filters.type || entry.type === filters.type)
      .filter(entry => {
        if (!filters.q) return true;
        const needle = filters.q.toLowerCase();
        return [entry.title, entry.summary, entry.content, ...(entry.tags || [])]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  const params = [];
  const clauses = [];
  const type = normalizeString(filters.type, 30).toLowerCase();
  const q = normalizeString(filters.q, 120);
  const tag = normalizeString(filters.tag, 40);

  if (type && CONTENT_TYPES[type]) {
    params.push(type);
    clauses.push(`type = $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(title ILIKE $${params.length} OR summary ILIKE $${params.length} OR content ILIKE $${params.length})`);
  }

  if (tag) {
    params.push(tag);
    clauses.push(`tags @> ARRAY[$${params.length}]::TEXT[]`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await getPool().query(
    `SELECT id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at
     FROM content_entries
     ${where}
     ORDER BY updated_at DESC, title ASC
     LIMIT 500`,
    params
  );
  return result.rows.map(rowToContentEntry);
}

async function getContentEntry(id) {
  if (!id) return null;
  if (!isPostgresEnabled) {
    const db = readDB();
    const entries = Array.isArray(db.contentEntries) ? db.contentEntries : [];
    return entries.find(entry => entry.id === id) || null;
  }

  const result = await getPool().query(
    `SELECT id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at
     FROM content_entries
     WHERE id = $1`,
    [id]
  );
  return rowToContentEntry(result.rows[0]);
}

async function createContentEntry(payload) {
  const normalized = validateContentPayload(payload);
  if (normalized.error) return { error: normalized.error };

  const now = new Date().toISOString();
  const entry = {
    id: generateId('entry_'),
    ...normalized.value,
    createdAt: now,
    updatedAt: now
  };

  if (!isPostgresEnabled) {
    const db = readDB();
    if (!Array.isArray(db.contentEntries)) db.contentEntries = [];
    db.contentEntries.push(entry);
    writeDB(db);
    await flushWrites();
    return { entry };
  }

  const result = await getPool().query(
    `INSERT INTO content_entries (
      id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
    RETURNING id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at`,
    [
      entry.id,
      entry.type,
      entry.title,
      entry.summary,
      entry.content,
      entry.tags,
      JSON.stringify(entry.details),
      entry.createdByName,
      entry.createdAt,
      entry.updatedAt
    ]
  );
  return { entry: rowToContentEntry(result.rows[0]) };
}

async function updateContentEntry(id, payload) {
  const existing = await getContentEntry(id);
  if (!existing) return { error: 'Content entry not found.' };

  const normalized = validateContentPayload(payload, existing);
  if (normalized.error) return { error: normalized.error };

  if (!isPostgresEnabled) {
    const db = readDB();
    const entries = Array.isArray(db.contentEntries) ? db.contentEntries : [];
    const idx = entries.findIndex(entry => entry.id === id);
    if (idx === -1) return { error: 'Content entry not found.' };
    entries[idx] = {
      ...existing,
      ...normalized.value,
      updatedAt: new Date().toISOString()
    };
    db.contentEntries = entries;
    writeDB(db);
    await flushWrites();
    return { entry: entries[idx] };
  }

  const result = await getPool().query(
    `UPDATE content_entries
     SET type = $2,
         title = $3,
         summary = $4,
         content = $5,
         tags = $6,
         details = $7::jsonb,
         created_by_name = $8,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, type, title, summary, content, tags, details, created_by_name, created_at, updated_at`,
    [
      id,
      normalized.value.type,
      normalized.value.title,
      normalized.value.summary,
      normalized.value.content,
      normalized.value.tags,
      JSON.stringify(normalized.value.details),
      normalized.value.createdByName
    ]
  );
  return { entry: rowToContentEntry(result.rows[0]) };
}

async function deleteContentEntry(id) {
  if (!id) return false;
  if (!isPostgresEnabled) {
    const db = readDB();
    const entries = Array.isArray(db.contentEntries) ? db.contentEntries : [];
    const idx = entries.findIndex(entry => entry.id === id);
    if (idx === -1) return false;
    entries.splice(idx, 1);
    db.contentEntries = entries;
    writeDB(db);
    await flushWrites();
    return true;
  }

  const result = await getPool().query('DELETE FROM content_entries WHERE id = $1', [id]);
  return result.rowCount > 0;
}

function ready() {
  return dbReadyPromise;
}

function flushWrites() {
  return persistChain;
}

function getStorageMode() {
  if (isMySqlEnabled) return 'mysql';
  return isPostgresEnabled ? 'postgres' : 'json-file';
}

async function close() {
  await flushWrites();
  await mysqlStore.close();
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  ready,
  close,
  flushWrites,
  seedFromJson,
  getStorageMode,
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
  // Treasury
  coinsToCp,
  cpToCoins,
  formatCoins,
  getTreasuryCharacters,
  getTreasurySettings,
  updateTreasurySettings,
  listTreasuryTransactions,
  addTreasuryTransaction,
  updateTreasuryTransaction,
  deleteTreasuryTransaction,
  deriveTreasuryState,
  getTreasuryState,
  getTreasuryAccounts,
  getLegacyWalletSnapshotFromLedger,
  listLegacyLootLogFromTransactions,
  listLegacySpendingLogFromTransactions,
  // User-generated content library
  getContentTypes,
  listContentEntries,
  getContentEntry,
  createContentEntry,
  updateContentEntry,
  deleteContentEntry
};
