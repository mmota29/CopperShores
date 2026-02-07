// Copper Shores Backend - Express Server
// This is a simple API server for the D&D Campaign Hub

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Enable CORS for local development
app.use(express.json());

// Routes
const db = require('./db');

/**
 * GET /api/gold
 * Returns placeholder data for gold spending
 */
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

/**
 * GET /api/map
 * Returns placeholder data for the interactive map
 */
app.get('/api/map', (req, res) => {
  res.json({
    status: 'success',
    message: 'Interactive Map API (Coming Soon)',
    data: {
      locations: []
    }
  });
});

/**
 * Players API (persistent JSON storage)
 */

// List players
app.get('/api/players', (req, res) => {
  try {
    const players = db.listPlayers();
    // Send a trimmed list for the index view
    const trimmed = players.map(p => ({
      id: p.id,
      name: p.name,
      bio: p.bio,
      currentCharacter: p.currentCharacter || null
    }));
    res.json({ status: 'success', data: { players: trimmed } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Create player
app.post('/api/players', (req, res) => {
  const { name, bio, currentCharacter } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Player name is required' });
  }
  try {
    const player = db.createPlayer({ name: name.trim(), bio: bio || '', currentCharacter });
    res.status(201).json({ status: 'success', data: player });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get one player
app.get('/api/players/:id', (req, res) => {
  const id = req.params.id;
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', data: player });
});

// Update player (name/bio)
app.put('/api/players/:id', (req, res) => {
  const id = req.params.id;
  const patch = req.body || {};
  if (patch.name !== undefined && (typeof patch.name !== 'string' || patch.name.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Player name cannot be empty' });
  }
  const updated = db.updatePlayer(id, patch);
  if (!updated) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', data: updated });
});

// Delete player
app.delete('/api/players/:id', (req, res) => {
  const id = req.params.id;
  const ok = db.deletePlayer(id);
  if (!ok) return res.status(404).json({ status: 'error', message: 'Player not found' });
  res.json({ status: 'success', message: 'Player deleted' });
});

// Add a character to player (goes to previous list by default unless status active)
app.post('/api/players/:id/characters', (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  if (!payload.name || typeof payload.name !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Character name is required' });
  }
  try {
    const char = db.addCharacter(id, payload);
    res.status(201).json({ status: 'success', data: char });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Set current character for player (accepts { characterId } or full object)
app.put('/api/players/:id/current', (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  let result = null;
  try {
    if (payload.characterId) {
      result = db.setCurrentCharacter(id, payload.characterId);
    } else if (payload.character) {
      result = db.setCurrentCharacter(id, payload.character);
    } else {
      return res.status(400).json({ status: 'error', message: 'characterId or character object required' });
    }
    if (!result) return res.status(404).json({ status: 'error', message: 'Character not found' });
    res.json({ status: 'success', data: result });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Move current to previous and clear current (e.g., when character dies)
app.post('/api/players/:id/moveCurrentToPrevious', (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  try {
    const status = payload.status || 'dead';
    const moved = db.moveCurrentToPrevious(id, status);
    if (!moved) return res.status(400).json({ status: 'error', message: 'No current character to move' });
    res.json({ status: 'success', data: moved });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Delete a character
app.delete('/api/players/:id/characters/:charId', (req, res) => {
  const id = req.params.id;
  const charId = req.params.charId;
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  const ok = db.deleteCharacter(id, charId);
  if (!ok) return res.status(404).json({ status: 'error', message: 'Character not found' });
  res.json({ status: 'success', message: 'Character removed' });
});

// Update a character (level, class, name, etc.)
app.put('/api/players/:id/characters/:charId', (req, res) => {
  const id = req.params.id;
  const charId = req.params.charId;
  const patch = req.body || {};
  const player = db.getPlayer(id);
  if (!player) return res.status(404).json({ status: 'error', message: 'Player not found' });
  try {
    const updated = db.updateCharacter(id, charId, patch);
    if (!updated) return res.status(404).json({ status: 'error', message: 'Character not found' });
    res.json({ status: 'success', data: updated });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/notes
 * Returns placeholder data for campaign notes
 */
app.get('/api/notes', (req, res) => {
  res.json({
    status: 'success',
    message: 'Notes API (Coming Soon)',
    data: {
      notes: []
    }
  });
});

/**
 * Notes API (persistent JSON storage)
 */

// Get all note categories with labels
app.get('/api/notes/categories', (req, res) => {
  try {
    const cats = db.getCategories();
    res.json({ status: 'success', data: cats });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// List notes in a category
app.get('/api/notes/:cat', (req, res) => {
  const cat = req.params.cat;
  try {
    const notes = db.listNotes(cat);
    if (notes === null) {
      return res.status(400).json({ status: 'error', message: 'Invalid category' });
    }
    res.json({ status: 'success', data: { notes } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Create a note
app.post('/api/notes/:cat', (req, res) => {
  const cat = req.params.cat;
  const { title, content, tags } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Note title is required' });
  }
  try {
    const note = db.createNote(cat, { title, content, tags });
    if (!note) {
      return res.status(400).json({ status: 'error', message: 'Invalid category or note data' });
    }
    res.status(201).json({ status: 'success', data: note });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get one note
app.get('/api/notes/:cat/:id', (req, res) => {
  const cat = req.params.cat;
  const id = req.params.id;
  try {
    const note = db.getNote(cat, id);
    if (!note) {
      return res.status(404).json({ status: 'error', message: 'Note not found' });
    }
    res.json({ status: 'success', data: note });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Update a note
app.put('/api/notes/:cat/:id', (req, res) => {
  const cat = req.params.cat;
  const id = req.params.id;
  const patch = req.body || {};
  try {
    const note = db.updateNote(cat, id, patch);
    if (!note) {
      return res.status(404).json({ status: 'error', message: 'Note not found or invalid category' });
    }
    res.json({ status: 'success', data: note });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Delete a note
app.delete('/api/notes/:cat/:id', (req, res) => {
  const cat = req.params.cat;
  const id = req.params.id;
  try {
    const ok = db.deleteNote(cat, id);
    if (!ok) {
      return res.status(404).json({ status: 'error', message: 'Note not found' });
    }
    res.json({ status: 'success', message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Copper Shores Backend is running',
    version: '0.1.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🐉 Copper Shores server is running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
});
