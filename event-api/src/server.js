const express = require('express');
const config = require('./config/environment');
const eventsRouter = require('./routes/events');
const studentsRouter = require('./routes/students');
const { runCleanup } = require('./services/cleanupService');
const adminRouter = require('./routes/admin');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'event-api' });
});

app.use('/events', eventsRouter);
app.use('/students', studentsRouter);
app.use('/admin', adminRouter);

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // every hour

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