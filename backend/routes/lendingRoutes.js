const express = require('express');
const router = express.Router();
const {
  borrowBook,
  approveBorrowRequest,
  rejectBorrowRequest,
  returnBook,
  getBorrowingHistory,
  getAllLendingRecords,
  renewLending,
  getOverdueRecords
} = require('../controllers/lendingController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   POST /api/lending/borrow
 * @desc    Borrow a book
 * @access  Private
 */
router.post('/borrow', authenticate, borrowBook);

/**
 * @route   PUT /api/lending/:id/approve
 * @desc    Approve a pending borrow request
 * @access  Private (Admin)
 */
router.put('/:id/approve', authenticate, isAdmin, approveBorrowRequest);

/**
 * @route   PUT /api/lending/:id/reject
 * @desc    Reject a pending borrow request
 * @access  Private (Admin)
 */
router.put('/:id/reject', authenticate, isAdmin, rejectBorrowRequest);

/**
 * @route   POST /api/lending/return
 * @desc    Return a book
 * @access  Private (Admin)
 */
router.post('/return', authenticate, isAdmin, returnBook);

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

/**
 * @route   POST /api/lending/:id/renew
 * @desc    Renew an active loan for a user
 * @access  Private
 */
router.post('/:id/renew', authenticate, renewLending);

/**
 * @route   GET /api/lending/overdue
 * @desc    Get overdue lending records (Admin only)
 * @access  Private (Admin)
 */
router.get('/overdue', authenticate, isAdmin, getOverdueRecords);

module.exports = router;
