const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const notes = require('./notes.repository');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Notes API (Coming Soon)',
    data: { notes: [] }
  });
});

router.get('/categories', asyncRoute(async (req, res) => {
  res.json({ status: 'success', data: notes.getCategories() });
}));

router.get('/:category', asyncRoute(async (req, res) => {
  const result = notes.listNotes(req.params.category);
  if (result === null) {
    return res.status(400).json({ status: 'error', message: 'Invalid category' });
  }
  res.json({ status: 'success', data: { notes: result } });
}));

router.post('/:category', asyncRoute(async (req, res) => {
  const { title, content, tags } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Note title is required' });
  }

  const note = notes.createNote(req.params.category, { title, content, tags });
  if (!note) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid category or note data'
    });
  }
  await notes.flushWrites();
  res.status(201).json({ status: 'success', data: note });
}));

router.get('/:category/:id', asyncRoute(async (req, res) => {
  const note = notes.getNote(req.params.category, req.params.id);
  if (!note) {
    return res.status(404).json({ status: 'error', message: 'Note not found' });
  }
  res.json({ status: 'success', data: note });
}));

router.put('/:category/:id', asyncRoute(async (req, res) => {
  const note = notes.updateNote(req.params.category, req.params.id, req.body || {});
  if (!note) {
    return res.status(404).json({
      status: 'error',
      message: 'Note not found or invalid category'
    });
  }
  await notes.flushWrites();
  res.json({ status: 'success', data: note });
}));

router.delete('/:category/:id', asyncRoute(async (req, res) => {
  const deleted = notes.deleteNote(req.params.category, req.params.id);
  if (!deleted) {
    return res.status(404).json({ status: 'error', message: 'Note not found' });
  }
  await notes.flushWrites();
  res.json({ status: 'success', message: 'Note deleted' });
}));

module.exports = router;
