// Postgres database helpers for Copper Shores
// Replaces JSON file storage while preserving the existing backend API behavior.

const { query, withTransaction } = require('./lib/pg');

const NOTE_CATEGORIES = {
  pc: 'PC Notes',
  npc: 'NPC Notes',
  event: 'Event Notes',
  enemy: 'Enemy Notes',
  location: 'Location Notes',
  item: 'Item Notes',
  session: 'Session Recaps'
};

const DEFAULT_MAPS = [
  { id: 'world', name: 'World Map', imagePath: '/allmaps/coppershores.png' },
  { id: 'alsita', name: 'Alsita', imagePath: '/allmaps/Alsita.PNG' },
  { id: 'tosatina', name: 'Tosatina', imagePath: '/allmaps/Tosatina.PNG' },
  { id: 'tormsicle', name: 'Tormsicle', imagePath: '/allmaps/Tormsicle.png' }
];

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

function generateId(prefix = '') {
  return (
    prefix +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}

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

function rowToCharacter(row) {
  if (!row) return null;
  const result = {
    id: row.id,
    name: row.name || '',
    race: row.race || '',
    className: row.class_name || '',
    level: Number(row.level) || 1,
    status: row.status || 'retired'
  };
  if (row.display_order !== null && row.display_order !== undefined) {
    result.displayOrder = Number(row.display_order);
  }
  return result;
}

function rowToPlayer(row, characterRows = []) {
  const characters = characterRows.map(rowToCharacter);
  const currentRow = characterRows.find(char => Boolean(char.is_current));
  const currentCharacter = currentRow ? rowToCharacter(currentRow) : null;
  return {
    id: row.id,
    name: row.name,
    bio: row.bio || '',
    currentCharacter,
    characters
  };
}

function rowToNote(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.body || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function rowToWaypoint(row) {
  return {
    id: row.id,
    mapId: row.map_id,
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    title: row.title || '',
    note: row.note || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

async function mapExists(mapId) {
  const result = await query('SELECT 1 FROM maps WHERE id = $1 LIMIT 1', [mapId]);
  return result.rowCount > 0;
}

async function healthCheck() {
  await query('SELECT 1');
}

async function readDB() {
  throw new Error('readDB is not supported with Postgres storage.');
}

async function writeDB() {
  throw new Error('writeDB is not supported with Postgres storage.');
}

async function listPlayers() {
  const playersRes = await query(
    'SELECT id, name, bio, created_at FROM players ORDER BY created_at ASC, name ASC'
  );
  if (playersRes.rowCount === 0) return [];

  const playerIds = playersRes.rows.map(row => row.id);
  const charsRes = await query(
    `SELECT id, player_id, name, race, class_name, level, status, is_current, display_order, created_at
     FROM characters
     WHERE player_id = ANY($1::text[])
     ORDER BY created_at ASC, name ASC`,
    [playerIds]
  );

  const charsByPlayer = {};
  charsRes.rows.forEach(row => {
    if (!charsByPlayer[row.player_id]) charsByPlayer[row.player_id] = [];
    charsByPlayer[row.player_id].push(row);
  });

  return playersRes.rows.map(row => rowToPlayer(row, charsByPlayer[row.id] || []));
}

async function getPlayer(id) {
  const playerRes = await query(
    'SELECT id, name, bio, created_at FROM players WHERE id = $1',
    [id]
  );
  if (playerRes.rowCount === 0) return null;

  const charsRes = await query(
    `SELECT id, player_id, name, race, class_name, level, status, is_current, display_order, created_at
     FROM characters
     WHERE player_id = $1
     ORDER BY created_at ASC, name ASC`,
    [id]
  );

  return rowToPlayer(playerRes.rows[0], charsRes.rows);
}

async function createPlayer({ name, bio, currentCharacter }) {
  const playerId = generateId('pl_');

  await withTransaction(async client => {
    await client.query(
      'INSERT INTO players (id, name, bio) VALUES ($1, $2, $3)',
      [playerId, name || 'Unnamed Player', bio || '']
    );

    if (currentCharacter && typeof currentCharacter === 'object') {
      const charId = currentCharacter.id || generateId('ch_');
      await client.query(
        `INSERT INTO characters (id, player_id, name, race, class_name, level, status, is_current, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
        [
          charId,
          playerId,
          currentCharacter.name || 'Unnamed Character',
          currentCharacter.race || '',
          currentCharacter.className || currentCharacter.class || '',
          Number(currentCharacter.level) || 1,
          currentCharacter.status || 'active',
          currentCharacter.displayOrder !== undefined ? toInt(currentCharacter.displayOrder, null) : null
        ]
      );
    }
  });

  return getPlayer(playerId);
}

async function updatePlayer(id, patch) {
  const updates = [];
  const params = [];
  let idx = 1;

  if (patch.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(patch.name);
  }
  if (patch.bio !== undefined) {
    updates.push(`bio = $${idx++}`);
    params.push(patch.bio);
  }

  if (updates.length === 0) {
    return getPlayer(id);
  }

  params.push(id);
  const result = await query(
    `UPDATE players SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id`,
    params
  );
  if (result.rowCount === 0) return null;
  return getPlayer(id);
}

async function deletePlayer(id) {
  return withTransaction(async client => {
    const deletedChars = await client.query(
      'DELETE FROM characters WHERE player_id = $1',
      [id]
    );
    const deletedPlayer = await client.query(
      'DELETE FROM players WHERE id = $1',
      [id]
    );
    return deletedPlayer.rowCount > 0 || deletedChars.rowCount > 0;
  });
}

async function addCharacter(playerId, charObj) {
  const characterId = (charObj && charObj.id) || generateId('ch_');

  const result = await withTransaction(async client => {
    const playerExists = await client.query(
      'SELECT id FROM players WHERE id = $1',
      [playerId]
    );
    if (playerExists.rowCount === 0) return null;

    const inserted = await client.query(
      `INSERT INTO characters (id, player_id, name, race, class_name, level, status, is_current, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)
       RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
      [
        characterId,
        playerId,
        (charObj && charObj.name) || 'Unnamed Character',
        (charObj && charObj.race) || '',
        (charObj && (charObj.className || charObj.class)) || '',
        Number(charObj && charObj.level) || 1,
        (charObj && charObj.status) || 'retired',
        charObj && charObj.displayOrder !== undefined ? toInt(charObj.displayOrder, null) : null
      ]
    );

    return inserted.rows[0];
  });

  return result ? rowToCharacter(result) : null;
}

async function updateCharacter(playerId, charId, patch) {
  const updates = [];
  const params = [];
  let idx = 1;

  if (patch.name !== undefined) {
    updates.push(`name = $${idx++}`);
    params.push(patch.name);
  }
  if (patch.race !== undefined) {
    updates.push(`race = $${idx++}`);
    params.push(patch.race);
  }
  if (patch.className !== undefined || patch.class !== undefined) {
    updates.push(`class_name = $${idx++}`);
    params.push(patch.className !== undefined ? patch.className : patch.class);
  }
  if (patch.level !== undefined) {
    updates.push(`level = $${idx++}`);
    params.push(Number(patch.level) || 1);
  }
  if (patch.status !== undefined) {
    updates.push(`status = $${idx++}`);
    params.push(patch.status);
  }
  if (patch.displayOrder !== undefined) {
    updates.push(`display_order = $${idx++}`);
    params.push(toInt(patch.displayOrder, null));
  }

  if (updates.length === 0) {
    const existing = await query(
      `SELECT id, player_id, name, race, class_name, level, status, is_current, display_order, created_at
       FROM characters
       WHERE player_id = $1 AND id = $2`,
      [playerId, charId]
    );
    if (existing.rowCount === 0) return null;
    return rowToCharacter(existing.rows[0]);
  }

  params.push(playerId, charId);
  const result = await query(
    `UPDATE characters
     SET ${updates.join(', ')}
     WHERE player_id = $${idx++} AND id = $${idx}
     RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
    params
  );
  if (result.rowCount === 0) return null;
  return rowToCharacter(result.rows[0]);
}

async function deleteCharacter(playerId, charId) {
  const result = await query(
    'DELETE FROM characters WHERE player_id = $1 AND id = $2 RETURNING id',
    [playerId, charId]
  );
  return result.rowCount > 0;
}

async function setCurrentCharacter(playerId, charIdOrObject) {
  return withTransaction(async client => {
    const playerRes = await client.query(
      'SELECT id FROM players WHERE id = $1',
      [playerId]
    );
    if (playerRes.rowCount === 0) return null;

    await client.query('UPDATE characters SET is_current = FALSE WHERE player_id = $1', [playerId]);

    if (typeof charIdOrObject === 'string') {
      const selected = await client.query(
        `UPDATE characters
         SET is_current = TRUE, status = 'active'
         WHERE player_id = $1 AND id = $2
         RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
        [playerId, charIdOrObject]
      );
      if (selected.rowCount === 0) return null;
      return rowToCharacter(selected.rows[0]);
    }

    if (!charIdOrObject || typeof charIdOrObject !== 'object') return null;

    const charId = charIdOrObject.id || generateId('ch_');
    const existing = await client.query(
      'SELECT id FROM characters WHERE player_id = $1 AND id = $2',
      [playerId, charId]
    );

    let result;
    if (existing.rowCount > 0) {
      result = await client.query(
        `UPDATE characters
         SET name = $3, race = $4, class_name = $5, level = $6, status = $7, is_current = TRUE, display_order = $8
         WHERE player_id = $1 AND id = $2
         RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
        [
          playerId,
          charId,
          charIdOrObject.name || 'Unnamed Character',
          charIdOrObject.race || '',
          charIdOrObject.className || charIdOrObject.class || '',
          Number(charIdOrObject.level) || 1,
          charIdOrObject.status || 'active',
          charIdOrObject.displayOrder !== undefined ? toInt(charIdOrObject.displayOrder, null) : null
        ]
      );
    } else {
      result = await client.query(
        `INSERT INTO characters (id, player_id, name, race, class_name, level, status, is_current, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
         RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
        [
          charId,
          playerId,
          charIdOrObject.name || 'Unnamed Character',
          charIdOrObject.race || '',
          charIdOrObject.className || charIdOrObject.class || '',
          Number(charIdOrObject.level) || 1,
          charIdOrObject.status || 'active',
          charIdOrObject.displayOrder !== undefined ? toInt(charIdOrObject.displayOrder, null) : null
        ]
      );
    }

    return rowToCharacter(result.rows[0]);
  });
}

async function moveCurrentToPrevious(playerId, status = 'dead') {
  const result = await query(
    `UPDATE characters
     SET is_current = FALSE, status = $2
     WHERE player_id = $1 AND is_current = TRUE
     RETURNING id, player_id, name, race, class_name, level, status, is_current, display_order, created_at`,
    [playerId, status]
  );
  if (result.rowCount === 0) return null;
  return rowToCharacter(result.rows[0]);
}

function getCategories() {
  return NOTE_CATEGORIES;
}

async function listNotes(category) {
  if (!NOTE_CATEGORIES[category]) return null;
  const result = await query(
    `SELECT id, category, title, body, tags, created_at, updated_at
     FROM notes
     WHERE category = $1
     ORDER BY created_at DESC, id DESC`,
    [category]
  );
  return result.rows.map(rowToNote);
}

async function getNote(category, noteId) {
  if (!NOTE_CATEGORIES[category]) return null;
  const result = await query(
    `SELECT id, category, title, body, tags, created_at, updated_at
     FROM notes
     WHERE category = $1 AND id = $2`,
    [category, noteId]
  );
  if (result.rowCount === 0) return null;
  return rowToNote(result.rows[0]);
}

async function createNote(category, { title, content, tags }) {
  if (!NOTE_CATEGORIES[category]) return null;
  if (!title || typeof title !== 'string' || title.trim() === '') return null;

  const noteId = generateId('note_');
  const tagsArray = Array.isArray(tags)
    ? tags
    : (tags ? String(tags).split(',').map(tag => tag.trim()) : []);

  const result = await query(
    `INSERT INTO notes (id, category, title, body, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
     RETURNING id, category, title, body, tags, created_at, updated_at`,
    [noteId, category, title.trim(), content || '', JSON.stringify(tagsArray)]
  );

  return rowToNote(result.rows[0]);
}

async function updateNote(category, noteId, patch) {
  if (!NOTE_CATEGORIES[category]) return null;
  const existing = await getNote(category, noteId);
  if (!existing) return null;

  const nextTitle = patch.title !== undefined ? patch.title : existing.title;
  const nextBody = patch.content !== undefined ? patch.content : existing.content;
  const nextTags = patch.tags !== undefined
    ? (Array.isArray(patch.tags)
      ? patch.tags
      : (patch.tags ? String(patch.tags).split(',').map(tag => tag.trim()) : []))
    : existing.tags;

  const result = await query(
    `UPDATE notes
     SET title = $3, body = $4, tags = $5::jsonb, updated_at = NOW()
     WHERE category = $1 AND id = $2
     RETURNING id, category, title, body, tags, created_at, updated_at`,
    [category, noteId, nextTitle, nextBody, JSON.stringify(nextTags)]
  );
  if (result.rowCount === 0) return null;
  return rowToNote(result.rows[0]);
}

async function deleteNote(category, noteId) {
  if (!NOTE_CATEGORIES[category]) return false;
  const result = await query(
    'DELETE FROM notes WHERE category = $1 AND id = $2 RETURNING id',
    [category, noteId]
  );
  return result.rowCount > 0;
}

async function getMapsDefinition() {
  const result = await query(
    `SELECT id, name, image_path
     FROM maps
     ORDER BY
       CASE id
         WHEN 'world' THEN 1
         WHEN 'alsita' THEN 2
         WHEN 'tosatina' THEN 3
         WHEN 'tormsicle' THEN 4
         ELSE 100
       END,
       name ASC`
  );

  if (result.rowCount === 0) return DEFAULT_MAPS;
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    imagePath: row.image_path
  }));
}

