const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.post('/', requireAdmin, eventController.createEvent);
router.put('/:id', requireAdmin, eventController.updateEvent);
router.delete('/:id', requireAdmin, eventController.deleteEvent);
router.post('/cleanup', requireAdmin, eventController.cleanupClosedEvents);

module.exports = router;