const express = require('express');
const router = express.Router();
const { getAllUsers, updateMemberStatus } = require('../controllers/userController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/', authenticate, isAdmin, getAllUsers);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Update member active status and borrowing limit (Admin only)
 * @access  Private (Admin)
 */
router.put('/:id/status', authenticate, isAdmin, updateMemberStatus);

module.exports = router;

