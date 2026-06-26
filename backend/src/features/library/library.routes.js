const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const requireContentWriteAccess = require('../../shared/http/content-write-access');
const library = require('./library.repository');

const router = express.Router();

router.get('/types', asyncRoute(async (req, res) => {
  res.json({ status: 'success', data: library.getContentTypes() });
}));

router.get('/', asyncRoute(async (req, res) => {
  const entries = await library.listContentEntries({
    type: req.query.type,
    q: req.query.q,
    tag: req.query.tag
  });
  res.json({ status: 'success', data: { entries } });
}));

router.post('/', requireContentWriteAccess, asyncRoute(async (req, res) => {
  const result = await library.createContentEntry(req.body || {});
  if (result.error) {
    return res.status(400).json({ status: 'error', message: result.error });
  }
  res.status(201).json({ status: 'success', data: result.entry });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const entry = await library.getContentEntry(req.params.id);
  if (!entry) {
    return res.status(404).json({
      status: 'error',
      message: 'Content entry not found.'
    });
  }
  res.json({ status: 'success', data: entry });
}));

router.put('/:id', requireContentWriteAccess, asyncRoute(async (req, res) => {
  const result = await library.updateContentEntry(req.params.id, req.body || {});
  if (result.error) {
    const status = result.error === 'Content entry not found.' ? 404 : 400;
    return res.status(status).json({ status: 'error', message: result.error });
  }
  res.json({ status: 'success', data: result.entry });
}));

router.delete('/:id', requireContentWriteAccess, asyncRoute(async (req, res) => {
  const deleted = await library.deleteContentEntry(req.params.id);
  if (!deleted) {
    return res.status(404).json({
      status: 'error',
      message: 'Content entry not found.'
    });
  }
  res.json({ status: 'success', message: 'Content entry deleted.' });
}));

module.exports = router;
