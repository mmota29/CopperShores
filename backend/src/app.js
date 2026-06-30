const path = require('path');
const express = require('express');
const cors = require('cors');

const database = require('./shared/database');
const systemRoutes = require('./features/system/system.routes');
const playerRoutes = require('./features/players/players.routes');
const noteRoutes = require('./features/notes/notes.routes');
const mapRoutes = require('./features/maps/maps.routes');
const treasuryRoutes = require('./features/treasury/treasury.routes');
const libraryRoutes = require('./features/library/library.routes');
const adminRoutes = require('./features/admin/admin.routes');
const { requireAdminPage } = require('./features/admin/admin-auth');

const app = express();
const frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
const homePagePath = path.join(frontendPath, 'home', 'index.html');
const adminPath = path.join(frontendPath, 'admin');
const adminPagePath = path.join(adminPath, 'index.html');
const adminLoginPagePath = path.join(adminPath, 'login.html');

const IMMUTABLE_STATIC_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.woff2',
  '.woff',
  '.ttf'
]);

function redirectLegacyPage(target) {
  return (req, res) => {
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    res.redirect(308, `${target}${query}`);
  };
}

app.set('etag', 'strong');
app.set('trust proxy', 1);
app.use(cors());
app.use(
  '/api/admin/backups/import',
  express.raw({
    type: ['application/json', 'application/octet-stream', 'application/vnd.coppershores.backup+json'],
    limit: '10mb'
  })
);
app.use(express.json());

app.use((req, res, next) => {
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const isActiveImport = req.path === '/api/admin/backups/import';
  if (isWrite && !isActiveImport && database.isMaintenanceActive()) {
    return res.status(503).json({
      status: 'error',
      message: 'Database restore is in progress. Try again shortly.'
    });
  }
  return next();
});

app.use('/api', systemRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/content', libraryRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Copper Shores Backend is running',
    version: '0.2.0',
    storageMode: database.getStorageMode()
  });
});

app.get('/', (req, res) => {
  res.sendFile(homePagePath);
});

app.get(['/admin/login', '/admin/login/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(adminLoginPagePath);
});
app.get(['/admin', '/admin/', '/admin/index.html'], requireAdminPage, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(adminPagePath);
});

app.get('/index.html', redirectLegacyPage('/'));
app.get('/gold.html', redirectLegacyPage('/treasury/'));
app.get('/map.html', redirectLegacyPage('/maps/'));
app.get('/players.html', redirectLegacyPage('/players/'));
app.get('/player.html', redirectLegacyPage('/players/detail.html'));
app.get('/notes.html', redirectLegacyPage('/notes/'));
app.get('/notes_category.html', redirectLegacyPage('/notes/category.html'));
app.get('/note.html', redirectLegacyPage('/notes/detail.html'));
app.get('/content.html', redirectLegacyPage('/library/'));

app.use(express.static(frontendPath, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName === 'sw.js' || extension === '.html') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }

    if (IMMUTABLE_STATIC_EXTENSIONS.has(extension)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      status: 'error',
      message: 'Backup file exceeds the 10 MB upload limit.'
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      status: 'error',
      message: 'Request body contains invalid JSON.'
    });
  }
  console.error('Unhandled API error:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Unexpected server error'
  });
});

module.exports = app;
