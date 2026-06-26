const database = require('../../shared/database');

module.exports = {
  flushWrites: database.flushWrites,
  getCategories: database.getCategories,
  listNotes: database.listNotes,
  getNote: database.getNote,
  createNote: database.createNote,
  updateNote: database.updateNote,
  deleteNote: database.deleteNote
};
