const db = require('../db/database');

async function runCleanup(threshold = '2 days') {
  const result = await db.query(
    `DELETE FROM events
     WHERE status = 'closed'
       AND closed_at IS NOT NULL
       AND closed_at <= NOW() - $1::interval
     RETURNING id, title`,
    [threshold]
  );
  return result.rows;
}

module.exports = { runCleanup };