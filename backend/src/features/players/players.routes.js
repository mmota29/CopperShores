const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const players = require('./players.repository');

const router = express.Router();

router.get('/', asyncRoute(async (req, res) => {
  const trimmed = players.listPlayers().map(player => ({
    id: player.id,
    name: player.name,
    bio: player.bio,
    currentCharacter: player.currentCharacter || null
  }));
  res.json({ status: 'success', data: { players: trimmed } });
}));

router.post('/', asyncRoute(async (req, res) => {
  const { name, bio, currentCharacter } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Player name is required' });
  }

  const player = players.createPlayer({
    name: name.trim(),
    bio: bio || '',
    currentCharacter
  });
  await players.flushWrites();
  res.status(201).json({ status: 'success', data: player });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const player = players.getPlayer(req.params.id);
  if (!player) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }
  res.json({ status: 'success', data: player });
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const patch = req.body || {};
  if (patch.name !== undefined && (typeof patch.name !== 'string' || patch.name.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Player name cannot be empty' });
  }

  const updated = players.updatePlayer(req.params.id, patch);
  if (!updated) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }
  await players.flushWrites();
  res.json({ status: 'success', data: updated });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const deleted = players.deletePlayer(req.params.id);
  if (!deleted) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }
  await players.flushWrites();
  res.json({ status: 'success', message: 'Player deleted' });
}));

router.post('/:id/characters', asyncRoute(async (req, res) => {
  const player = players.getPlayer(req.params.id);
  if (!player) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }

  const payload = req.body || {};
  if (!payload.name || typeof payload.name !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Character name is required' });
  }

  const character = players.addCharacter(req.params.id, payload);
  await players.flushWrites();
  res.status(201).json({ status: 'success', data: character });
}));

router.put('/:id/current', asyncRoute(async (req, res) => {
  if (!players.getPlayer(req.params.id)) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }

  const payload = req.body || {};
  let result;
  if (payload.characterId) {
    result = players.setCurrentCharacter(req.params.id, payload.characterId);
  } else if (payload.character) {
    result = players.setCurrentCharacter(req.params.id, payload.character);
  } else {
    return res.status(400).json({
      status: 'error',
      message: 'characterId or character object required'
    });
  }

  if (!result) {
    return res.status(404).json({ status: 'error', message: 'Character not found' });
  }
  await players.flushWrites();
  res.json({ status: 'success', data: result });
}));

router.post('/:id/moveCurrentToPrevious', asyncRoute(async (req, res) => {
  if (!players.getPlayer(req.params.id)) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }

  const moved = players.moveCurrentToPrevious(
    req.params.id,
    (req.body || {}).status || 'dead'
  );
  if (!moved) {
    return res.status(400).json({ status: 'error', message: 'No current character to move' });
  }
  await players.flushWrites();
  res.json({ status: 'success', data: moved });
}));

router.delete('/:id/characters/:charId', asyncRoute(async (req, res) => {
  if (!players.getPlayer(req.params.id)) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }

  const deleted = players.deleteCharacter(req.params.id, req.params.charId);
  if (!deleted) {
    return res.status(404).json({ status: 'error', message: 'Character not found' });
  }
  await players.flushWrites();
  res.json({ status: 'success', message: 'Character removed' });
}));

router.put('/:id/characters/:charId', asyncRoute(async (req, res) => {
  if (!players.getPlayer(req.params.id)) {
    return res.status(404).json({ status: 'error', message: 'Player not found' });
  }

  const updated = players.updateCharacter(
    req.params.id,
    req.params.charId,
    req.body || {}
  );
  if (!updated) {
    return res.status(404).json({ status: 'error', message: 'Character not found' });
  }
  await players.flushWrites();
  res.json({ status: 'success', data: updated });
}));

module.exports = router;
