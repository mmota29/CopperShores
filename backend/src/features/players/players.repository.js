const database = require('../../shared/database');

module.exports = {
  flushWrites: database.flushWrites,
  listPlayers: database.listPlayers,
  getPlayer: database.getPlayer,
  createPlayer: database.createPlayer,
  updatePlayer: database.updatePlayer,
  deletePlayer: database.deletePlayer,
  addCharacter: database.addCharacter,
  updateCharacter: database.updateCharacter,
  deleteCharacter: database.deleteCharacter,
  setCurrentCharacter: database.setCurrentCharacter,
  moveCurrentToPrevious: database.moveCurrentToPrevious
};
