// Copper Shores Backend - Express Server

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/allmaps', express.static(path.join(__dirname, '..', 'allmaps')));

function sendError(res, err) {
  res.status(500).json({ status: 'error', message: err.message });
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      sendError(res, err);
    }
  };
}

app.get('/api/gold', (req, res) => {
  res.json({
    status: 'success',
    message: 'Gold Spending API (Coming Soon)',
    data: {
      totalGold: 0,
      spending: []
    }
  });
});

app.get('/api/map', (req, res) => {
  res.json({
    status: 'success',
    message: 'Interactive Map API (Coming Soon)',
    data: {
      locations: []
    }
  });
});

app.get('/api/players', asyncRoute(async (req, res) => {
  const players = await db.listPlayers();
  const trimmed = players.map(p => ({
    id: p.id,
    name: p.name,
    bio: p.bio,
    currentCharacter: p.currentCharacter || null
  }));
  res.json({ status: 'success', data: { players: trimmed } });
}));

app.post('/api/players', asyncRoute(async (req, res) => {
  const { name, bio, currentCharacter } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Player name is required' });
  }

  const player = await db.createPlayer({ name: name.trim(), bio: bio || '', currentCharacter });
  res.status(201).json({ status: 'success', data: player });
}));

app.get('/api/players/:id', asyncRoute(async (req, res) => {
  const player = await db.getPlayer(req.params.id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', data: player });
}));

app.put('/api/players/:id', asyncRoute(async (req, res) => {
  const patch = req.body || {};
  if (patch.name !== undefined && (typeof patch.name !== 'string' || patch.name.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Player name cannot be empty' });
  }

  const updated = await db.updatePlayer(req.params.id, patch);
  if (!updated) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', data: updated });
}));

app.delete('/api/players/:id', asyncRoute(async (req, res) => {
  const ok = await db.deletePlayer(req.params.id);
  if (!ok) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', message: 'Player deleted' });
}));

app.post('/api/players/:id/characters', asyncRoute(async (req, res) => {
  const playerId = req.params.id;
  const payload = req.body || {};
  const player = await db.getPlayer(playerId);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  if (!payload.name || typeof payload.name !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Character name is required' });
  }

  const char = await db.addCharacter(playerId, payload);
  res.status(201).json({ status: 'success', data: char });
}));

app.put('/api/players/:id/current', asyncRoute(async (req, res) => {
  const playerId = req.params.id;
  const payload = req.body || {};
  const player = await db.getPlayer(playerId);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });

  let result = null;
  if (payload.characterId) {
    result = await db.setCurrentCharacter(playerId, payload.characterId);
  } else if (payload.character) {
    result = await db.setCurrentCharacter(playerId, payload.character);
  } else {
    return res.status(400).json({ status: 'error', message: 'characterId or character object required' });
  }

  if (!result) return res.status(404).json({ status: 'error', message: 'Character not found' });
  res.json({ status: 'success', data: result });
}));

app.post('/api/players/:id/moveCurrentToPrevious', asyncRoute(async (req, res) => {
  const playerId = req.params.id;
  const payload = req.body || {};
  const player = await db.getPlayer(playerId);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });

  const status = payload.status || 'dead';
  const moved = await db.moveCurrentToPrevious(playerId, status);
  if (!moved) return res.status(400).json({ status: 'error', message: 'No current character to move' });
  res.json({ status: 'success', data: moved });
}));

app.delete('/api/players/:id/characters/:charId', asyncRoute(async (req, res) => {
  const playerId = req.params.id;
  const charId = req.params.charId;
  const player = await db.getPlayer(playerId);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });

  const ok = await db.deleteCharacter(playerId, charId);
  if (!ok) return res.status(404).json({ status: 'error', message: 'Character not found' });
  res.json({ status: 'success', message: 'Character removed' });
}));

app.put('/api/players/:id/characters/:charId', asyncRoute(async (req, res) => {
  const playerId = req.params.id;
  const charId = req.params.charId;
  const player = await db.getPlayer(playerId);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });

  const updated = await db.updateCharacter(playerId, charId, req.body || {});
  if (!updated) return res.status(404).json({ status: 'error', message: 'Character not found' });
  res.json({ status: 'success', data: updated });
}));

app.get('/api/notes', (req, res) => {
  res.json({
    status: 'success',
    message: 'Notes API (Coming Soon)',
    data: {
      notes: []
    }
  });
});

app.get('/api/notes/categories', asyncRoute(async (req, res) => {
  const cats = await db.getCategories();
  res.json({ status: 'success', data: cats });
}));

app.get('/api/notes/:cat', asyncRoute(async (req, res) => {
  const notes = await db.listNotes(req.params.cat);
  if (notes === null) {
    return res.status(400).json({ status: 'error', message: 'Invalid category' });
  }
  res.json({ status: 'success', data: { notes } });
}));

app.post('/api/notes/:cat', asyncRoute(async (req, res) => {
  const cat = req.params.cat;
  const { title, content, tags } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Note title is required' });
  }

  const note = await db.createNote(cat, { title, content, tags });
  if (!note) {
    return res.status(400).json({ status: 'error', message: 'Invalid category or note data' });
  }
  res.status(201).json({ status: 'success', data: note });
}));

app.get('/api/notes/:cat/:id', asyncRoute(async (req, res) => {
  const note = await db.getNote(req.params.cat, req.params.id);
  if (!note) {
    return res.status(404).json({ status: 'error', message: 'Note not found' });
  }
  res.json({ status: 'success', data: note });
}));

