const db = require('../db/database');
const { runCleanup } = require('../services/cleanupService');

async function getAllEvents(req, res) {
  try {
    const result = await db.query('SELECT * FROM events ORDER BY event_date ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
}

async function getEventById(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching event:', err.message);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
}

async function createEvent(req, res) {
  try {
    const { title, description, event_date, location, capacity, category } = req.body;
    if (!title || !event_date) {
      return res.status(400).json({ error: 'title and event_date are required' });
    }
    const result = await db.query(
      `INSERT INTO events (title, description, event_date, location, capacity, category)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || null, event_date, location || null, capacity || 0, category || 'general']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating event:', err.message);
    res.status(500).json({ error: 'Failed to create event' });
  }
}

async function updateEvent(req, res) {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT status FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (existing.rows[0].status === 'closed') {
      return res.status(403).json({ error: 'Closed events are final and cannot be edited.' });
    }

    const { title, description, event_date, location, capacity, status, category } = req.body;
    const result = await db.query(
      `UPDATE events SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         event_date = COALESCE($3, event_date),
         location = COALESCE($4, location),
         capacity = COALESCE($5, capacity),
         status = COALESCE($6, status),
         category = COALESCE($7, category),
         closed_at = CASE
           WHEN COALESCE($6, status) = 'closed' THEN NOW()
           ELSE closed_at
         END
       WHERE id = $8 RETURNING *`,
      [title, description, event_date, location, capacity, status, category, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating event:', err.message);
    res.status(500).json({ error: 'Failed to update event' });
  }
}

async function cleanupClosedEvents(req, res) {
  try {
    const threshold = req.query.olderThan || '2 days';
    const deleted = await runCleanup(threshold);
    res.json({ deleted_count: deleted.length, deleted });
  } catch (err) {
    console.error('Error running cleanup:', err.message);
    res.status(500).json({ error: 'Cleanup failed — olderThan must be a valid interval, e.g. "2 days" or "30 minutes"' });
  }
}

async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('Error deleting event:', err.message);
    res.status(500).json({ error: 'Failed to delete event' });
  }
}


module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  cleanupClosedEvents,
};