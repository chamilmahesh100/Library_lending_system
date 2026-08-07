const express = require('express');
const router = express.Router();
const {
  getAllBooks,
  getAvailableBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
} = require('../controllers/bookController');
const { validateBook } = require('../middleware/validation');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/books
 * @desc    Get all books (with pagination and search)
 * @access  Private
 */
router.get('/', authenticate, getAllBooks);

/**
 * @route   GET /api/books/available
 * @desc    Get available books
 * @access  Private
 */
router.get('/available', authenticate, getAvailableBooks);

/**
 * @route   GET /api/books/:id
 * @desc    Get single book by ID
 * @access  Private
 */
router.get('/:id', authenticate, getBookById);

/**
 * @route   POST /api/books
 * @desc    Create new book (Admin only)
 * @access  Private (Admin)
 */
router.post('/', authenticate, isAdmin, validateBook, createBook);

/**
 * @route   PUT /api/books/:id
 * @desc    Update book (Admin only)
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, isAdmin, validateBook, updateBook);

/**
 * @route   DELETE /api/books/:id
 * @desc    Delete book (Admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, isAdmin, deleteBook);

module.exports = router;

