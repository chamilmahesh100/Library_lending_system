const { body, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for user registration
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

/**
 * Validation rules for user login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

/**
 * Validation rules for book creation/update
 */
const validateBook = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters'),
  body('author')
    .trim()
    .notEmpty().withMessage('Author is required')
    .isLength({ min: 1, max: 255 }).withMessage('Author must be between 1 and 255 characters'),
  body('isbn')
    .trim()
    .notEmpty().withMessage('ISBN is required')
    .isLength({ min: 5, max: 10 }).withMessage('ISBN must be between 5 and 10 characters'),
  body('quantity')
    .isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateBook,
  handleValidationErrors
};

