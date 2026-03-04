const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is missing. Set DATABASE_URL to a Postgres connection string (local or Render Postgres) before starting the backend.'
    );
  }
}

function getPoolConfig() {
  assertDatabaseUrl();

  const config = {
    connectionString: process.env.DATABASE_URL
  };

  const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
  const useSsl = sslMode === 'require' || (sslMode !== 'disable' && process.env.NODE_ENV === 'production');

  if (useSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool(getPoolConfig());
  }
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  assertDatabaseUrl
};
