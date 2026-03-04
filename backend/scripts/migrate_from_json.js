const fs = require('fs');
const path = require('path');

const { query, withTransaction, assertDatabaseUrl } = require('../lib/pg');

const JSON_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const INIT_SQL_PATH = path.join(__dirname, '..', 'sql', 'init.sql');

const DEFAULT_MAPS = [
  { id: 'world', name: 'World Map', image_path: '/allmaps/coppershores.png' },
  { id: 'alsita', name: 'Alsita', image_path: '/allmaps/Alsita.PNG' },
  { id: 'tosatina', name: 'Tosatina', image_path: '/allmaps/Tosatina.PNG' },
  { id: 'tormsicle', name: 'Tormsicle', image_path: '/allmaps/Tormsicle.png' }
];

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toDateOnly(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (tags === undefined || tags === null) return [];
  return String(tags)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

async function ensureSchema() {
  const sql = fs.readFileSync(INIT_SQL_PATH, 'utf8');
  await query(sql);
}

function collectCharacters(players) {
  const byId = new Map();

  (players || []).forEach(player => {
    const playerId = player.id;
    const chars = Array.isArray(player.characters) ? player.characters : [];
    const current = player.currentCharacter && player.currentCharacter.id ? player.currentCharacter : null;

    chars.forEach(char => {
      if (!char || !char.id) return;
      const existing = byId.get(char.id) || {};
      byId.set(char.id, {
        id: char.id,
        player_id: playerId || existing.player_id || null,
        name: char.name || existing.name || 'Unnamed Character',
        race: char.race || existing.race || '',
        class_name: char.className || char.class || existing.class_name || '',
        level: Number(char.level) || existing.level || 1,
        status: char.status || existing.status || 'retired',
        is_current: Boolean(existing.is_current),
        display_order: char.displayOrder !== undefined ? toInt(char.displayOrder, null) : (existing.display_order ?? null),
        created_at: toIso(char.createdAt || existing.created_at)
      });
    });

    if (current) {
      const existing = byId.get(current.id) || {};
      byId.set(current.id, {
        id: current.id,
        player_id: playerId || existing.player_id || null,
        name: current.name || existing.name || 'Unnamed Character',
        race: current.race || existing.race || '',
        class_name: current.className || current.class || existing.class_name || '',
        level: Number(current.level) || existing.level || 1,
        status: current.status || 'active',
        is_current: true,
        display_order: current.displayOrder !== undefined ? toInt(current.displayOrder, null) : (existing.display_order ?? null),
        created_at: toIso(current.createdAt || existing.created_at)
      });
    }
  });

  return Array.from(byId.values());
}

async function migrateData(data) {
  const counts = {
    players: 0,
    characters: 0,
    notes: 0,
    loot_log: 0,
    maps: 0,
    waypoints: 0,
    treasury_transactions: 0
  };

  await withTransaction(async client => {
    const players = Array.isArray(data.players) ? data.players : [];
    for (const player of players) {
      if (!player || !player.id) continue;
      const inserted = await client.query(
        `INSERT INTO players (id, name, bio, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [player.id, player.name || 'Unnamed Player', player.bio || '', toIso(player.createdAt)]
      );
      counts.players += inserted.rowCount;
    }

    const characters = collectCharacters(players);
    for (const char of characters) {
      if (!char.id) continue;
      const inserted = await client.query(
        `INSERT INTO characters (
           id, player_id, name, race, class_name, level, status, is_current, display_order, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          char.id,
          char.player_id,
          char.name,
          char.race,
          char.class_name,
          Number(char.level) || 1,
          char.status || 'retired',
          Boolean(char.is_current),
          char.display_order,
          toIso(char.created_at)
        ]
      );
      counts.characters += inserted.rowCount;
    }

    const notes = data.notes && typeof data.notes === 'object' ? data.notes : {};
    const categories = Object.keys(notes);
    for (const category of categories) {
      const list = Array.isArray(notes[category]) ? notes[category] : [];
      for (const note of list) {
        if (!note || !note.id) continue;
        const inserted = await client.query(
          `INSERT INTO notes (id, category, title, body, tags, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            note.id,
            category,
            note.title || '',
            note.content || '',
            JSON.stringify(normalizeTags(note.tags)),
            toIso(note.createdAt),
            toIso(note.updatedAt || note.createdAt)
          ]
        );
        counts.notes += inserted.rowCount;
      }
    }

    const lootLog = data.gold && Array.isArray(data.gold.lootLog) ? data.gold.lootLog : [];
    for (const item of lootLog) {
      if (!item || !item.id) continue;
      const inputCoins = item.inputCoins || {};
      const recipients = Array.isArray(item.allocations) ? item.allocations : [];
      const inserted = await client.query(
        `INSERT INTO loot_log (id, date, description, category, pp, gp, sp, cp, recipients, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          toDateOnly(item.date),
          item.description || '',
          item.category || null,
          toInt(inputCoins.pp, 0),
          toInt(inputCoins.gp, 0),
          toInt(inputCoins.sp, 0),
          toInt(inputCoins.cp, 0),
          JSON.stringify(recipients),
          toIso(item.createdAt || item.date)
        ]
      );
      counts.loot_log += inserted.rowCount;
    }

    const mapsById = new Map();
    DEFAULT_MAPS.forEach(map => mapsById.set(map.id, map));
    const mapWaypoints = data.mapWaypoints && typeof data.mapWaypoints === 'object' ? data.mapWaypoints : {};
    Object.keys(mapWaypoints).forEach(mapId => {
      if (!mapsById.has(mapId)) {
        mapsById.set(mapId, {
          id: mapId,
          name: mapId.charAt(0).toUpperCase() + mapId.slice(1),
          image_path: `/allmaps/${mapId}.png`
        });
      }
    });

    for (const map of mapsById.values()) {
      const inserted = await client.query(
        `INSERT INTO maps (id, name, image_path)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [map.id, map.name, map.image_path]
      );
      counts.maps += inserted.rowCount;
    }

    for (const mapId of Object.keys(mapWaypoints)) {
      const list = Array.isArray(mapWaypoints[mapId]) ? mapWaypoints[mapId] : [];
      for (const wp of list) {
        if (!wp || !wp.id) continue;
        const inserted = await client.query(
          `INSERT INTO waypoints (id, map_id, x, y, title, note, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            wp.id,
            mapId,
            toInt(wp.x, 0),
            toInt(wp.y, 0),
            wp.title || '',
            wp.note || '',
            toIso(wp.createdAt),
            toIso(wp.updatedAt || wp.createdAt)
          ]
        );
        counts.waypoints += inserted.rowCount;
      }
    }

    const settings = data.gold && data.gold.settings ? data.gold.settings : null;
    if (settings) {
      await client.query(
        `INSERT INTO treasury_settings (
           id, patron_enabled, default_patron_percent, default_split_mode, coin_values, updated_at
         )
         VALUES (1, $1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           patron_enabled = EXCLUDED.patron_enabled,
           default_patron_percent = EXCLUDED.default_patron_percent,
           default_split_mode = EXCLUDED.default_split_mode,
           coin_values = EXCLUDED.coin_values,
           updated_at = NOW()`,
        [
          Boolean(settings.patronEnabled),
          toInt(settings.defaultPatronPercent, 10),
          settings.defaultSplitMode || 'equal_split',
          JSON.stringify(settings.coinValues || { pp: 1000, gp: 100, sp: 10, cp: 1 })
        ]
      );
    }

    const treasuryTransactions = data.gold && Array.isArray(data.gold.transactions)
      ? data.gold.transactions
      : [];
    for (const tx of treasuryTransactions) {
      if (!tx || !tx.id) continue;
      const inserted = await client.query(
        `INSERT INTO treasury_transactions (
           id, date, description, type, total_cp, input_coins, allocation_mode,
           patron_enabled_at_time, patron_percent_at_time, patron_cp, allocations,
           session_label, note, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          tx.id,
          toDateOnly(tx.date) || toDateOnly(tx.createdAt),
          tx.description || '',
          tx.type || 'income',
          toInt(tx.totalCp, 0),
          JSON.stringify(tx.inputCoins || { pp: 0, gp: 0, sp: 0, cp: 0 }),
          tx.allocationMode || 'direct',
          Boolean(tx.patronEnabledAtTime),
          toInt(tx.patronPercentAtTime, 0),
          toInt(tx.patronCp, 0),
          JSON.stringify(Array.isArray(tx.allocations) ? tx.allocations : []),
          tx.sessionLabel || null,
          tx.note || null,
          toIso(tx.createdAt),
          toIso(tx.updatedAt || tx.createdAt)
        ]
      );
      counts.treasury_transactions += inserted.rowCount;
    }
  });

  return counts;
}

async function run() {
  assertDatabaseUrl();
  await ensureSchema();

  if (!fs.existsSync(JSON_DB_PATH)) {
    console.log(`No JSON file found at ${JSON_DB_PATH}. Nothing to migrate.`);
    return;
  }

  const data = parseJsonFile(JSON_DB_PATH);
  const counts = await migrateData(data);

  console.log('JSON migration complete.');
  console.log(JSON.stringify(counts, null, 2));
}

run().catch(err => {
  console.error('Failed migrating JSON data to Postgres.');
  console.error(err.message);
  process.exit(1);
});
