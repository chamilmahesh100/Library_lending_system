const express = require('express');
const router = express.Router();
const { getNotifications, markNotificationRead } = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const auditActivity = require('../middleware/auditActivity');

router.get('/', authenticate, getNotifications);
router.put('/:id/read', authenticate, auditActivity, markNotificationRead);

module.exports = router;
