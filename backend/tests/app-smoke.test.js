const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../src/app');
const database = require('../src/shared/database');

let server;
let baseUrl;

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
});

for (const path of [
  '/',
  '/treasury/',
  '/maps/',
  '/players/',
  '/notes/',
  '/library/',
  '/api/health',
  '/api/config',
  '/api/players',
  '/api/notes/categories',
  '/api/maps',
  '/api/treasury/state',
  '/api/content/types'
]) {
  test(`GET ${path}`, async () => {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200);
  });
}

test('legacy detail URL keeps its query string', async () => {
  const response = await fetch(`${baseUrl}/player.html?id=player-1`, {
    redirect: 'manual'
  });
  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get('location'),
    '/players/detail.html?id=player-1'
  );
});
