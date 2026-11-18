const { pool } = require('../config/database');
const logger = require('../config/logger');

const createAuditLog = async (userId, action, entityType, entityId, description) => {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId || null, action, entityType || null, entityId || null, description || null]
    );
  } catch (error) {
    logger.error(`Audit log insert failed: ${error.message}`);
  }
};

module.exports = createAuditLog;
