const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const requireAdmin = require('../middleware/requireAdmin');

router.post('/', registrationController.createRegistration);
router.get('/:id', registrationController.getRegistrationById);
router.get('/event/:eventId', requireAdmin, registrationController.getRegistrationsByEvent);
router.put('/:id/status', requireAdmin, registrationController.updateRegistrationStatus);

module.exports = router;