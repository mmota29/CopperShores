const crypto = require('crypto');

const COOKIE_NAME = 'copper_shores_admin';
const SESSION_SECONDS = 30 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;
const loginFailures = new Map();

function getAdminToken() {
  return process.env.ADMIN_WRITE_TOKEN || '';
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value) {
  return crypto.createHmac('sha256', getAdminToken()).update(value).digest('base64url');
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    nonce: crypto.randomBytes(16).toString('base64url')
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  const result = {};
  const raw = req.get('cookie') || '';
  raw.split(';').forEach(part => {
    const separator = part.indexOf('=');
    if (separator < 0) return;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) result[key] = value;
  });
  return result;
}

function hasValidSession(req) {
  if (!getAdminToken()) return false;
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(parsed.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function cookieAttributes(req, maxAge) {
  const forwardedProtocol = req.get('x-forwarded-proto');
  const secure = process.env.NODE_ENV === 'production' || forwardedProtocol === 'https';
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(secure ? ['Secure'] : [])
  ];
}

function setSessionCookie(req, res) {
  const attributes = cookieAttributes(req, SESSION_SECONDS);
  attributes[0] = `${COOKIE_NAME}=${createSessionToken()}`;
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', cookieAttributes(req, 0).join('; '));
}

function getLoginKey(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const key = getLoginKey(req);
  const current = loginFailures.get(key);
  if (!current) return false;
  if (Date.now() - current.startedAt > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return false;
  }
  return current.count >= MAX_LOGIN_FAILURES;
}

function recordLoginFailure(req) {
  const key = getLoginKey(req);
  const current = loginFailures.get(key);
  if (!current || Date.now() - current.startedAt > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, startedAt: Date.now() });
    return;
  }
  current.count += 1;
}

function clearLoginFailures(req) {
  loginFailures.delete(getLoginKey(req));
}

function requireAdminApi(req, res, next) {
  if (!getAdminToken()) {
    return res.status(503).json({
      status: 'error',
      message: 'Admin access is not configured on the server.'
    });
  }
  if (!hasValidSession(req)) {
    return res.status(401).json({
      status: 'error',
      message: 'Admin authentication is required.'
    });
  }
  return next();
}

function requireAdminPage(req, res, next) {
  if (hasValidSession(req)) return next();
  return res.redirect(303, '/admin/login/');
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return next();
  const expected = `${req.protocol}://${req.get('host')}`;
  if (origin === expected) return next();
  return res.status(403).json({
    status: 'error',
    message: 'Cross-origin admin requests are not allowed.'
  });
}

module.exports = {
  getAdminToken,
  safeEqual,
  hasValidSession,
  setSessionCookie,
  clearSessionCookie,
  isRateLimited,
  recordLoginFailure,
  clearLoginFailures,
  requireAdminApi,
  requireAdminPage,
  requireSameOrigin
};
