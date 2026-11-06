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
    .isLength({ min: 5, max: 20 }).withMessage('ISBN must be between 5 and 20 characters'),
  body('publisher')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 }).withMessage('Publisher must be 255 characters or fewer'),
  body('publication_year')
    .optional({ nullable: true })
    .isInt({ min: 0, max: new Date().getFullYear() + 5 }).withMessage('Publication year is invalid'),
  body('edition')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Edition must be 100 characters or fewer'),
  body('language')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Language must be 100 characters or fewer'),
  body('shelf_location')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 255 }).withMessage('Shelf location must be 255 characters or fewer'),
  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 5000 }).withMessage('Description is too long'),
  body('category_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Category ID must be a valid positive integer'),
  body('quantity')
    .isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  handleValidationErrors
];

const validateCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('Category name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Category name must be between 2 and 255 characters'),
  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2000 }).withMessage('Description is too long'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateBook,
  validateCategory,
  handleValidationErrors
};

