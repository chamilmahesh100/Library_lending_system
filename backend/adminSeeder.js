const bcrypt = require('bcrypt');
const { pool } = require('./config/database');

(async () => {
  try {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await pool.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Admin', 'admin@example.com', passwordHash, 'admin']
    );
    console.log('Admin created successfully');
    process.exit();
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
})();
