const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Middleware to verify JWT token
 * Extracts user information from token and attaches to request
 */
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required. Please login.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token. Please login again.' 
    });
  }
};

/**
 * Middleware to check if user is admin
 * Must be used after authenticate middleware
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized admin access attempt by user ${req.user.id}`);
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

module.exports = {
  authenticate,
  isAdmin
};

