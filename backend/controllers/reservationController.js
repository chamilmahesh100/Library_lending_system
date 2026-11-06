const { pool } = require('../config/database');
const logger = require('../config/logger');

const createAuditLog = async (userId, action, entityType, entityId, description) => {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?)',
      [userId, action, entityType, entityId, description]
    );
  } catch (error) {
    logger.warn(`Audit log insert failed: ${error.message}`);
  }
};

const getUserReservations = async (req, res) => {
  try {
    const [reservations] = await pool.execute(
      `SELECT r.id, r.book_id, r.status, r.reservation_date, r.fulfilled_at, b.title, b.author, b.isbn
       FROM reservations r
       JOIN books b ON b.id = r.book_id
       WHERE r.user_id = ?
       ORDER BY r.reservation_date DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: { reservations }
    });
  } catch (error) {
    logger.error('Get user reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reservations'
    });
  }
};

const createReservation = async (req, res) => {
  try {
    const { book_id } = req.body;
    const user_id = req.user.id;

    if (!book_id) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required'
      });
    }

    const [books] = await pool.execute('SELECT id, title, available_quantity FROM books WHERE id = ?', [book_id]);
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [existingReservations] = await pool.execute(
      'SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status = ? ',
      [user_id, book_id, 'WAITING']
    );

    if (existingReservations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation for this book'
      });
    }

    const [activeLoan] = await pool.execute(
      "SELECT id FROM lending_records WHERE user_id = ? AND book_id = ? AND (status = 'PENDING' OR (status = 'APPROVED' AND returned_date IS NULL))",
      [user_id, book_id]
    );

    if (activeLoan.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You cannot reserve a book you have already requested or borrowed'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO reservations (user_id, book_id, status, active_reservation) VALUES (?, ?, ?, ?)',
      [user_id, book_id, 'WAITING', 1]
    );

    await pool.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [
        user_id,
        'Reservation created',
        `Your reservation for "${books[0].title}" is active and will be reviewed when it becomes available.`,
        'reservation'
      ]
    );

    await createAuditLog(
      user_id,
      'CREATE_RESERVATION',
      'reservation',
      result.insertId,
      `Created reservation for book ${book_id}`
    );

    logger.info(`Reservation created for user ${user_id}, book ${book_id}`);

    res.status(201).json({
      success: true,
      message: 'Book reserved successfully',
      data: {
        reservation: {
          id: result.insertId,
          user_id,
          book_id,
          status: 'WAITING'
        }
      }
    });
  } catch (error) {
    logger.error('Create reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating reservation'
    });
  }
};

const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const [reservations] = await pool.execute(
      'SELECT * FROM reservations WHERE id = ? AND user_id = ?',
      [id, user_id]
    );

    if (reservations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found or you do not have permission to cancel it'
      });
    }

    await pool.execute(
      'UPDATE reservations SET status = ?, active_reservation = NULL WHERE id = ?',
      ['CANCELLED', id]
    );

    await createAuditLog(
      user_id,
      'CANCEL_RESERVATION',
      'reservation',
      Number(id),
      `Cancelled reservation ${id}`
    );

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling reservation'
    });
  }
};

const getAllReservations = async (req, res) => {
  try {
    const [reservations] = await pool.execute(
      `SELECT r.id, r.user_id, u.name as user_name, u.email as user_email, r.book_id, b.title as book_title,
              r.status, r.reservation_date, r.fulfilled_at
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       JOIN books b ON b.id = r.book_id
       ORDER BY r.reservation_date DESC`
    );

    res.json({
      success: true,
      data: { reservations }
    });
  } catch (error) {
    logger.error('Get all reservations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reservations'
    });
  }
};

const fulfillReservation = async (req, res) => {
  try {
    const { id } = req.params;

    const [reservations] = await pool.execute(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    );

    if (reservations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    const reservation = reservations[0];

    await pool.execute(
      'UPDATE reservations SET status = ?, active_reservation = NULL, fulfilled_at = NOW() WHERE id = ?',
      ['FULFILLED', id]
    );

    await pool.execute(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [
        reservation.user_id,
        'Reservation fulfilled',
        'Your reserved book is now available for pickup.',
        'reservation'
      ]
    );

    await createAuditLog(
      reservation.user_id,
      'FULFILL_RESERVATION',
      'reservation',
      Number(id),
      `Fulfilled reservation for book ${reservation.book_id}`
    );

    res.json({
      success: true,
      message: 'Reservation fulfilled successfully'
    });
  } catch (error) {
    logger.error('Fulfill reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fulfilling reservation'
    });
  }
};

module.exports = {
  getUserReservations,
  createReservation,
  cancelReservation,
  getAllReservations,
  fulfillReservation
};
