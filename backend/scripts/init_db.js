const fs = require('fs');
const path = require('path');

const { query, assertDatabaseUrl } = require('../lib/pg');

async function run() {
  assertDatabaseUrl();

  const sqlPath = path.join(__dirname, '..', 'sql', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await query(sql);
  console.log('Database schema initialized from backend/sql/init.sql');
}

run().catch(err => {
  console.error('Failed to initialize database schema.');
  console.error(err.message);
  process.exit(1);
});
