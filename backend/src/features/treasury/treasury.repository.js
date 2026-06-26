const database = require('../../shared/database');

module.exports = {
  flushWrites: database.flushWrites,
  getTreasuryState: database.getTreasuryState,
  getTreasurySettings: database.getTreasurySettings,
  updateTreasurySettings: database.updateTreasurySettings,
  listTreasuryTransactions: database.listTreasuryTransactions,
  addTreasuryTransaction: database.addTreasuryTransaction,
  updateTreasuryTransaction: database.updateTreasuryTransaction,
  deleteTreasuryTransaction: database.deleteTreasuryTransaction,
  getTreasuryCharacters: database.getTreasuryCharacters,
  getTreasuryAccounts: database.getTreasuryAccounts,
  getLegacyWalletSnapshotFromLedger: database.getLegacyWalletSnapshotFromLedger,
  listLegacyLootLogFromTransactions: database.listLegacyLootLogFromTransactions,
  listLegacySpendingLogFromTransactions: database.listLegacySpendingLogFromTransactions
};
