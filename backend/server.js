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
 * GET /api/players
 * Returns placeholder data for players
 */
app.get('/api/players', (req, res) => {
  res.json({
    status: 'success',
    message: 'Players API (Coming Soon)',
    data: {
      players: []
    }
  });
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
