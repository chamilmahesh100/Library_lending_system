const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Borrow a book
 * POST /api/lending/borrow
 */
const borrowBook = async (req, res) => {
  try {
    const { book_id } = req.body;
    const user_id = req.user.id;

    // Check if book exists and is available
    const [books] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [book_id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const book = books[0];

    if (book.available_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Book is not available for borrowing'
      });
    }

    // Check if user already has this book borrowed and not returned
    const [activeLendings] = await pool.execute(
      'SELECT id FROM lending_records WHERE user_id = ? AND book_id = ? AND returned_date IS NULL',
      [user_id, book_id]
    );

    if (activeLendings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already borrowed this book'
      });
    }

    // Calculate due date (14 days from today)
    const borrowed_date = new Date();
    const due_date = new Date(borrowed_date);
    due_date.setDate(due_date.getDate() + 14);

    // Create lending record
    const [result] = await pool.execute(
      'INSERT INTO lending_records (user_id, book_id, borrowed_date, due_date) VALUES (?, ?, ?, ?)',
      [user_id, book_id, borrowed_date, due_date]
    );

    // Decrement available_quantity
    await pool.execute(
      'UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?',
      [book_id]
    );

    logger.info(`Book borrowed: User ${user_id} borrowed Book ${book_id} (Lending ID: ${result.insertId})`);

    res.status(201).json({
      success: true,
      message: 'Book borrowed successfully',
      data: {
        lending_record: {
          id: result.insertId,
          user_id,
          book_id,
          borrowed_date,
          due_date
        }
      }
    });
  } catch (error) {
    logger.error('Borrow book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while borrowing book'
    });
  }
};

/**
 * Return a book
 * POST /api/lending/return
 */
const returnBook = async (req, res) => {
  try {
    const { lending_id } = req.body;
    const user_id = req.user.id;

    // Find lending record
    const [lendings] = await pool.execute(
      'SELECT * FROM lending_records WHERE id = ? AND user_id = ?',
      [lending_id, user_id]
    );

    if (lendings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lending record not found or you do not have permission to return this book'
      });
    }

    const lending = lendings[0];

    if (lending.returned_date !== null) {
      return res.status(400).json({
        success: false,
        message: 'This book has already been returned'
      });
    }

    // Update lending record with return date
    const returned_date = new Date();
    await pool.execute(
      'UPDATE lending_records SET returned_date = ? WHERE id = ?',
      [returned_date, lending_id]
    );

    // Increment available_quantity
    await pool.execute(
      'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
      [lending.book_id]
    );

    logger.info(`Book returned: User ${user_id} returned Book ${lending.book_id} (Lending ID: ${lending_id})`);

    res.json({
      success: true,
      message: 'Book returned successfully',
      data: {
        lending_record: {
          id: lending_id,
          returned_date
        }
      }
    });
  } catch (error) {
    logger.error('Return book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while returning book'
    });
  }
};

/**
 * Get user's borrowing history
 * GET /api/lending/history
 */
const getBorrowingHistory = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [records] = await pool.execute(
      `SELECT 
        lr.id,
        lr.borrowed_date,
        lr.due_date,
        lr.returned_date,
        lr.fine_amount,
        b.id as book_id,
        b.title,
        b.author,
        b.isbn
      FROM lending_records lr
      JOIN books b ON lr.book_id = b.id
      WHERE lr.user_id = ?
      ORDER BY lr.borrowed_date DESC`,
      [user_id]
    );

    logger.info(`Borrowing history retrieved for user ${user_id}: ${records.length} records`);

    res.json({
      success: true,
      data: { records }
    });
  } catch (error) {
    logger.error('Get borrowing history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching borrowing history'
    });
  }
};

/**
 * Get all lending records (Admin only)
 * GET /api/lending/all
 */
const getAllLendingRecords = async (req, res) => {
  try {
    const [records] = await pool.execute(
      `SELECT 
        lr.id,
        lr.user_id,
        lr.book_id,
        lr.borrowed_date,
        lr.due_date,
        lr.returned_date,
        lr.fine_amount,
        u.name as user_name,
        u.email as user_email,
        b.title as book_title,
        b.author as book_author,
        b.isbn
      FROM lending_records lr
      JOIN users u ON lr.user_id = u.id
      JOIN books b ON lr.book_id = b.id
      ORDER BY lr.borrowed_date DESC`
    );

    logger.info(`All lending records retrieved by admin ${req.user.id}: ${records.length} records`);

    res.json({
      success: true,
      data: { records }
    });
  } catch (error) {
    logger.error('Get all lending records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching lending records'
    });
  }
};

module.exports = {
  borrowBook,
  returnBook,
  getBorrowingHistory,
  getAllLendingRecords
};

