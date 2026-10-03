const config = require('../config/environment');

function requireAdmin(req, res, next) {
  const provided = req.header('x-admin-password');

  if (!config.adminPassword) {
    console.warn('ADMIN_PASSWORD not configured — blocking all admin actions.');
    return res.status(503).json({ error: 'Admin access is not configured' });
  }

  if (!provided || provided !== config.adminPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  next();
}

module.exports = requireAdmin;