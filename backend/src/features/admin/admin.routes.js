const express = require('express');
const asyncRoute = require('../../shared/http/async-route');
const database = require('../../shared/database');
const {
  BackupValidationError,
  countState,
  createBackup,
  validateBackup
} = require('./backup.service');
const {
  getAdminToken,
  safeEqual,
  hasValidSession,
  setSessionCookie,
  clearSessionCookie,
  isRateLimited,
  recordLoginFailure,
  clearLoginFailures,
  requireAdminApi,
  requireSameOrigin
} = require('./admin-auth');

const router = express.Router();
const REPLACE_CONFIRMATION = 'REPLACE COPPER SHORES DATA';

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/session', requireSameOrigin, (req, res) => {
  if (!getAdminToken()) {
    return res.status(503).json({
      status: 'error',
      message: 'Set ADMIN_WRITE_TOKEN on the server before using the admin portal.'
    });
  }
  if (isRateLimited(req)) {
    return res.status(429).json({
      status: 'error',
      message: 'Too many failed login attempts. Try again later.'
    });
  }

  const provided = req.body && typeof req.body.token === 'string'
    ? req.body.token
    : '';
  if (!safeEqual(provided, getAdminToken())) {
    recordLoginFailure(req);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid admin token.'
    });
  }

  clearLoginFailures(req);
  setSessionCookie(req, res);
  return res.json({ status: 'success', data: { authenticated: true } });
});

router.get('/session', requireAdminApi, (req, res) => {
  res.json({ status: 'success', data: { authenticated: hasValidSession(req) } });
});

router.delete('/session', requireSameOrigin, (req, res) => {
  clearSessionCookie(req, res);
  res.json({ status: 'success', data: { authenticated: false } });
});

router.use(requireAdminApi);

router.get('/backups/status', asyncRoute(async (req, res) => {
  const state = await database.getBackupState();
  res.json({
    status: 'success',
    data: {
      storageMode: database.getStorageMode(),
      counts: countState(state),
      maintenanceActive: database.isMaintenanceActive()
    }
  });
}));

router.get('/backups/export', asyncRoute(async (req, res) => {
  const state = await database.getBackupState();
  const backup = createBackup(state, database.getStorageMode());
  const timestamp = backup.exportedAt.replace(/[:.]/g, '-');
  const filename = `copper-shores-backup-${timestamp}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(`${JSON.stringify(backup, null, 2)}\n`);
}));

router.post('/backups/import', requireSameOrigin, asyncRoute(async (req, res) => {
  let validated;
  try {
    validated = validateBackup(req.body);
  } catch (error) {
    if (error instanceof BackupValidationError) {
      return res.status(400).json({
        status: 'error',
        message: 'Backup validation failed.',
        errors: error.errors
      });
    }
    throw error;
  }

  const targetState = await database.getBackupState();
  const targetCounts = countState(targetState);
  const source = {
    exportedAt: validated.backup.exportedAt || null,
    applicationVersion: validated.backup.applicationVersion || null,
    sourceStorage: validated.backup.sourceStorage || null,
    counts: validated.counts,
    checksum: validated.canonicalChecksum
  };

  if (req.query.dryRun === 'true') {
    return res.json({
      status: 'success',
      data: {
        valid: true,
        source,
        target: {
          storageMode: database.getStorageMode(),
          counts: targetCounts
        },
        replaceRequired: Object.values(targetCounts).some(count => count > 0)
      }
    });
  }

  const mode = req.query.mode === 'replace' ? 'replace' : 'empty';
  if (mode === 'replace') {
    if (req.get('x-restore-confirmation') !== REPLACE_CONFIRMATION) {
      return res.status(400).json({
        status: 'error',
        message: `Replace mode requires the confirmation phrase: ${REPLACE_CONFIRMATION}`
      });
    }
    if (req.get('x-safety-backup-downloaded') !== 'true') {
      return res.status(400).json({
        status: 'error',
        message: 'Download a current safety backup before replacing data.'
      });
    }
  }

  try {
    const restoredState = await database.replaceBackupState(validated.state, {
      requireEmpty: mode === 'empty'
    });
    const restoredBackup = createBackup(restoredState, database.getStorageMode());
    if (restoredBackup.integrity.dataSha256 !== validated.canonicalChecksum) {
      throw new Error('Post-restore checksum verification failed.');
    }
    return res.json({
      status: 'success',
      data: {
        restored: true,
        mode,
        counts: countState(restoredState),
        checksum: restoredBackup.integrity.dataSha256
      }
    });
  } catch (error) {
    if (error.code === 'TARGET_NOT_EMPTY') {
      return res.status(409).json({
        status: 'error',
        message: 'Target database is not empty. Use replace mode after downloading a safety backup.'
      });
    }
    if (error.code === 'MAINTENANCE_ACTIVE') {
      return res.status(409).json({
        status: 'error',
        message: error.message
      });
    }
    throw error;
  }
}));

module.exports = router;
module.exports.REPLACE_CONFIRMATION = REPLACE_CONFIRMATION;
