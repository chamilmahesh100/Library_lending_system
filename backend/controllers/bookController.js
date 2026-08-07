const { pool } = require('../config/database');
const logger = require('../config/logger');

/**
 * Get all books (with pagination)
 * GET /api/books
 */
const getAllBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let query = 'SELECT * FROM books';
    let countQuery = 'SELECT COUNT(*) as total FROM books';
    const params = [];
    const countParams = [];

    // Add search filter if provided
    if (search) {
      query += ' WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?';
      countQuery += ' WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    // LIMIT and OFFSET must be integers, not placeholders in MySQL2
    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [books] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    logger.info(`Books retrieved: ${books.length} books (page ${page})`);

    res.json({
      success: true,
      data: {
        books,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get all books error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching books'
    });
  }
};

/**
 * Get available books (for users)
 * GET /api/books/available
 */
const getAvailableBooks = async (req, res) => {
  try {
    const [books] = await pool.execute(
      'SELECT * FROM books WHERE available_quantity > 0 ORDER BY title ASC'
    );

    logger.info(`Available books retrieved: ${books.length} books`);

    res.json({
      success: true,
      data: { books }
    });
  } catch (error) {
    logger.error('Get available books error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available books'
    });
  }
};

/**
 * Get single book by ID
 * GET /api/books/:id
 */
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    const [books] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    res.json({
      success: true,
      data: { book: books[0] }
    });
  } catch (error) {
    logger.error('Get book by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create new book (Admin only)
 * POST /api/books
 */
const createBook = async (req, res) => {
  try {
    const { title, author, isbn, quantity } = req.body;

    // Check if ISBN already exists
    const [existingBooks] = await pool.execute(
      'SELECT id FROM books WHERE isbn = ?',
      [isbn]
    );

    if (existingBooks.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Book with this ISBN already exists'
      });
    }

    // Set available_quantity equal to quantity for new books
    const available_quantity = quantity;

    const [result] = await pool.execute(
      'INSERT INTO books (title, author, isbn, quantity, available_quantity) VALUES (?, ?, ?, ?, ?)',
      [title, author, isbn, quantity, available_quantity]
    );

    logger.info(`Book created by admin ${req.user.id}: ${title} (ID: ${result.insertId})`);

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: {
        book: {
          id: result.insertId,
          title,
          author,
          isbn,
          quantity,
          available_quantity
        }
      }
    });
  } catch (error) {
    logger.error('Create book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating book'
    });
  }
};

/**
 * Update book (Admin only)
 * PUT /api/books/:id
 */
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, isbn, quantity } = req.body;

    // Check if book exists
    const [existingBooks] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [id]
    );

    if (existingBooks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const existingBook = existingBooks[0];

    // Check if ISBN is being changed and if new ISBN already exists
    if (isbn && isbn !== existingBook.isbn) {
      const [isbnCheck] = await pool.execute(
        'SELECT id FROM books WHERE isbn = ? AND id != ?',
        [isbn, id]
      );

      if (isbnCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Book with this ISBN already exists'
        });
      }
    }

    // Calculate new available_quantity
    // If quantity is increased, add the difference to available_quantity
    // If quantity is decreased, adjust available_quantity accordingly
    let available_quantity = existingBook.available_quantity;
    if (quantity !== undefined) {
      const quantityDiff = quantity - existingBook.quantity;
      available_quantity = Math.max(0, available_quantity + quantityDiff);
    }

    await pool.execute(
      'UPDATE books SET title = ?, author = ?, isbn = ?, quantity = ?, available_quantity = ? WHERE id = ?',
      [
        title || existingBook.title,
        author || existingBook.author,
        isbn || existingBook.isbn,
        quantity !== undefined ? quantity : existingBook.quantity,
        available_quantity,
        id
      ]
    );

    logger.info(`Book updated by admin ${req.user.id}: Book ID ${id}`);

    // Fetch updated book
    const [updatedBooks] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: { book: updatedBooks[0] }
    });
  } catch (error) {
    logger.error('Update book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating book'
    });
  }
};

/**
 * Delete book (Admin only)
 * DELETE /api/books/:id
 */
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if book exists
    const [existingBooks] = await pool.execute(
      'SELECT * FROM books WHERE id = ?',
      [id]
    );

    if (existingBooks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    // Check if book has active lending records
    const [activeLendings] = await pool.execute(
      'SELECT COUNT(*) as count FROM lending_records WHERE book_id = ? AND returned_date IS NULL',
      [id]
    );

    if (activeLendings[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete book with active lending records'
      });
    }

    await pool.execute('DELETE FROM books WHERE id = ?', [id]);

    logger.info(`Book deleted by admin ${req.user.id}: Book ID ${id}`);

    res.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    logger.error('Delete book error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting book'
    });
  }
};

module.exports = {
  getAllBooks,
  getAvailableBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
};

