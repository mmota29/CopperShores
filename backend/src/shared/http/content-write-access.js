function requireContentWriteAccess(req, res, next) {
  const adminToken = process.env.ADMIN_WRITE_TOKEN;
  if (!adminToken) return next();

  const provided = req.get('x-admin-token') || '';
  if (provided === adminToken) return next();

  return res.status(401).json({
    status: 'error',
    message: 'Admin token is required to change content.'
  });
}

module.exports = requireContentWriteAccess;