app.put('/api/notes/:cat/:id', asyncRoute(async (req, res) => {
  const note = await db.updateNote(req.params.cat, req.params.id, req.body || {});
  if (!note) {
    return res.status(404).json({ status: 'error', message: 'Note not found or invalid category' });
  }
  res.json({ status: 'success', data: note });
}));

app.delete('/api/notes/:cat/:id', asyncRoute(async (req, res) => {
  const ok = await db.deleteNote(req.params.cat, req.params.id);
  if (!ok) {
    return res.status(404).json({ status: 'error', message: 'Note not found' });
  }
  res.json({ status: 'success', message: 'Note deleted' });
}));

app.get('/api/maps', asyncRoute(async (req, res) => {
  const maps = await db.getMapsDefinition();
  res.json({ status: 'success', data: { maps } });
}));

app.get('/api/maps/:mapId/waypoints', asyncRoute(async (req, res) => {
  const waypoints = await db.listWaypoints(req.params.mapId);
  if (waypoints === null) {
    return res.status(400).json({ status: 'error', message: 'Invalid map ID' });
  }
  res.json({ status: 'success', data: { waypoints } });
}));

app.post('/api/maps/:mapId/waypoints', asyncRoute(async (req, res) => {
  const mapId = req.params.mapId;
  const { x, y, title, note } = req.body || {};
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({ status: 'error', message: 'x and y coordinates are required and must be numbers' });
  }

  const waypoint = await db.createWaypoint(mapId, { x, y, title, note });
  if (!waypoint) {
    return res.status(400).json({ status: 'error', message: 'Invalid map ID' });
  }
  res.status(201).json({ status: 'success', data: waypoint });
}));

app.get('/api/maps/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const waypoint = await db.getWaypoint(req.params.mapId, req.params.id);
  if (!waypoint) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  res.json({ status: 'success', data: waypoint });
}));

app.put('/api/maps/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const waypoint = await db.updateWaypoint(req.params.mapId, req.params.id, req.body || {});
  if (!waypoint) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  res.json({ status: 'success', data: waypoint });
}));

app.delete('/api/maps/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const ok = await db.deleteWaypoint(req.params.mapId, req.params.id);
  if (!ok) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  res.json({ status: 'success', message: 'Waypoint deleted' });
}));

app.get('/api/treasury/state', asyncRoute(async (req, res) => {
  const treasury = await db.getTreasuryState();
  res.json({ status: 'success', data: treasury });
}));

app.get('/api/treasury/settings', asyncRoute(async (req, res) => {
  const settings = await db.getTreasurySettings();
  res.json({ status: 'success', data: { settings } });
}));

app.put('/api/treasury/settings', asyncRoute(async (req, res) => {
  const settings = await db.updateTreasurySettings(req.body || {});
  res.json({ status: 'success', data: { settings } });
}));

app.get('/api/treasury/transactions', asyncRoute(async (req, res) => {
  const transactions = await db.listTreasuryTransactions();
  res.json({ status: 'success', data: { transactions } });
}));

app.post('/api/treasury/transactions', asyncRoute(async (req, res) => {
  const result = await db.addTreasuryTransaction(req.body || {});
  if (result.error) {
    return res.status(400).json({ status: 'error', message: result.error });
  }
  const treasury = await db.getTreasuryState();
  res.status(201).json({ status: 'success', data: { transaction: result.transaction, treasury } });
}));

app.put('/api/treasury/transactions/:id', asyncRoute(async (req, res) => {
  const result = await db.updateTreasuryTransaction(req.params.id, req.body || {});
  if (result.error) {
    const status = result.error === 'Transaction not found.' ? 404 : 400;
    return res.status(status).json({ status: 'error', message: result.error });
  }
  const treasury = await db.getTreasuryState();
  res.json({ status: 'success', data: { transaction: result.transaction, treasury } });
}));

app.delete('/api/treasury/transactions/:id', asyncRoute(async (req, res) => {
  const ok = await db.deleteTreasuryTransaction(req.params.id);
  if (!ok) {
    return res.status(404).json({ status: 'error', message: 'Transaction not found' });
  }
  const treasury = await db.getTreasuryState();
  res.json({ status: 'success', data: { treasury } });
}));

app.get('/api/treasury/characters', asyncRoute(async (req, res) => {
  const characters = await db.getTreasuryCharacters();
  res.json({ status: 'success', data: { characters } });
}));

app.get('/api/treasury/accounts', asyncRoute(async (req, res) => {
  const accounts = await db.getTreasuryAccounts();
  res.json({ status: 'success', data: { accounts } });
}));

app.get('/api/treasury/wallets', asyncRoute(async (req, res) => {
  const wallets = await db.getLegacyWalletSnapshotFromLedger();
  res.json({ status: 'success', data: { wallets } });
}));

app.get('/api/treasury/loot-log', asyncRoute(async (req, res) => {
  const lootLog = await db.listLegacyLootLogFromTransactions();
  res.json({ status: 'success', data: { lootLog } });
}));

app.get('/api/treasury/spending-log', asyncRoute(async (req, res) => {
  const spendingLog = await db.listLegacySpendingLogFromTransactions();
  res.json({ status: 'success', data: { spendingLog } });
}));

app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Copper Shores Backend is running',
    version: '0.1.0'
  });
});

async function startServer() {
  try {
    await db.healthCheck();
  } catch (err) {
    console.error('Database connection failed.');
    console.error(err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Copper Shores server is running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
  });
}

startServer();
