const db = require('../db/database');
const XLSX = require('xlsx');

async function createStudent(req, res) {
  try {
    const { student_number, name, email } = req.body;
    if (!student_number || !name) {
      return res.status(400).json({ error: 'student_number and name are required' });
    }
    const result = await db.query(
      `INSERT INTO students (student_number, name, email) VALUES ($1, $2, $3) RETURNING *`,
      [student_number, name, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
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

async function getAllStudents(req, res) {
  try {
    const result = await db.query('SELECT * FROM students ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching students:', err.message);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

async function bulkUploadStudents(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    const headers = rows[0].map(h => String(h).toLowerCase().trim());
    const idCol = headers.findIndex(h => h.includes('id') || h.includes('number'));
    const nameCol = headers.findIndex(h => h.includes('name'));
    const emailCol = headers.findIndex(h => h.includes('email'));

    if (idCol === -1 || nameCol === -1) {
      return res.status(400).json({
        error: 'Could not find required columns. Expected a header row with a column containing "id"/"number" and one containing "name".',
      });
    }

    const dataRows = rows.slice(1).filter(r => r[idCol] && r[nameCol]);

    let added = 0;
    const skipped = [];

    for (const row of dataRows) {
      const student_number = String(row[idCol]).trim();
      const name = String(row[nameCol]).trim();
      const email = emailCol !== -1 && row[emailCol] ? String(row[emailCol]).trim() : null;

      // Catch IDs that look like Excel auto-converted them to a date
      const looksLikeDate = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(student_number);
      if (looksLikeDate) {
        skipped.push({
          student_number,
          reason: 'looks like Excel auto-converted this ID to a date — format the ID column as Text in Excel and re-enter it',
        });
        continue;
      }

      try {
        await db.query(
          `INSERT INTO students (student_number, name, email) VALUES ($1, $2, $3)`,
          [student_number, name, email]
        );
        added++;
      } catch (err) {
        if (err.code === '23505') {
          skipped.push({ student_number, reason: 'already exists (duplicate ID or email)' });
        } else {
          skipped.push({ student_number, reason: 'invalid row' });
        }
      }
    }

    res.json({ added, skipped_count: skipped.length, skipped });
  } catch (err) {
    console.error('Error bulk uploading students:', err.message);
    res.status(500).json({ error: 'Failed to process the uploaded file' });
  }
}

async function deleteStudent(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('Error deleting student:', err.message);
    res.status(500).json({ error: 'Failed to delete student' });
  }
}

module.exports = { createStudent, getStudentByNumber, getAllStudents, bulkUploadStudents, deleteStudent };