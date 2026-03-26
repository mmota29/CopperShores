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

const MAPS_DEFINITION = [
  { id: 'world', name: 'World Map', imagePath: '/allmaps/coppershores.png' },
  { id: 'alsita', name: 'Alsita', imagePath: '/allmaps/Alsita.PNG' },
  { id: 'tosatina', name: 'Tosatina', imagePath: '/allmaps/Tosatina.PNG' },
  { id: 'tormsicle', name: 'Tormsicle', imagePath: '/allmaps/Tormsicle.png' },
  { id: 'pinchester', name: 'Pinchester', imagePath: '/allmaps/Pinchester.PNG' }
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

const ALLOCATION_MODES = new Set(['direct', 'equal_split', 'custom_split']);

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

  const cpDelta = toInt(alloc.cpDelta, 0);
  if (cpDelta === 0) return null;
  if (type === 'income' && cpDelta < 0) return null;
  if (type === 'expense' && cpDelta > 0) return null;

  if (targetType === 'character' && (!alloc.characterId || typeof alloc.characterId !== 'string')) {
    return null;
  }

  const normalized = { targetType, cpDelta };
  if (targetType === 'character') normalized.characterId = alloc.characterId;

  const shareCount = toInt(alloc.shareCount, -1);
  if (shareCount >= 0) normalized.shareCount = shareCount;

  return normalized;
}

function inferAllocationMode(allocations) {
  const characterAllocs = allocations.filter(a => a.targetType === 'character');
  if (characterAllocs.length <= 1) return 'direct';
  const firstValue = characterAllocs[0].cpDelta;
  const isEven = characterAllocs.every(a => a.cpDelta === firstValue);
  return isEven ? 'equal_split' : 'custom_split';
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

  return {
    id: typeof tx.id === 'string' && tx.id ? tx.id : generateId('txn_'),
    date: normalizeDate(tx.date),
    description: typeof tx.description === 'string' ? tx.description.trim() : '',
    type,
    totalCp,
    inputCoins: normalizeInputCoins(tx.inputCoins, totalCp, settings.coinValues),
    allocationMode: ALLOCATION_MODES.has(tx.allocationMode) ? tx.allocationMode : inferAllocationMode(normalizedAllocations),
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
  listLegacySpendingLogFromTransactions
};
