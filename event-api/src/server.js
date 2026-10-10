const express = require('express');
const config = require('./config/environment');
const db = require('./db/database');
const eventsRouter = require('./routes/events');
const studentsRouter = require('./routes/students');
const adminRouter = require('./routes/admin');
const { runCleanup } = require('./services/cleanupService');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  const startedAt = process.env.BUILD_VERSION ? null : null; // placeholder, no-op

  try {
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      service: 'event-api',
      version: process.env.BUILD_VERSION || 'dev',
      db: 'connected',
      uptime_seconds: Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'event-api',
      version: process.env.BUILD_VERSION || 'dev',
      db: 'unreachable',
      uptime_seconds: Math.round(process.uptime()),
    });
  }
});

app.use('/events', eventsRouter);
app.use('/students', studentsRouter);
app.use('/admin', adminRouter);

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Event API listening on port ${config.port}`);
  });

  setInterval(async () => {
    try {
      const deleted = await runCleanup('2 days');
      if (deleted.length > 0) {
        console.log(`Cleanup: removed ${deleted.length} closed event(s):`, deleted.map(e => e.title));
      }
    } catch (err) {
      console.error('Scheduled cleanup failed:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);
}

module.exports = app;