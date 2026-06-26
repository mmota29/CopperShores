const database = require('../../shared/database');

module.exports = {
  flushWrites: database.flushWrites,
  getMapsDefinition: database.getMapsDefinition,
  listWaypoints: database.listWaypoints,
  getWaypoint: database.getWaypoint,
  createWaypoint: database.createWaypoint,
  updateWaypoint: database.updateWaypoint,
  deleteWaypoint: database.deleteWaypoint
};
