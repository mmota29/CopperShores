const database = require('../../shared/database');

module.exports = {
  getContentTypes: database.getContentTypes,
  listContentEntries: database.listContentEntries,
  getContentEntry: database.getContentEntry,
  createContentEntry: database.createContentEntry,
  updateContentEntry: database.updateContentEntry,
  deleteContentEntry: database.deleteContentEntry
};
