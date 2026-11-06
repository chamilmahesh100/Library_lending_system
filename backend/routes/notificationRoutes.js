const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getNotifications);
router.put('/:id/read', authenticate, markNotificationRead);

module.exports = router;
