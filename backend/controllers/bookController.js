const { pool } = require('../config/database');
const logger = require('../config/logger');

const buildBookSelectQuery = () => `
  SELECT b.*, c.name as category_name
  FROM books b
  LEFT JOIN categories c ON c.id = b.category_id
`;

const ensureBookCopies = async (bookId, targetQuantity) => {
  const [existingCopies] = await pool.execute(
    'SELECT id, accession_number, status FROM book_copies WHERE book_id = ? ORDER BY id',
    [bookId]
  );

  const currentCount = existingCopies.length;

  if (targetQuantity > currentCount) {
    const entriesToInsert = [];
    for (let index = currentCount + 1; index <= targetQuantity; index += 1) {
      const accessionNumber = `${bookId.toString().padStart(4, '0')}-${String(index).padStart(3, '0')}`;
      entriesToInsert.push([bookId, accessionNumber, 'AVAILABLE', null]);
    }

    if (entriesToInsert.length > 0) {
      await pool.query(
        'INSERT INTO book_copies (book_id, accession_number, status, shelf_location) VALUES ?',
        [entriesToInsert]
      );
    }
  }

  if (targetQuantity < currentCount) {
    const removableCopies = existingCopies
      .filter((copy) => ['AVAILABLE', 'DAMAGED', 'LOST'].includes(copy.status))
      .slice(0, currentCount - targetQuantity);

    if (removableCopies.length !== currentCount - targetQuantity) {
      throw new Error('Cannot reduce physical copy count while copies are still borrowed');
    }

    if (removableCopies.length > 0) {
      const ids = removableCopies.map((copy) => copy.id);
      await pool.query(`DELETE FROM book_copies WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    }
  }

  const [summary] = await pool.execute(
    `SELECT COUNT(*) as total_copies, SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_copies
     FROM book_copies WHERE book_id = ?`,
    [bookId]
  );

  await pool.execute(
    'UPDATE books SET quantity = ?, available_quantity = ? WHERE id = ?',
    [summary[0].total_copies || 0, summary[0].available_copies || 0, bookId]
  );

  return summary[0];
};

const getAllBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const author = (req.query.author || '').trim();
    const availability = (req.query.availability || '').trim();
    const sort = (req.query.sort || 'newest').trim();

    let query = buildBookSelectQuery();
    let countQuery = 'SELECT COUNT(*) as total FROM books b LEFT JOIN categories c ON c.id = b.category_id';
    const params = [];
    const countParams = [];
    const filters = [];

    if (search) {
      filters.push('(LOWER(b.title) LIKE LOWER(?) OR LOWER(b.author) LIKE LOWER(?) OR LOWER(b.isbn) LIKE LOWER(?) OR LOWER(b.publisher) LIKE LOWER(?) OR LOWER(c.name) LIKE LOWER(?))');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
      countParams.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (categoryId) {
      filters.push('b.category_id = ?');
      params.push(categoryId);
      countParams.push(categoryId);
    }

    if (author) {
      filters.push('LOWER(b.author) LIKE LOWER(?)');
      const authorPattern = `%${author}%`;
      params.push(authorPattern);
      countParams.push(authorPattern);
    }

    if (availability === 'available') {
      filters.push('b.available_quantity > 0');
    } else if (availability === 'unavailable') {
      filters.push('b.available_quantity = 0');
    }

    if (filters.length > 0) {
      const whereClause = ` WHERE ${filters.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }

    const orderingMap = {
      newest: 'ORDER BY b.created_at DESC',
      title_asc: 'ORDER BY b.title ASC',
      title_desc: 'ORDER BY b.title DESC',
      author_asc: 'ORDER BY b.author ASC',
      availability_desc: 'ORDER BY b.available_quantity DESC, b.title ASC'
    };

    const orderBy = orderingMap[sort] || orderingMap.newest;
    query += ` ${orderBy} LIMIT ${limit} OFFSET ${offset}`;

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

const searchBooks = async (req, res) => {
  try {
    req.query.page = req.query.page || 1;
    req.query.limit = req.query.limit || 50;
    return getAllBooks(req, res);
  } catch (error) {
    logger.error('Search books error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching books'
    });
  }
};

const getAvailableBooks = async (req, res) => {
  try {
    const [books] = await pool.execute(
      `SELECT b.*, c.name as category_name
       FROM books b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.available_quantity > 0
       ORDER BY b.title ASC`
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

const getBookCopies = async (req, res) => {
  try {
    const { id } = req.params;

    const [copies] = await pool.execute(
      'SELECT * FROM book_copies WHERE book_id = ? ORDER BY accession_number ASC',
      [id]
    );

    res.json({
      success: true,
      data: { copies }
    });
  } catch (error) {
    logger.error('Get book copies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching book copies'
    });
  }
};

const createBookCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const { shelf_location } = req.body;

    const [books] = await pool.execute('SELECT * FROM books WHERE id = ?', [id]);
    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [existingCopies] = await pool.execute(
      'SELECT COUNT(*) as count FROM book_copies WHERE book_id = ?',
      [id]
    );

    const nextCopyIndex = Number(existingCopies[0].count) + 1;
    const accessionNumber = `${id.toString().padStart(4, '0')}-${String(nextCopyIndex).padStart(3, '0')}`;

    const [result] = await pool.execute(
      'INSERT INTO book_copies (book_id, accession_number, status, shelf_location) VALUES (?, ?, ?, ?)',
      [id, accessionNumber, 'AVAILABLE', shelf_location || books[0].shelf_location || null]
    );

    await pool.execute(
      'UPDATE books SET quantity = quantity + 1, available_quantity = available_quantity + 1 WHERE id = ?',
      [id]
    );

    const [newCopy] = await pool.execute(
      'SELECT * FROM book_copies WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Book copy created successfully',
      data: { copy: newCopy[0] }
    });
  } catch (error) {
    logger.error('Create book copy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating book copy'
    });
  }
};

const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    const [books] = await pool.execute(
      `${buildBookSelectQuery()} WHERE b.id = ?`,
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book not found'
      });
    }

    const [copies] = await pool.execute(
      'SELECT * FROM book_copies WHERE book_id = ? ORDER BY accession_number ASC',
      [id]
    );

    res.json({
      success: true,
      data: {
        book: books[0],
        copies
      }
    });
  } catch (error) {
    logger.error('Get book by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

const createBook = async (req, res) => {
  try {
    const {
      title,
      author,
      isbn,
      quantity,
      category_id,
      publisher,
      publication_year,
      edition,
      language,
      shelf_location,
      description
    } = req.body;

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

    const totalQuantity = Number(quantity || 0);

    const [result] = await pool.execute(
      `INSERT INTO books (
        title, author, isbn, publisher, publication_year, edition, language,
        shelf_location, description, category_id, quantity, available_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        author,
        isbn,
        publisher || null,
        publication_year || null,
        edition || null,
        language || null,
        shelf_location || null,
        description || null,
        category_id || null,
        totalQuantity,
        totalQuantity
      ]
    );

    await ensureBookCopies(result.insertId, totalQuantity);

    const [books] = await pool.execute(
      `${buildBookSelectQuery()} WHERE b.id = ?`,
      [result.insertId]
    );

    logger.info(`Book created by admin ${req.user.id}: ${title} (ID: ${result.insertId})`);

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: { book: books[0] }
    });
  } catch (error) {
    logger.error('Create book error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating book'
    });
  }
};

const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      isbn,
      quantity,
      category_id,
      publisher,
      publication_year,
      edition,
      language,
      shelf_location,
      description
    } = req.body;

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

    const updatedQuantity = quantity !== undefined ? Number(quantity) : existingBook.quantity;

    if (updatedQuantity !== existingBook.quantity) {
      await ensureBookCopies(id, updatedQuantity);
    }

    await pool.execute(
      `UPDATE books
       SET title = ?, author = ?, isbn = ?, publisher = ?, publication_year = ?, edition = ?,
           language = ?, shelf_location = ?, description = ?, category_id = ?, quantity = ?,
           available_quantity = ?
       WHERE id = ?`,
      [
        title || existingBook.title,
        author || existingBook.author,
        isbn || existingBook.isbn,
        publisher !== undefined ? publisher : existingBook.publisher,
        publication_year !== undefined ? publication_year : existingBook.publication_year,
        edition !== undefined ? edition : existingBook.edition,
        language !== undefined ? language : existingBook.language,
        shelf_location !== undefined ? shelf_location : existingBook.shelf_location,
        description !== undefined ? description : existingBook.description,
        category_id !== undefined ? category_id : existingBook.category_id,
        updatedQuantity,
        existingBook.available_quantity,
        id
      ]
    );

    const [summary] = await pool.execute(
      `SELECT COUNT(*) as total_copies, SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_copies
       FROM book_copies WHERE book_id = ?`,
      [id]
    );

    await pool.execute(
      'UPDATE books SET quantity = ?, available_quantity = ? WHERE id = ?',
      [summary[0].total_copies || 0, summary[0].available_copies || 0, id]
    );

    const [updatedBooks] = await pool.execute(
      `${buildBookSelectQuery()} WHERE b.id = ?`,
      [id]
    );

    logger.info(`Book updated by admin ${req.user.id}: Book ID ${id}`);

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: { book: updatedBooks[0] }
    });
  } catch (error) {
    logger.error('Update book error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating book'
    });
  }
};

const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

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

    const [activeLendings] = await pool.execute(
      "SELECT COUNT(*) as count FROM lending_records WHERE book_id = ? AND (status = 'PENDING' OR (status = 'APPROVED' AND returned_date IS NULL))",
      [id]
    );

    if (activeLendings[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a book with pending requests or active lending records'
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

const updateCopyStatus = async (req, res) => {
  try {
    const { id, copyId } = req.params;
    const { status } = req.body;
    const validStatuses = ['AVAILABLE', 'BORROWED', 'RESERVED', 'DAMAGED', 'LOST'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid copy status is required.'
      });
    }

    const [copyExists] = await pool.execute(
      'SELECT * FROM book_copies WHERE id = ? AND book_id = ?',
      [copyId, id]
    );

    if (copyExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Book copy not found'
      });
    }

    await pool.execute(
      'UPDATE book_copies SET status = ? WHERE id = ?',
      [status, copyId]
    );

    const [summary] = await pool.execute(
      `SELECT COUNT(*) as total_copies, SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_copies
       FROM book_copies WHERE book_id = ?`,
      [id]
    );

    await pool.execute(
      'UPDATE books SET quantity = ?, available_quantity = ? WHERE id = ?',
      [summary[0].total_copies || 0, summary[0].available_copies || 0, id]
    );

    logger.info(`Book copy status updated by admin ${req.user.id}: Book ${id}, Copy ${copyId}, Status ${status}`);

    res.json({
      success: true,
      message: 'Book copy status updated successfully',
      data: { copy: { id: Number(copyId), book_id: Number(id), status } }
    });
  } catch (error) {
    logger.error('Update copy status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating copy status'
    });
  }
};

module.exports = {
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
};