async function listWaypoints(mapId) {
  if (!(await mapExists(mapId))) return null;
  const result = await query(
    `SELECT id, map_id, x, y, title, note, created_at, updated_at
     FROM waypoints
     WHERE map_id = $1
     ORDER BY created_at ASC, id ASC`,
    [mapId]
  );
  return result.rows.map(rowToWaypoint);
}

async function getWaypoint(mapId, waypointId) {
  if (!(await mapExists(mapId))) return null;
  const result = await query(
    `SELECT id, map_id, x, y, title, note, created_at, updated_at
     FROM waypoints
     WHERE map_id = $1 AND id = $2`,
    [mapId, waypointId]
  );
  if (result.rowCount === 0) return null;
  return rowToWaypoint(result.rows[0]);
}

async function createWaypoint(mapId, { x, y, title, note }) {
  if (!(await mapExists(mapId))) return null;
  const waypointId = generateId('wp_');
  const result = await query(
    `INSERT INTO waypoints (id, map_id, x, y, title, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, map_id, x, y, title, note, created_at, updated_at`,
    [waypointId, mapId, Number(x) || 0, Number(y) || 0, title || '', note || '']
  );
  return rowToWaypoint(result.rows[0]);
}

async function updateWaypoint(mapId, waypointId, patch) {
  if (!(await mapExists(mapId))) return null;
  const updates = [];
  const params = [];
  let idx = 1;

  if (patch.x !== undefined) {
    updates.push(`x = $${idx++}`);
    params.push(Number(patch.x) || 0);
  }
  if (patch.y !== undefined) {
    updates.push(`y = $${idx++}`);
    params.push(Number(patch.y) || 0);
  }
  if (patch.title !== undefined) {
    updates.push(`title = $${idx++}`);
    params.push(patch.title);
  }
  if (patch.note !== undefined) {
    updates.push(`note = $${idx++}`);
    params.push(patch.note);
  }

  if (updates.length === 0) {
    return getWaypoint(mapId, waypointId);
  }

  updates.push('updated_at = NOW()');
  params.push(mapId, waypointId);

  const result = await query(
    `UPDATE waypoints
     SET ${updates.join(', ')}
     WHERE map_id = $${idx++} AND id = $${idx}
     RETURNING id, map_id, x, y, title, note, created_at, updated_at`,
    params
  );

  if (result.rowCount === 0) return null;
  return rowToWaypoint(result.rows[0]);
}

