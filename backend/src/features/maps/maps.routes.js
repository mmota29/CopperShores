const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const maps = require('./maps.repository');

const router = express.Router();

router.get('/', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { maps: maps.getMapsDefinition() }
  });
}));

router.get('/:mapId/waypoints', asyncRoute(async (req, res) => {
  const waypoints = maps.listWaypoints(req.params.mapId);
  if (waypoints === null) {
    return res.status(400).json({ status: 'error', message: 'Invalid map ID' });
  }
  res.json({ status: 'success', data: { waypoints } });
}));

router.post('/:mapId/waypoints', asyncRoute(async (req, res) => {
  const { x, y, title, note } = req.body || {};
  if (typeof x !== 'number' || typeof y !== 'number') {
    return res.status(400).json({
      status: 'error',
      message: 'x and y coordinates are required and must be numbers'
    });
  }

  const waypoint = maps.createWaypoint(req.params.mapId, { x, y, title, note });
  if (!waypoint) {
    return res.status(400).json({ status: 'error', message: 'Invalid map ID' });
  }
  await maps.flushWrites();
  res.status(201).json({ status: 'success', data: waypoint });
}));

router.get('/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const waypoint = maps.getWaypoint(req.params.mapId, req.params.id);
  if (!waypoint) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  res.json({ status: 'success', data: waypoint });
}));

router.put('/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const waypoint = maps.updateWaypoint(
    req.params.mapId,
    req.params.id,
    req.body || {}
  );
  if (!waypoint) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  await maps.flushWrites();
  res.json({ status: 'success', data: waypoint });
}));

router.delete('/:mapId/waypoints/:id', asyncRoute(async (req, res) => {
  const deleted = maps.deleteWaypoint(req.params.mapId, req.params.id);
  if (!deleted) {
    return res.status(404).json({ status: 'error', message: 'Waypoint not found' });
  }
  await maps.flushWrites();
  res.json({ status: 'success', message: 'Waypoint deleted' });
}));

module.exports = router;
