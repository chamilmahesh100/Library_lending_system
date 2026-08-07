const express = require('express');
const router = express.Router();
const {
  borrowBook,
  returnBook,
  getBorrowingHistory,
  getAllLendingRecords
} = require('../controllers/lendingController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   POST /api/lending/borrow
 * @desc    Borrow a book
 * @access  Private
 */
router.post('/borrow', authenticate, borrowBook);

/**
 * @route   POST /api/lending/return
 * @desc    Return a book
 * @access  Private
 */
router.post('/return', authenticate, returnBook);

/**
 * @route   GET /api/lending/history
 * @desc    Get user's borrowing history
 * @access  Private
 */
router.get('/history', authenticate, getBorrowingHistory);

/**
 * @route   GET /api/lending/all
 * @desc    Get all lending records (Admin only)
 * @access  Private (Admin)
 */
router.get('/all', authenticate, isAdmin, getAllLendingRecords);

module.exports = router;

