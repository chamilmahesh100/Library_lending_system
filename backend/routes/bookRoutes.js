const express = require('express');
const router = express.Router();
const {
  getAllBooks,
  getAvailableBooks,
  getBookById,
  getBookCopies,
  createBookCopy,
  searchBooks,
  createBook,
  updateBook,
  deleteBook,
  updateCopyStatus
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
 * @route   GET /api/books/search
 * @desc    Advanced book search with filters and sorting
 * @access  Private
 */
router.get('/search', authenticate, searchBooks);

/**
 * @route   GET /api/books/available
 * @desc    Get available books
 * @access  Private
 */
router.get('/available', authenticate, getAvailableBooks);

/**
 * @route   GET /api/books/:id/copies
 * @desc    Get all copies for a book
 * @access  Private
 */
router.get('/:id/copies', authenticate, getBookCopies);

/**
 * @route   POST /api/books/:id/copies
 * @desc    Create a new physical copy for a book
 * @access  Private (Admin)
 */
router.post('/:id/copies', authenticate, isAdmin, createBookCopy);

/**
 * @route   PUT /api/books/:id/copies/:copyId/status
 * @desc    Update a physical copy status (available, damaged, lost, etc.)
 * @access  Private (Admin)
 */
router.put('/:id/copies/:copyId/status', authenticate, isAdmin, updateCopyStatus);

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

