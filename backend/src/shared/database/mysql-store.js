const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATIONS_PATH = path.join(BACKEND_ROOT, 'database', 'migrations', 'mysql');

let pool = null;

function isConfigured() {
  return Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
}

function getConnectionConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  };
}

function getPoolConfig() {
  return {
    ...getConnectionConfig(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0
  };
}

function getPool() {
  if (!isConfigured()) {
    throw new Error('MySQL requires DB_HOST, DB_USER, and DB_NAME.');
  }
  if (!pool) {
    pool = mysql.createPool(getPoolConfig());
  }
  return pool;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;

  try {
    return JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : value);
  } catch {
    return fallback;
  }
}

function json(value, fallback) {
  return JSON.stringify(value === undefined ? fallback : value);
}

async function runMigrations() {
  if (!isConfigured()) return;

  const connection = await mysql.createConnection({
    ...getConnectionConfig(),
    multipleStatements: true
  });

  try {
    const files = (await fs.readdir(MIGRATIONS_PATH))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(MIGRATIONS_PATH, file), 'utf8');
      await connection.query(sql);
    }
  } finally {
    await connection.end();
  }
}

async function hasStoredState(database = getPool()) {
  const [rows] = await database.execute(
    `SELECT metadata_key
     FROM storage_metadata
     WHERE metadata_key = 'initialized'`
  );
  return rows.length > 0;
}

