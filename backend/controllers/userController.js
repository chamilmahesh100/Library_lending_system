const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Get all users (Admin only)
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    logger.info(`All users retrieved by admin ${req.user.id}: ${users.length} users`);

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
};

module.exports = {
  getAllUsers
};

