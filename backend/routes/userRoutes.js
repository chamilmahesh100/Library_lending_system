const express = require('express');
const router = express.Router();
const { getAllUsers } = require('../controllers/userController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/', authenticate, isAdmin, getAllUsers);

module.exports = router;

