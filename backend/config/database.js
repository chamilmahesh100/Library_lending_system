const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Database connection pool configuration
 * Uses parameterized queries to prevent SQL injection
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'library_lending_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function ensureColumn(tableName, columnName, columnDefinition) {
  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const exists = columns.some((column) => column.Field === columnName);

  if (!exists) {
    await pool.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
  }
}

async function addForeignKeyIfMissing(tableName, constraintName, sourceColumn, targetTable, targetColumn) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );

  if (!rows.length) {
    await pool.execute(
      `ALTER TABLE \`${tableName}\`
       ADD CONSTRAINT \`${constraintName}\`
       FOREIGN KEY (\`${sourceColumn}\`) REFERENCES \`${targetTable}\`(\`${targetColumn}\`) ON DELETE SET NULL`
    );
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
async function initializeDatabase() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        is_active TINYINT(1) DEFAULT 1,
        max_active_loans INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn('users', 'is_active', 'TINYINT(1) DEFAULT 1');
    await ensureColumn('users', 'max_active_loans', 'INT DEFAULT 5');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(255) UNIQUE NOT NULL,
        publisher VARCHAR(255) NULL,
        publication_year INT NULL,
        edition VARCHAR(100) NULL,
        language VARCHAR(100) NULL,
        shelf_location VARCHAR(255) NULL,
        description TEXT NULL,
        category_id INT NULL,
        quantity INT NOT NULL DEFAULT 0,
        available_quantity INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_books_category_id (category_id),
        INDEX idx_books_title (title),
        INDEX idx_books_author (author)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn('books', 'publisher', 'VARCHAR(255) NULL');
    await ensureColumn('books', 'publication_year', 'INT NULL');
    await ensureColumn('books', 'edition', 'VARCHAR(100) NULL');
    await ensureColumn('books', 'language', 'VARCHAR(100) NULL');
    await ensureColumn('books', 'shelf_location', 'VARCHAR(255) NULL');
    await ensureColumn('books', 'description', 'TEXT NULL');
    await ensureColumn('books', 'category_id', 'INT NULL');

    try {
      await addForeignKeyIfMissing('books', 'fk_books_category', 'category_id', 'categories', 'id');
    } catch (error) {
      console.warn('Warning: category foreign key check skipped:', error.message);
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS book_copies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        accession_number VARCHAR(255) NOT NULL,
        status ENUM('AVAILABLE', 'BORROWED', 'RESERVED', 'DAMAGED', 'LOST') NOT NULL DEFAULT 'AVAILABLE',
        shelf_location VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_book_copy_accession (book_id, accession_number),
        KEY idx_book_copies_book_id (book_id),
        KEY idx_book_copies_status (status),
        CONSTRAINT fk_book_copies_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS lending_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        copy_id INT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
        borrowed_date DATE NULL,
        due_date DATE NULL,
        returned_date DATE NULL,
        fine_amount DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (copy_id) REFERENCES book_copies(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_book_id (book_id),
        INDEX idx_copy_id (copy_id),
        INDEX idx_borrowed_date (borrowed_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn('lending_records', 'copy_id', 'INT NULL');
    await ensureColumn('lending_records', 'status', "ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED'");
    await ensureColumn('lending_records', 'renewal_count', 'INT NOT NULL DEFAULT 0');
    const [lendingColumns] = await pool.query('SHOW COLUMNS FROM `lending_records`');
    for (const columnName of ['borrowed_date', 'due_date']) {
      const column = lendingColumns.find((item) => item.Field === columnName);
      if (column && column.Null !== 'YES') {
        await pool.execute(`ALTER TABLE \`lending_records\` MODIFY \`${columnName}\` DATE NULL`);
      }
    }
    try {
      await addForeignKeyIfMissing('lending_records', 'lending_records_ibfk_3', 'copy_id', 'book_copies', 'id');
    } catch (error) {
      console.warn('Warning: lending copy foreign key check skipped:', error.message);
    }

    const [booksWithoutCopies] = await pool.execute(`
      SELECT b.id, b.quantity, b.shelf_location
      FROM books b
      WHERE NOT EXISTS (
        SELECT 1 FROM book_copies bc WHERE bc.book_id = b.id
      )
      ORDER BY b.id
    `);

    for (const book of booksWithoutCopies) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        const [activeLoans] = await connection.execute(
          'SELECT id FROM lending_records WHERE book_id = ? AND status = ? AND returned_date IS NULL ORDER BY borrowed_date, id',
          [book.id, 'APPROVED']
        );
        const totalCopies = Math.max(Number(book.quantity || 0), activeLoans.length);

        for (let index = 1; index <= totalCopies; index += 1) {
          const accessionNumber = `${book.id.toString().padStart(4, '0')}-${String(index).padStart(3, '0')}`;
          const status = index <= activeLoans.length ? 'BORROWED' : 'AVAILABLE';
          const [copy] = await connection.execute(
            'INSERT INTO book_copies (book_id, accession_number, status, shelf_location) VALUES (?, ?, ?, ?)',
            [book.id, accessionNumber, status, book.shelf_location]
          );

          if (index <= activeLoans.length) {
            await connection.execute(
              'UPDATE lending_records SET copy_id = ? WHERE id = ?',
              [copy.insertId, activeLoans[index - 1].id]
            );
          }
        }

        await connection.execute(
          'UPDATE books SET quantity = ?, available_quantity = ? WHERE id = ?',
          [totalCopies, totalCopies - activeLoans.length, book.id]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('WAITING', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'WAITING',
        active_reservation TINYINT NULL DEFAULT NULL,
        fulfilled_at TIMESTAMP NULL,
        UNIQUE KEY uk_reservation_user_book_active (user_id, book_id, active_reservation),
        KEY idx_reservations_user_id (user_id),
        KEY idx_reservations_book_id (book_id),
        CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await ensureColumn('reservations', 'active_reservation', 'TINYINT NULL DEFAULT NULL');
    const [reservationIndexes] = await pool.query('SHOW INDEX FROM reservations');
    const activeReservationIndex = reservationIndexes.filter((index) => index.Key_name === 'uk_reservation_user_book_active');
    if (activeReservationIndex.some((index) => index.Column_name === 'status')) {
      await pool.execute('ALTER TABLE reservations DROP INDEX uk_reservation_user_book_active');
    }
    await pool.execute(`
      UPDATE reservations
      SET active_reservation = CASE WHEN status = 'WAITING' THEN 1 ELSE NULL END
    `);
    const [currentReservationIndexes] = await pool.query('SHOW INDEX FROM reservations');
    const hasActiveReservationIndex = currentReservationIndexes.some(
      (index) => index.Key_name === 'uk_reservation_user_book_active'
        && index.Column_name === 'active_reservation'
        && Number(index.Non_unique) === 0
    );
    if (!hasActiveReservationIndex) {
      await pool.execute(`
        ALTER TABLE reservations
        ADD UNIQUE KEY uk_reservation_user_book_active (user_id, book_id, active_reservation)
      `);
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(100) NOT NULL DEFAULT 'general',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notifications_user_id (user_id),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255) NULL,
        entity_id INT NULL,
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_audit_logs_user_id (user_id),
        CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  initializeDatabase
};
