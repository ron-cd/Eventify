const db = require('../db/database');
const { sendRegistrationNotification } = require('../services/notificationService');

async function createRegistration(req, res) {
  try {
    const { student_id, event_id } = req.body;
    if (!student_id || !event_id) {
      return res.status(400).json({ error: 'student_id and event_id are required' });
    }

    const eventResult = await db.query('SELECT * FROM events WHERE id = $1', [event_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventResult.rows[0];

    if (event.status !== 'open') {
      return res.status(400).json({ error: 'Event is not open for registration' });
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM registrations WHERE event_id = $1 AND status = 'registered'`,
      [event_id]
    );
    const currentCount = parseInt(countResult.rows[0].count, 10);
    if (event.capacity > 0 && currentCount >= event.capacity) {
      return res.status(400).json({ error: 'Event is at full capacity' });
    }

    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [student_id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const student = studentResult.rows[0];

    let registration;
    try {
      const insertResult = await db.query(
        `INSERT INTO registrations (student_id, event_id) VALUES ($1, $2) RETURNING *`,
        [student_id, event_id]
      );
      registration = insertResult.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Student is already registered for this event' });
      }
      throw err;
    }

    await sendRegistrationNotification({
      studentName: student.name,
      eventName: event.title,
      registrationId: registration.id,
      status: registration.status,
    });

    res.status(201).json(registration);
  } catch (err) {
    console.error('Error creating registration:', err.message);
    res.status(500).json({ error: 'Failed to create registration' });
  }
}

async function getRegistrationById(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM registrations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching registration:', err.message);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
}

async function getRegistrationsByEvent(req, res) {
  try {
    const { eventId } = req.params;
    const result = await db.query(
      `SELECT r.id, r.status, r.registered_at, s.name, s.student_number, s.email
       FROM registrations r
       JOIN students s ON r.student_id = s.id
       WHERE r.event_id = $1
       ORDER BY r.registered_at ASC`,
      [eventId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching registrations:', err.message);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
}

async function updateRegistrationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const result = await db.query(
      `UPDATE registrations SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating registration:', err.message);
    res.status(500).json({ error: 'Failed to update registration' });
  }
}

async function exportEventAttendance(req, res) {
  try {
    const { eventId } = req.params;

    const eventResult = await db.query(
      'SELECT title, event_date, location FROM events WHERE id = $1',
      [eventId]
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const attendanceResult = await db.query(
      `SELECT s.name, s.student_number, s.email, r.status, r.registered_at
       FROM registrations r
       JOIN students s ON r.student_id = s.id
       WHERE r.event_id = $1
       ORDER BY r.registered_at ASC`,
      [eventId]
    );

    res.json({
      event: eventResult.rows[0],
      attendees: attendanceResult.rows,
    });
  } catch (err) {
    console.error('Error exporting attendance:', err.message);
    res.status(500).json({ error: 'Failed to export attendance' });
  }
}

async function getTotalRegistrations(req, res) {
  try {
    const result = await db.query('SELECT COUNT(*) FROM registrations');
    res.json({ total: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('Error counting registrations:', err.message);
    res.status(500).json({ error: 'Failed to count registrations' });
  }
}

module.exports = {
  createRegistration,
  getRegistrationById,
  getRegistrationsByEvent,
  updateRegistrationStatus,
  exportEventAttendance,
  getTotalRegistrations,
};