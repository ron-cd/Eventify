const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

router.post('/', registrationController.createRegistration);
router.get('/:id', registrationController.getRegistrationById);
router.get('/event/:eventId', registrationController.getRegistrationsByEvent);
router.put('/:id/status', registrationController.updateRegistrationStatus);

module.exports = router;