const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  BackupValidationError,
  createBackup,
  validateBackup
} = require('../src/features/admin/backup.service');

const seedPath = path.resolve(__dirname, '..', 'data', 'db.json');

function getSeedState() {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

test('backup round trip preserves canonical data and relationships', () => {
  const backup = createBackup(getSeedState(), 'json-file');
  const validated = validateBackup(backup);
  const secondBackup = createBackup(validated.state, 'json-file');

  assert.deepEqual(backup.counts, {
    players: 6,
    characters: 5,
    notes: 95,
    mapWaypoints: 25,
    treasuryTransactions: 41,
    contentEntries: 0
  });
  assert.equal(
    secondBackup.integrity.dataSha256,
    backup.integrity.dataSha256
  );
});

test('backup validation rejects checksum changes', () => {
  const backup = createBackup(getSeedState(), 'json-file');
  backup.data.players[0].name = 'Tampered';

  assert.throws(
    () => validateBackup(backup),
    error => error instanceof BackupValidationError
      && error.errors.some(message => message.includes('checksum'))
  );
});

test('backup validation rejects duplicate IDs and orphan relationships', () => {
  const backup = createBackup(getSeedState(), 'json-file');
  backup.data.characters.push({
    ...backup.data.characters[0],
    playerId: 'missing-player'
  });
  const { checksumData } = require('../src/features/admin/backup.service');
  backup.integrity.dataSha256 = checksumData(backup.data);

  assert.throws(
    () => validateBackup(backup),
    error => error instanceof BackupValidationError
      && error.errors.some(message => message.includes('duplicate ID'))
      && error.errors.some(message => message.includes('missing player'))
  );
});

test('backup validation rejects broken treasury allocations', () => {
  const backup = createBackup(getSeedState(), 'json-file');
  backup.data.treasury.transactions[0].allocations[0].cpDelta += 1;
  const { checksumData } = require('../src/features/admin/backup.service');
  backup.integrity.dataSha256 = checksumData(backup.data);

  assert.throws(
    () => validateBackup(backup),
    error => error instanceof BackupValidationError
      && error.errors.some(message => message.includes('allocations total'))
  );
});
