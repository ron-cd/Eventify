const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.post('/', studentController.createStudent);
router.get('/:studentNumber', studentController.getStudentByNumber);

module.exports = router;