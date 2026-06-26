const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const treasury = require('./treasury.repository');

const router = express.Router();

router.get('/state', asyncRoute(async (req, res) => {
  res.json({ status: 'success', data: treasury.getTreasuryState() });
}));

router.get('/settings', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { settings: treasury.getTreasurySettings() }
  });
}));

router.put('/settings', asyncRoute(async (req, res) => {
  const settings = treasury.updateTreasurySettings(req.body || {});
  await treasury.flushWrites();
  res.json({ status: 'success', data: { settings } });
}));

router.get('/transactions', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { transactions: treasury.listTreasuryTransactions() }
  });
}));

router.post('/transactions', asyncRoute(async (req, res) => {
  const result = treasury.addTreasuryTransaction(req.body || {});
  if (result.error) {
    return res.status(400).json({ status: 'error', message: result.error });
  }
  await treasury.flushWrites();
  res.status(201).json({
    status: 'success',
    data: {
      transaction: result.transaction,
      treasury: treasury.getTreasuryState()
    }
  });
}));

router.put('/transactions/:id', asyncRoute(async (req, res) => {
  const result = treasury.updateTreasuryTransaction(req.params.id, req.body || {});
  if (result.error) {
    const status = result.error === 'Transaction not found.' ? 404 : 400;
    return res.status(status).json({ status: 'error', message: result.error });
  }
  await treasury.flushWrites();
  res.json({
    status: 'success',
    data: {
      transaction: result.transaction,
      treasury: treasury.getTreasuryState()
    }
  });
}));

router.delete('/transactions/:id', asyncRoute(async (req, res) => {
  const deleted = treasury.deleteTreasuryTransaction(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      status: 'error',
      message: 'Transaction not found'
    });
  }
  await treasury.flushWrites();
  res.json({
    status: 'success',
    data: { treasury: treasury.getTreasuryState() }
  });
}));

router.get('/characters', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { characters: treasury.getTreasuryCharacters() }
  });
}));

router.get('/accounts', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { accounts: treasury.getTreasuryAccounts() }
  });
}));

router.get('/wallets', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { wallets: treasury.getLegacyWalletSnapshotFromLedger() }
  });
}));

router.get('/loot-log', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { lootLog: treasury.listLegacyLootLogFromTransactions() }
  });
}));

router.get('/spending-log', asyncRoute(async (req, res) => {
  res.json({
    status: 'success',
    data: { spendingLog: treasury.listLegacySpendingLogFromTransactions() }
  });
}));

module.exports = router;
