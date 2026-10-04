const express = require('express');
const multer = require('multer');
const router = express.Router();
const studentController = require('../controllers/studentController');
const requireAdmin = require('../middleware/requireAdmin');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', studentController.createStudent);
router.get('/', requireAdmin, studentController.getAllStudents);
router.post('/bulk-upload', requireAdmin, upload.single('file'), studentController.bulkUploadStudents);
router.delete('/:id', requireAdmin, studentController.deleteStudent);
router.get('/:studentNumber', studentController.getStudentByNumber);

module.exports = router;