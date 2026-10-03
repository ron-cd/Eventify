const db = require('../db/database');

async function createStudent(req, res) {
  try {
    const { student_number, name, email } = req.body;
    if (!student_number || !name || !email) {
      return res.status(400).json({ error: 'student_number, name, and email are required' });
    }
    const result = await db.query(
      `INSERT INTO students (student_number, name, email) VALUES ($1, $2, $3) RETURNING *`,
      [student_number, name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // unique_violation (student_number or email already exists)
      return res.status(409).json({ error: 'Student already exists' });
    }
    console.error('Error creating student:', err.message);
    res.status(500).json({ error: 'Failed to create student' });
  }
}

async function getStudentByNumber(req, res) {
  try {
    const { studentNumber } = req.params;
    const result = await db.query('SELECT * FROM students WHERE student_number = $1', [studentNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching student:', err.message);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
}

module.exports = { createStudent, getStudentByNumber };