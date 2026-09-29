const express = require('express');
const config = require('./config/environment');
const eventsRouter = require('./routes/events');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'event-api' });
});

app.use('/events', eventsRouter);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Event API listening on port ${config.port}`);
  });
}

module.exports = app;