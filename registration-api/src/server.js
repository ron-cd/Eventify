const express = require('express');
const config = require('./config/environment');
const db = require('./db/database');
const registrationsRouter = require('./routes/registrations');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({
      status: 'ok',
      service: 'registration-api',
      version: process.env.BUILD_VERSION || 'dev',
      db: 'connected',
      uptime_seconds: Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'registration-api',
      version: process.env.BUILD_VERSION || 'dev',
      db: 'unreachable',
      uptime_seconds: Math.round(process.uptime()),
    });
  }
});

app.use('/registrations', registrationsRouter);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Registration API listening on port ${config.port}`);
  });
}

module.exports = app;