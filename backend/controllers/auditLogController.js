const { pool } = require('../config/database');
const logger = require('../config/logger');

const getAuditLogs = async (req, res) => {
  try {
    const [logs] = await pool.execute(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.description, al.created_at,
              u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT 100`,
      []
    );

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching audit logs'
    });
  }
};

module.exports = {
  getAuditLogs
};
