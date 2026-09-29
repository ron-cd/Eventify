const express = require('express');
const config = require('./config/environment');
const registrationsRouter = require('./routes/registrations');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'registration-api' });
});

app.use('/registrations', registrationsRouter);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Registration API listening on port ${config.port}`);
  });
}

module.exports = app;