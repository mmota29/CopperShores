const express = require('express');
const database = require('../../shared/database');

const router = express.Router();

router.get('/gold', (req, res) => {
  res.json({
    status: 'success',
    message: 'Gold Spending API (Coming Soon)',
    data: { totalGold: 0, spending: [] }
  });
});

router.get('/map', (req, res) => {
  res.json({
    status: 'success',
    message: 'Interactive Map API (Coming Soon)',
    data: { locations: [] }
  });
});

router.get('/config', (req, res) => {
  res.json({
    status: 'success',
    data: {
      storageMode: database.getStorageMode(),
      adminWriteRequired: Boolean(process.env.ADMIN_WRITE_TOKEN),
      contentTypes: database.getContentTypes()
    }
  });
});

module.exports = router;
