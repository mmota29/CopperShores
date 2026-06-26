require('dotenv').config({ quiet: true });

const app = require('./app');
const database = require('./shared/database');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  await database.ready();

  const server = app.listen(PORT, HOST, () => {
    console.log(`Copper Shores server is running on http://${HOST}:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
    console.log(`Storage mode: ${database.getStorageMode()}`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received; closing Copper Shores.`);
    server.close(async () => {
      await database.close();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch(err => {
  console.error('Failed to initialize storage:', err.message);
  process.exit(1);
});
