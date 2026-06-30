const fs = require('fs');
const os = require('os');
const path = require('path');
const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'copper-shores-admin-'));
const testDbPath = path.join(testDirectory, 'db.json');
fs.copyFileSync(path.resolve(__dirname, '..', 'data', 'db.json'), testDbPath);

process.env.DB_HOST = '';
process.env.DB_USER = '';
process.env.DB_NAME = '';
process.env.DATABASE_URL = '';
process.env.JSON_DB_PATH = testDbPath;
process.env.ADMIN_WRITE_TOKEN = 'test-admin-token-with-sufficient-entropy';

const app = require('../src/app');
const database = require('../src/shared/database');

let server;
let baseUrl;
let cookie;
let exportedBackup;

before(async () => {
  await database.ready();
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  await database.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('admin page redirects to login without a session', async () => {
  const response = await fetch(`${baseUrl}/admin/`, { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/admin/login/');
});

test('admin login rejects an invalid token', async () => {
  const response = await fetch(`${baseUrl}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wrong' })
  });
  assert.equal(response.status, 401);
});

test('admin login creates a protected session', async () => {
  const response = await fetch(`${baseUrl}/api/admin/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: process.env.ADMIN_WRITE_TOKEN })
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get('set-cookie').split(';')[0];

  const statusResponse = await fetch(`${baseUrl}/api/admin/backups/status`, {
    headers: { Cookie: cookie }
  });
  assert.equal(statusResponse.status, 200);
  const payload = await statusResponse.json();
  assert.equal(payload.data.counts.notes, 95);
});

test('export returns a complete validated backup', async () => {
  const response = await fetch(`${baseUrl}/api/admin/backups/export`, {
    headers: { Cookie: cookie }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment/);
  exportedBackup = await response.json();
  assert.equal(exportedBackup.format, 'copper-shores-backup');
  assert.equal(exportedBackup.counts.treasuryTransactions, 41);
});

test('dry run reports that seeded target data requires replace mode', async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?dryRun=true`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream'
      },
      body: JSON.stringify(exportedBackup)
    }
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.valid, true);
  assert.equal(payload.data.replaceRequired, true);
});

test('empty import refuses to overwrite existing data', async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?mode=empty`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream'
      },
      body: JSON.stringify(exportedBackup)
    }
  );
  assert.equal(response.status, 409);
});

test('replace import requires safety confirmation', async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?mode=replace`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream',
        'X-Restore-Confirmation': 'REPLACE COPPER SHORES DATA'
      },
      body: JSON.stringify(exportedBackup)
    }
  );
  assert.equal(response.status, 400);
});

test('replace import is atomic and verifies the restored checksum', async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?mode=replace`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream',
        'X-Restore-Confirmation': 'REPLACE COPPER SHORES DATA',
        'X-Safety-Backup-Downloaded': 'true'
      },
      body: JSON.stringify(exportedBackup)
    }
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.data.counts, exportedBackup.counts);
  assert.equal(payload.data.checksum, exportedBackup.integrity.dataSha256);
});

test('empty import restores into an empty target without duplicate records', async () => {
  await database.replaceBackupState({
    players: [],
    notes: {},
    mapWaypoints: {},
    gold: null,
    contentEntries: []
  }, { requireEmpty: false });

  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?mode=empty`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream'
      },
      body: JSON.stringify(exportedBackup)
    }
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload.data.counts, exportedBackup.counts);
  assert.equal(payload.data.checksum, exportedBackup.integrity.dataSha256);
});

test('import rejects a corrupted backup', async () => {
  const corrupted = structuredClone(exportedBackup);
  corrupted.data.notes[0].title = 'Changed without checksum';
  const response = await fetch(
    `${baseUrl}/api/admin/backups/import?dryRun=true`,
    {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/octet-stream'
      },
      body: JSON.stringify(corrupted)
    }
  );
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(payload.errors.join(' '), /checksum/i);
});
