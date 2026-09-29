const axios = require('axios');
const config = require('../config/environment');

async function sendRegistrationNotification({ studentName, eventName, registrationId, status }) {
  if (!config.webhookUrl) {
    console.warn('Webhook URL not configured — skipping notification.');
    return;
  }

  const payload = {
    content:
      `🎟️ **New Event Registration**\n\n` +
      `**Student:** ${studentName}\n` +
      `**Event:** ${eventName}\n` +
      `**Registration ID:** REG-${String(registrationId).padStart(4, '0')}\n` +
      `**Status:** ${status}`,
  };

  try {
    await axios.post(config.webhookUrl, payload, { timeout: 5000 });
    console.log(`Webhook sent successfully for registration REG-${registrationId}`);
  } catch (err) {
    // Intentionally NOT re-thrown — a webhook failure must never break registration
    console.error('Webhook failed:', err.message);
  }
}

module.exports = { sendRegistrationNotification };