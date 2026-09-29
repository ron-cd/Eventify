require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  db: {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'student_org',
    user: process.env.DB_USER || 'student_org',
    password: process.env.DB_PASSWORD || 'change-me',
  },
  webhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
};