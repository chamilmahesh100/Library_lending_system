const { pool } = require('../config/database');
const logger = require('../config/logger');

const DAILY_FINE_RATE = 1.5;

/**
 * Borrow a book
 * POST /api/lending/borrow
 */
const borrowBook = async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const { book_id } = req.body;
    const user_id = req.user.id;

    if (!book_id) {
      return res.status(400).json({ success: false, message: 'Book ID is required' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [books] = await connection.execute(
      'SELECT id, available_quantity FROM books WHERE id = ? FOR UPDATE',
      [book_id]
    );
    if (books.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [userRows] = await connection.execute(
      'SELECT id, is_active, max_active_loans FROM users WHERE id = ? FOR UPDATE',
      [user_id]
    );
    if (userRows.length === 0 || userRows[0].is_active === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(403).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    const [activeLoanCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM lending_records WHERE user_id = ? AND status = 'APPROVED' AND returned_date IS NULL",
      [user_id]
    );
    const [pendingRequestCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM lending_records WHERE user_id = ? AND status = 'PENDING'",
      [user_id]
    );
    const [overdueCount] = await connection.execute(
      "SELECT COUNT(*) as count FROM lending_records WHERE user_id = ? AND status = 'APPROVED' AND returned_date IS NULL AND due_date < CURDATE()",
      [user_id]
    );

    const maxActiveLoans = Number(userRows[0].max_active_loans || 5);
    if (Number(activeLoanCount[0].count) + Number(pendingRequestCount[0].count) >= maxActiveLoans) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: `Borrowing limit reached. Maximum active loans and pending requests: ${maxActiveLoans}`
      });
    }

    if (Number(overdueCount[0].count) > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'This member has overdue books and cannot borrow new items until they are returned.'
      });
    }

    const [existingRequests] = await connection.execute(
      "SELECT id FROM lending_records WHERE user_id = ? AND book_id = ? AND status IN ('PENDING', 'APPROVED') AND (status = 'PENDING' OR returned_date IS NULL)",
      [user_id, book_id]
    );
    if (existingRequests.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'You already have a pending request or active loan for this book'
      });
    }

    const [availableCopies] = await connection.execute(
      'SELECT id FROM book_copies WHERE book_id = ? AND status = ? ORDER BY id LIMIT 1 FOR UPDATE',
      [book_id, 'AVAILABLE']
    );
    if (availableCopies.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'No copies available for this book'
      });
    }

    const [copyUpdate] = await connection.execute(
      'UPDATE book_copies SET status = ? WHERE id = ? AND status = ?',
      ['RESERVED', availableCopies[0].id, 'AVAILABLE']
    );
    if (copyUpdate.affectedRows === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: 'The available copy was just requested by someone else. Please try again.'
      });
    }

    const [result] = await connection.execute(
      "INSERT INTO lending_records (user_id, book_id, copy_id, status) VALUES (?, ?, ?, 'PENDING')",
      [user_id, book_id, availableCopies[0].id]
    );
    const [bookUpdate] = await connection.execute(
      'UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ? AND available_quantity > 0',
      [book_id]
    );
    if (bookUpdate.affectedRows === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: 'No copies are currently available for this book'
      });
    }
    await connection.commit();
    transactionStarted = false;

    logger.info(`Borrow request created: User ${user_id}, Book ${book_id} (Lending ID: ${result.insertId})`);
    res.status(201).json({
      success: true,
      message: 'Borrow request submitted. The book will be available after admin approval.',
      data: {
        lending_record: {
          id: result.insertId,
          user_id,
          book_id,
          copy_id: availableCopies[0].id,
          status: 'PENDING'
        }
      }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    logger.error('Borrow book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating borrow request'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const approveBorrowRequest = async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [requests] = await connection.execute(
      `SELECT lr.id, lr.user_id, lr.book_id, lr.copy_id, b.title,
              u.is_active, u.max_active_loans
       FROM lending_records lr
       JOIN books b ON b.id = lr.book_id
       JOIN users u ON u.id = lr.user_id
       WHERE lr.id = ? AND lr.status = 'PENDING'
       FOR UPDATE`,
      [req.params.id]
    );
    if (requests.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: 'Pending borrow request not found' });
    }

    const request = requests[0];
    if (!request.is_active) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: 'Cannot approve a request for an inactive member' });
    }

    const [activeLoans] = await connection.execute(
      "SELECT COUNT(*) as count FROM lending_records WHERE user_id = ? AND status = 'APPROVED' AND returned_date IS NULL",
      [request.user_id]
    );
    const maxActiveLoans = Number(request.max_active_loans || 5);
    if (Number(activeLoans[0].count) >= maxActiveLoans) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: `Member has reached the maximum active loan limit of ${maxActiveLoans}`
      });
    }

    const [overdueLoans] = await connection.execute(
      "SELECT id FROM lending_records WHERE user_id = ? AND status = 'APPROVED' AND returned_date IS NULL AND due_date < CURDATE() LIMIT 1",
      [request.user_id]
    );
    if (overdueLoans.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: 'Member has overdue books and cannot borrow a new item' });
    }

    const [existingLoans] = await connection.execute(
      "SELECT id FROM lending_records WHERE user_id = ? AND book_id = ? AND status = 'APPROVED' AND returned_date IS NULL AND id <> ?",
      [request.user_id, request.book_id, request.id]
    );
    if (existingLoans.length > 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ success: false, message: 'Member already has an active loan for this book' });
    }

    const borrowedDate = new Date();
    const dueDate = new Date(borrowedDate);
    dueDate.setDate(dueDate.getDate() + 14);
    const [copyUpdate] = await connection.execute(
      'UPDATE book_copies SET status = ? WHERE id = ? AND status = ?',
      ['BORROWED', request.copy_id, 'RESERVED']
    );
    if (copyUpdate.affectedRows === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ success: false, message: 'The reserved physical copy is no longer available' });
    }

    await connection.execute(
      "UPDATE lending_records SET status = 'APPROVED', borrowed_date = ?, due_date = ? WHERE id = ?",
      [borrowedDate, dueDate, request.id]
    );
    await connection.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [request.user_id, 'Borrow request approved', `Your request for "${request.title}" was approved. You can now collect the book.`, 'lending']
    );
    await connection.commit();
    transactionStarted = false;

    logger.info(`Borrow request ${request.id} approved by admin ${req.user.id}`);
    res.json({
      success: true,
      message: 'Borrow request approved. The book is ready for collection.',
      data: { lending_record: { id: request.id, status: 'APPROVED', borrowed_date: borrowedDate, due_date: dueDate } }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    logger.error('Approve borrow request error:', error);
    res.status(500).json({ success: false, message: 'Server error while approving borrow request' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const rejectBorrowRequest = async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [requests] = await connection.execute(
      `SELECT lr.id, lr.user_id, lr.book_id, lr.copy_id, b.title
       FROM lending_records lr
       JOIN books b ON b.id = lr.book_id
       WHERE lr.id = ? AND lr.status = 'PENDING'
       FOR UPDATE`,
      [req.params.id]
    );
    if (requests.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ success: false, message: 'Pending borrow request not found' });
    }

    const request = requests[0];
    const [copyUpdate] = await connection.execute(
      'UPDATE book_copies SET status = ? WHERE id = ? AND status = ?',
      ['AVAILABLE', request.copy_id, 'RESERVED']
    );
    if (copyUpdate.affectedRows === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ success: false, message: 'The reserved physical copy could not be released' });
    }
    await connection.execute(
      "UPDATE lending_records SET status = 'REJECTED', copy_id = NULL WHERE id = ?",
      [request.id]
    );
    await connection.execute(
      'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
      [request.book_id]
    );
    await connection.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [request.user_id, 'Borrow request declined', `Your request for "${request.title}" was declined by the library admin.`, 'lending']
    );
    await connection.commit();
    transactionStarted = false;

    logger.info(`Borrow request ${request.id} rejected by admin ${req.user.id}`);
    res.json({ success: true, message: 'Borrow request rejected and the copy made available again.' });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    logger.error('Reject borrow request error:', error);
    res.status(500).json({ success: false, message: 'Server error while rejecting borrow request' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Return a book
 * POST /api/lending/return
 */
const returnBook = async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const { lending_id, fine_amount } = req.body;
    if (!lending_id) {
      return res.status(400).json({
        success: false,
        message: 'Lending record ID is required'
      });
    }

    const fineValue = typeof fine_amount === 'number' ? String(fine_amount) : fine_amount;
    if (typeof fineValue !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(fineValue)) {
      return res.status(400).json({
        success: false,
        message: 'Fine amount must be a non-negative monetary value with up to two decimal places'
      });
    }

    const parsedFineAmount = Number(fineValue);
    if (!Number.isFinite(parsedFineAmount) || parsedFineAmount > 99999999.99) {
      return res.status(400).json({
        success: false,
        message: 'Fine amount must not exceed 99999999.99'
      });
    }

    const finalFineAmount = parsedFineAmount.toFixed(2);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [lendings] = await connection.execute(
      `SELECT lr.id, lr.book_id,
              DATE_FORMAT(lr.due_date, '%Y-%m-%d') AS due_date,
              bc.id as copy_id
       FROM lending_records lr
       LEFT JOIN book_copies bc ON bc.id = lr.copy_id
       WHERE lr.id = ? AND lr.status = 'APPROVED' AND lr.returned_date IS NULL
       FOR UPDATE`,
      [lending_id]
    );

    if (lendings.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: 'Active lending record not found'
      });
    }

    const lending = lendings[0];
    const returned_date = new Date();

    const copyId = lending.copy_id || ((await connection.execute(
      'SELECT id FROM book_copies WHERE book_id = ? AND status = ? ORDER BY id LIMIT 1 FOR UPDATE',
      [lending.book_id, 'BORROWED']
    ))[0][0]?.id);

    if (!copyId) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: 'No borrowed physical copy is linked to this active loan'
      });
    }

    const [copyUpdate] = await connection.execute(
      'UPDATE book_copies SET status = ? WHERE id = ? AND status = ?',
      ['AVAILABLE', copyId, 'BORROWED']
    );

    if (copyUpdate.affectedRows === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: 'The physical copy is not marked as borrowed'
      });
    }

    await connection.execute(
      'UPDATE lending_records SET returned_date = ?, fine_amount = ? WHERE id = ?',
      [returned_date, finalFineAmount, lending_id]
    );

    await connection.execute(
      'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
      [lending.book_id]
    );

    await connection.commit();
    transactionStarted = false;

    logger.info(`Book returned by admin ${req.user.id}: Book ${lending.book_id} (Lending ID: ${lending_id})`);

    res.json({
      success: true,
      message: `Book returned successfully. Fine: $${finalFineAmount}`,
      data: {
        lending_record: {
          id: lending_id,
          returned_date,
          fine_amount: Number(finalFineAmount)
        }
      }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    logger.error('Return book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while returning book'
    });
  } finally {
    if (connection) {
      connection.release();
    }
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
      `SELECT lr.id,
        lr.status,
        lr.created_at,
        lr.borrowed_date,
        DATE_FORMAT(lr.due_date, '%Y-%m-%d') AS due_date,
        lr.returned_date,
        lr.fine_amount,
        lr.copy_id,
        bc.accession_number,
        b.id as book_id,
        b.title,
        b.author,
        b.isbn
      FROM lending_records lr
      JOIN books b ON lr.book_id = b.id
      LEFT JOIN book_copies bc ON bc.id = lr.copy_id
      WHERE lr.user_id = ?
      ORDER BY COALESCE(lr.borrowed_date, DATE(lr.created_at)) DESC`,
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
      `SELECT lr.id,
        lr.user_id,
        lr.book_id,
        lr.copy_id,
        bc.accession_number,
        lr.borrowed_date,
        DATE_FORMAT(lr.due_date, '%Y-%m-%d') AS due_date,
        lr.returned_date,
        lr.fine_amount,
        lr.renewal_count,
        lr.status,
        lr.created_at,
        u.name as user_name,
        u.email as user_email,
        b.title as book_title,
        b.author as book_author,
        b.isbn
      FROM lending_records lr
      JOIN users u ON lr.user_id = u.id
      JOIN books b ON lr.book_id = b.id
      LEFT JOIN book_copies bc ON bc.id = lr.copy_id
      ORDER BY (lr.status = 'PENDING') DESC, COALESCE(lr.borrowed_date, DATE(lr.created_at)) DESC`
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

const renewLending = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const [records] = await pool.execute(
      `SELECT lr.*, bc.status as copy_status
       FROM lending_records lr
       LEFT JOIN book_copies bc ON bc.id = lr.copy_id
       WHERE lr.id = ? AND lr.user_id = ? AND lr.status = 'APPROVED' AND lr.returned_date IS NULL`,
      [id, user_id]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active lending record not found for this user'
      });
    }

    const lending = records[0];

    if (lending.renewal_count >= 2) {
      return res.status(400).json({
        success: false,
        message: 'This lending record has reached the maximum number of renewals.'
      });
    }

    const dueDateRaw = lending.due_date instanceof Date
      ? `${lending.due_date.getFullYear()}-${String(lending.due_date.getMonth() + 1).padStart(2, '0')}-${String(lending.due_date.getDate()).padStart(2, '0')}`
      : String(lending.due_date || '').slice(0, 10);
    const dueDate = new Date(`${dueDateRaw}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(dueDate.getTime()) || dueDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot renew an overdue loan.'
      });
    }

    const renewedDueDate = new Date(dueDate);
    renewedDueDate.setDate(renewedDueDate.getDate() + 7);
    const renewedDueDateString = `${renewedDueDate.getFullYear()}-${String(renewedDueDate.getMonth() + 1).padStart(2, '0')}-${String(renewedDueDate.getDate()).padStart(2, '0')}`;

    await pool.execute(
      'UPDATE lending_records SET due_date = ?, renewal_count = renewal_count + 1 WHERE id = ?',
      [renewedDueDateString, id]
    );

    logger.info(`Loan renewed: user ${user_id}, lending ${id}, new due date ${renewedDueDateString}`);

    res.json({
      success: true,
      message: 'Loan renewed successfully',
      data: {
        lending: {
          id: Number(id),
          due_date: renewedDueDateString,
          renewal_count: Number(lending.renewal_count) + 1
        }
      }
    });
  } catch (error) {
    logger.error('Renew lending error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while renewing the loan'
    });
  }
};

const getOverdueRecords = async (req, res) => {
  try {
    const [records] = await pool.execute(
      `SELECT lr.id,
        lr.user_id,
        u.name as user_name,
        u.email as user_email,
        b.id as book_id,
        b.title as book_title,
        b.author as book_author,
        lr.borrowed_date,
        lr.due_date,
        DATEDIFF(CURDATE(), lr.due_date) AS overdue_days,
        ROUND(DATEDIFF(CURDATE(), lr.due_date) * ?, 2) AS overdue_fine
      FROM lending_records lr
      JOIN users u ON lr.user_id = u.id
      JOIN books b ON lr.book_id = b.id
      WHERE lr.status = 'APPROVED' AND lr.returned_date IS NULL AND lr.due_date < CURDATE()
      ORDER BY lr.due_date ASC`,
      [DAILY_FINE_RATE]
    );

    logger.info(`Overdue records retrieved by admin ${req.user.id}: ${records.length} records`);

    res.json({
      success: true,
      data: { records }
    });
  } catch (error) {
    logger.error('Get overdue records error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching overdue records'
    });
  }
};

module.exports = {
  borrowBook,
  approveBorrowRequest,
  rejectBorrowRequest,
  returnBook,
  getBorrowingHistory,
  getAllLendingRecords,
  renewLending,
  getOverdueRecords
};
