const db = require('../db');

db.ready()
  .then(async () => {
    console.log(`Database ready (${db.getStorageMode()}).`);
    await db.close();
  })
  .catch(async err => {
    console.error('Migration failed:', err.message);
    await db.close().catch(() => {});
    process.exit(1);
  });