async function loadState(database = getPool()) {
  if (!(await hasStoredState(database))) return null;

  const [
    [playerRows],
    [characterRows],
    [noteRows],
    [waypointRows],
    [treasuryRows],
    [transactionRows],
    [contentRows]
  ] = await Promise.all([
    database.query('SELECT * FROM players ORDER BY sort_order, name'),
    database.query('SELECT * FROM characters ORDER BY player_id, character_scope DESC, sort_order'),
    database.query('SELECT * FROM notes ORDER BY category, sort_order'),
    database.query('SELECT * FROM map_waypoints ORDER BY map_id, sort_order'),
    database.query('SELECT * FROM treasury_config WHERE id = 1'),
    database.query('SELECT * FROM treasury_transactions ORDER BY sort_order'),
    database.query('SELECT * FROM content_entries ORDER BY sort_order')
  ]);

  const charactersByPlayer = new Map();
  for (const row of characterRows) {
    const collection = charactersByPlayer.get(row.player_id) || {
      currentCharacter: null,
      characters: []
    };
    const character = parseJson(row.data, {});
    if (row.character_scope === 'current') {
      collection.currentCharacter = character;
    } else {
      collection.characters.push(character);
    }
    charactersByPlayer.set(row.player_id, collection);
  }

  const players = playerRows.map(row => {
    const characterData = charactersByPlayer.get(row.id) || {
      currentCharacter: null,
      characters: []
    };
    return {
      id: row.id,
      name: row.name,
      bio: row.bio || '',
      currentCharacter: characterData.currentCharacter,
      characters: characterData.characters
    };
  });

  const notes = {};
  for (const row of noteRows) {
    if (!notes[row.category]) notes[row.category] = [];
    notes[row.category].push({
      id: row.id,
      title: row.title,
      content: row.content || '',
      tags: parseJson(row.tags, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  const mapWaypoints = {};
  for (const row of waypointRows) {
    if (!mapWaypoints[row.map_id]) mapWaypoints[row.map_id] = [];
    mapWaypoints[row.map_id].push({
      id: row.id,
      mapId: row.map_id,
      x: Number(row.x),
      y: Number(row.y),
      title: row.title,
      note: row.note || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  let gold = null;
  if (treasuryRows.length) {
    const config = treasuryRows[0];
    gold = {
      version: config.version,
      transactions: transactionRows.map(row => parseJson(row.data, {})),
      settings: parseJson(config.settings, {}),
      migration: parseJson(config.migration_data, {})
    };
  }

  const contentEntries = contentRows.map(row => ({
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary || '',
    content: row.content || '',
    tags: parseJson(row.tags, []),
    details: parseJson(row.details, {}),
    createdByName: row.created_by_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  return { players, notes, mapWaypoints, gold, contentEntries };
}

async function getSnapshot() {
  const connection = await getPool().getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    const state = await loadState(connection);
    await connection.commit();
    return state;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveState(state, { requireEmpty = false } = {}) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    if (requireEmpty) {
      const [rows] = await connection.query(
        `SELECT (
           (SELECT COUNT(*) FROM players) +
           (SELECT COUNT(*) FROM notes) +
           (SELECT COUNT(*) FROM map_waypoints) +
           (SELECT COUNT(*) FROM treasury_transactions) +
           (SELECT COUNT(*) FROM content_entries)
         ) AS record_count`
      );
      if (Number(rows[0].record_count) > 0) {
        const error = new Error('Target database is not empty.');
        error.code = 'TARGET_NOT_EMPTY';
        throw error;
      }
    }

    await connection.query('DELETE FROM content_entries');
    await connection.query('DELETE FROM treasury_transactions');
    await connection.query('DELETE FROM treasury_config');
    await connection.query('DELETE FROM map_waypoints');
    await connection.query('DELETE FROM notes');
    await connection.query('DELETE FROM characters');
    await connection.query('DELETE FROM players');

    for (const [playerIndex, player] of (state.players || []).entries()) {
      await connection.execute(
        `INSERT INTO players (id, sort_order, name, bio)
         VALUES (?, ?, ?, ?)`,
        [player.id, playerIndex, player.name || '', player.bio || '']
      );

      if (player.currentCharacter) {
        await connection.execute(
          `INSERT INTO characters
             (player_id, id, character_scope, sort_order, data)
           VALUES (?, ?, 'current', 0, ?)`,
          [
            player.id,
            player.currentCharacter.id,
            json(player.currentCharacter, {})
          ]
        );
      }

      for (const [characterIndex, character] of (player.characters || []).entries()) {
        await connection.execute(
          `INSERT INTO characters
             (player_id, id, character_scope, sort_order, data)
           VALUES (?, ?, 'history', ?, ?)`,
          [player.id, character.id, characterIndex, json(character, {})]
        );
      }
    }

    for (const [category, categoryNotes] of Object.entries(state.notes || {})) {
      for (const [noteIndex, note] of (categoryNotes || []).entries()) {
        await connection.execute(
          `INSERT INTO notes
             (category, id, sort_order, title, content, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            category,
            note.id,
            noteIndex,
            note.title || '',
            note.content || '',
            json(note.tags, []),
            note.createdAt || null,
            note.updatedAt || null
          ]
        );
      }
    }

    for (const [mapId, waypoints] of Object.entries(state.mapWaypoints || {})) {
      for (const [waypointIndex, waypoint] of (waypoints || []).entries()) {
        await connection.execute(
          `INSERT INTO map_waypoints
             (map_id, id, sort_order, x, y, title, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            mapId,
            waypoint.id,
            waypointIndex,
            waypoint.x,
            waypoint.y,
            waypoint.title || '',
            waypoint.note || '',
            waypoint.createdAt || null,
            waypoint.updatedAt || null
          ]
        );
      }
    }

    if (state.gold) {
      await connection.execute(
        `INSERT INTO treasury_config
           (id, version, settings, migration_data)
         VALUES (1, ?, ?, ?)`,
        [
          state.gold.version || null,
          json(state.gold.settings, {}),
          json(state.gold.migration, {})
        ]
      );

      for (const [transactionIndex, transaction] of (state.gold.transactions || []).entries()) {
        await connection.execute(
          `INSERT INTO treasury_transactions
             (id, sort_order, transaction_date, transaction_type, total_cp, data)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            transaction.id,
            transactionIndex,
            transaction.date || null,
            transaction.type || null,
            Number.isFinite(Number(transaction.totalCp))
              ? Math.trunc(Number(transaction.totalCp))
              : null,
            json(transaction, {})
          ]
        );
      }
    }

    for (const [entryIndex, entry] of (state.contentEntries || []).entries()) {
      await connection.execute(
        `INSERT INTO content_entries
           (id, sort_order, type, title, summary, content, tags, details,
            created_by_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entryIndex,
          entry.type,
          entry.title,
          entry.summary || '',
          entry.content || '',
          json(entry.tags, []),
          json(entry.details, {}),
          entry.createdByName || '',
          entry.createdAt || null,
          entry.updatedAt || null
        ]
      );
    }

    await connection.execute(
      `REPLACE INTO storage_metadata (metadata_key, value_json)
       VALUES ('initialized', JSON_OBJECT('at', NOW(3)))`
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function close() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  isConfigured,
  runMigrations,
  loadState,
  getSnapshot,
  saveState,
  close
};
