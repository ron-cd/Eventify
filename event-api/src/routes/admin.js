const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');

router.get('/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;