async function deleteWaypoint(mapId, waypointId) {
  if (!(await mapExists(mapId))) return false;
  const result = await query(
    'DELETE FROM waypoints WHERE map_id = $1 AND id = $2 RETURNING id',
    [mapId, waypointId]
  );
  return result.rowCount > 0;
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

function mapTreasurySettingsRow(row) {
  return normalizeTreasurySettings({
    patronEnabled: row.patron_enabled,
    defaultPatronPercent: row.default_patron_percent,
    defaultSplitMode: row.default_split_mode,
    coinValues: row.coin_values
  });
}

function txRowToNormalizedTransaction(row, settings) {
  return normalizeStoredTransaction({
    id: row.id,
    date: row.date,
    description: row.description || '',
    type: row.type,
    totalCp: row.total_cp,
    inputCoins: row.input_coins,
    allocationMode: row.allocation_mode,
    patronEnabledAtTime: row.patron_enabled_at_time,
    patronPercentAtTime: row.patron_percent_at_time,
    patronCp: row.patron_cp,
    allocations: row.allocations,
    sessionLabel: row.session_label,
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
  }, settings);
}

async function ensureTreasurySettingsRow() {
  const found = await query(
    'SELECT id, patron_enabled, default_patron_percent, default_split_mode, coin_values, updated_at FROM treasury_settings WHERE id = 1'
  );
  if (found.rowCount > 0) return found.rows[0];

  const inserted = await query(
    `INSERT INTO treasury_settings (id, patron_enabled, default_patron_percent, default_split_mode, coin_values)
     VALUES (1, $1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, patron_enabled, default_patron_percent, default_split_mode, coin_values, updated_at`,
    [
      DEFAULT_TREASURY_SETTINGS.patronEnabled,
      DEFAULT_TREASURY_SETTINGS.defaultPatronPercent,
      DEFAULT_TREASURY_SETTINGS.defaultSplitMode,
      JSON.stringify(DEFAULT_TREASURY_SETTINGS.coinValues)
    ]
  );
  if (inserted.rowCount > 0) return inserted.rows[0];

  const fallback = await query(
    'SELECT id, patron_enabled, default_patron_percent, default_split_mode, coin_values, updated_at FROM treasury_settings WHERE id = 1'
  );
  return fallback.rows[0];
}

function buildAccountIdFromAllocation(allocation) {
  if (allocation.targetType === 'patron') return 'patron';
  return allocation.characterId ? `character:${allocation.characterId}` : null;
}

async function getTreasuryCharacters() {
  const players = await listPlayers();
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

async function getTreasurySettings() {
  const row = await ensureTreasurySettingsRow();
  return mapTreasurySettingsRow(row);
}

async function updateTreasurySettings(patch) {
  const current = await getTreasurySettings();
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

  const normalized = normalizeTreasurySettings(updated);
  const result = await query(
    `UPDATE treasury_settings
     SET patron_enabled = $1,
         default_patron_percent = $2,
         default_split_mode = $3,
         coin_values = $4::jsonb,
         updated_at = NOW()
     WHERE id = 1
     RETURNING id, patron_enabled, default_patron_percent, default_split_mode, coin_values, updated_at`,
    [
      normalized.patronEnabled,
      normalized.defaultPatronPercent,
      normalized.defaultSplitMode,
      JSON.stringify(normalized.coinValues)
    ]
  );
  return mapTreasurySettingsRow(result.rows[0]);
}

async function listTreasuryTransactions() {
  const settings = await getTreasurySettings();
  const result = await query(
    `SELECT id, date, description, type, total_cp, input_coins, allocation_mode,
            patron_enabled_at_time, patron_percent_at_time, patron_cp, allocations,
            session_label, note, created_at, updated_at
     FROM treasury_transactions
     ORDER BY date DESC, updated_at DESC, id DESC`
  );

  return result.rows
    .map(row => txRowToNormalizedTransaction(row, settings))
    .filter(Boolean)
    .sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

async function addTreasuryTransaction(payload) {
  const settings = await getTreasurySettings();
  const normalized = normalizeTransactionPayload(payload, null, settings);
  if (normalized.error) return { error: normalized.error };

  const tx = normalized.value;
  await query(
    `INSERT INTO treasury_transactions (
       id, date, description, type, total_cp, input_coins, allocation_mode,
       patron_enabled_at_time, patron_percent_at_time, patron_cp, allocations,
       session_label, note, created_at, updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15
     )`,
    [
      tx.id,
      tx.date,
      tx.description || '',
      tx.type,
      tx.totalCp,
      JSON.stringify(tx.inputCoins || { pp: 0, gp: 0, sp: 0, cp: 0 }),
      tx.allocationMode,
      Boolean(tx.patronEnabledAtTime),
      toInt(tx.patronPercentAtTime, 0),
      toInt(tx.patronCp, 0),
      JSON.stringify(tx.allocations || []),
      tx.sessionLabel || null,
      tx.note || null,
      tx.createdAt || new Date().toISOString(),
      tx.updatedAt || new Date().toISOString()
    ]
  );

  return { transaction: tx };
}

async function updateTreasuryTransaction(id, payload) {
  const settings = await getTreasurySettings();
  const existingRes = await query(
    `SELECT id, date, description, type, total_cp, input_coins, allocation_mode,
            patron_enabled_at_time, patron_percent_at_time, patron_cp, allocations,
            session_label, note, created_at, updated_at
     FROM treasury_transactions
     WHERE id = $1`,
    [id]
  );

  if (existingRes.rowCount === 0) return { error: 'Transaction not found.' };
  const existing = txRowToNormalizedTransaction(existingRes.rows[0], settings);
  if (!existing) return { error: 'Stored transaction is invalid.' };

  const mergedPayload = Object.assign({}, existing, payload || {});
  const normalized = normalizeTransactionPayload(mergedPayload, id, settings);
  if (normalized.error) return { error: normalized.error };
  normalized.value.createdAt = existing.createdAt || normalized.value.createdAt;

  const tx = normalized.value;
  await query(
    `UPDATE treasury_transactions
     SET date = $2,
         description = $3,
         type = $4,
         total_cp = $5,
         input_coins = $6::jsonb,
         allocation_mode = $7,
         patron_enabled_at_time = $8,
         patron_percent_at_time = $9,
         patron_cp = $10,
         allocations = $11::jsonb,
         session_label = $12,
         note = $13,
         created_at = $14,
         updated_at = $15
     WHERE id = $1`,
    [
      id,
      tx.date,
      tx.description || '',
      tx.type,
      tx.totalCp,
      JSON.stringify(tx.inputCoins || { pp: 0, gp: 0, sp: 0, cp: 0 }),
      tx.allocationMode,
      Boolean(tx.patronEnabledAtTime),
      toInt(tx.patronPercentAtTime, 0),
      toInt(tx.patronCp, 0),
      JSON.stringify(tx.allocations || []),
      tx.sessionLabel || null,
      tx.note || null,
      tx.createdAt || new Date().toISOString(),
      tx.updatedAt || new Date().toISOString()
    ]
  );

  return { transaction: tx };
}

async function deleteTreasuryTransaction(id) {
  const result = await query(
    'DELETE FROM treasury_transactions WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
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

async function getTreasuryState() {
  const [settings, transactions, characters] = await Promise.all([
    getTreasurySettings(),
    listTreasuryTransactions(),
    getTreasuryCharacters()
  ]);
  const derived = deriveTreasuryState(transactions, characters);

  return {
    settings,
    characters,
    transactions,
    derived
  };
}

async function getTreasuryAccounts() {
  const characters = (await getTreasuryCharacters()).slice().sort((a, b) => {
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

async function getLegacyWalletSnapshotFromLedger() {
  const state = await getTreasuryState();
  const wallets = {};

  Object.keys(state.derived.characterBalancesCp).forEach(characterId => {
    wallets[`character:${characterId}`] = state.derived.characterBalancesCp[characterId];
  });
  wallets.patron = state.derived.patronBalanceCp;

  return wallets;
}

async function listLegacyLootLogFromTransactions() {
  const transactions = await listTreasuryTransactions();
  return transactions
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

async function listLegacySpendingLogFromTransactions() {
  const transactions = await listTreasuryTransactions();
  return transactions
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
  generateId,
  healthCheck,
  // Players / Characters
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
