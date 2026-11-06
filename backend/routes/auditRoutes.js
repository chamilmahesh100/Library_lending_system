const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { authenticate, isAdmin } = require('../middleware/auth');

router.get('/', authenticate, isAdmin, getAuditLogs);

module.exports = router;
