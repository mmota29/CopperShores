const db = require('../db');

const force = process.argv.includes('--force');

db.ready()
  .then(async () => {
    const result = await db.seedFromJson({ force });
    console.log(result.message);
    await db.close();
  })
  .catch(async err => {
    console.error('Seed failed:', err.message);
    await db.close().catch(() => {});
    process.exit(1);
  });
