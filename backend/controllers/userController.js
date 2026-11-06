const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Get all users (Admin only)
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.max_active_loans,
        (SELECT COUNT(*) FROM lending_records lr WHERE lr.user_id = u.id AND lr.status = 'APPROVED' AND lr.returned_date IS NULL) AS active_loans,
        (SELECT COUNT(*) FROM lending_records lr WHERE lr.user_id = u.id AND lr.status = 'APPROVED' AND lr.returned_date IS NULL AND lr.due_date < CURDATE()) AS overdue_loans,
        COALESCE((SELECT SUM(CASE WHEN lr.status = 'APPROVED' AND lr.returned_date IS NULL AND lr.due_date < CURDATE() THEN DATEDIFF(CURDATE(), lr.due_date) * 1.5 ELSE 0 END)
          FROM lending_records lr WHERE lr.user_id = u.id), 0) AS overdue_balance,
        u.created_at
      FROM users u
      ORDER BY u.created_at DESC`
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

const updateMemberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, max_active_loans } = req.body;

    if (max_active_loans !== undefined && (Number(max_active_loans) < 1 || Number.isNaN(Number(max_active_loans)))) {
      return res.status(400).json({
        success: false,
        message: 'Maximum active loans must be a positive number'
      });
    }

    const [existingUser] = await pool.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const nextIsActive = is_active !== undefined ? Number(is_active) : 1;
    const nextMaxActiveLoans = max_active_loans !== undefined ? Number(max_active_loans) : 5;

    await pool.execute(
      'UPDATE users SET is_active = ?, max_active_loans = ? WHERE id = ?',
      [nextIsActive, nextMaxActiveLoans, id]
    );

    const [users] = await pool.execute(
      'SELECT id, name, email, role, is_active, max_active_loans FROM users WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Member status updated successfully',
      data: { user: users[0] }
    });
  } catch (error) {
    logger.error('Update member status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating member status'
    });
  }
};

module.exports = {
  getAllUsers,
  updateMemberStatus
};
