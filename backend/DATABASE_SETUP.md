# Database Setup Guide

## Current Issue
MySQL connection is failing because the root password in `.env` is incorrect.

## Quick Solutions

### Option 1: Reset MySQL Root Password (Recommended)

Run the reset script:
```bash
cd backend
./reset-mysql-password.sh
```

This will:
1. Stop MySQL
2. Start MySQL in safe mode
3. Allow you to set a new root password
4. Update your `.env` file automatically
5. Restart MySQL normally

### Option 2: Create Database User (Alternative)

If you prefer not to reset the root password, you can create a dedicated user:

1. **First, you need to access MySQL somehow:**
   - If you have another MySQL user with privileges
   - Or temporarily reset root password (see Option 1)

2. **Create the application user:**
   ```sql
   CREATE DATABASE library_lending_system;
   CREATE USER 'library_user'@'localhost' IDENTIFIED BY 'your_secure_password';
   GRANT ALL PRIVILEGES ON library_lending_system.* TO 'library_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. **Update `.env`:**
   ```
   DB_USER=library_user
   DB_PASSWORD=your_secure_password
   ```

### Option 3: Manual Password Reset

If the script doesn't work, follow these manual steps:

1. **Stop MySQL:**
   ```bash
   brew services stop mysql
   ```

2. **Start MySQL in safe mode:**
   ```bash
   mysqld_safe --skip-grant-tables --skip-networking &
   ```

3. **In a new terminal, connect without password:**
   ```bash
   mysql -u root
   ```

4. **Reset the password:**
   ```sql
   FLUSH PRIVILEGES;
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';
   FLUSH PRIVILEGES;
   EXIT;
   ```

5. **Stop safe mode MySQL:**
   ```bash
   killall mysqld
   ```

6. **Start MySQL normally:**
   ```bash
   brew services start mysql
   ```

7. **Update `.env` file:**
   ```bash
   # Edit backend/.env
   DB_PASSWORD=your_new_password
   ```

8. **Create the database:**
   ```bash
   mysql -u root -p
   # Enter your new password
   ```
   ```sql
   CREATE DATABASE library_lending_system;
   EXIT;
   ```

## Verify Setup

After fixing the password, test the connection:

```bash
cd backend
npm start
```

You should see:
```
✅ Database connected successfully
✅ Database schema initialized successfully
🚀 Server running on port 5000
```

## Troubleshooting

### "Access denied" error persists
- Double-check the password in `.env` matches your MySQL root password
- Ensure there are no extra spaces in `.env` file
- Try restarting MySQL: `brew services restart mysql`

### "Database doesn't exist" error
- The database will be created automatically on first run
- Or create it manually: `CREATE DATABASE library_lending_system;`

### MySQL won't start
- Check MySQL logs: `tail -f /opt/homebrew/var/mysql/*.err`
- Try: `brew services restart mysql`

## Need Help?

If you're still having issues:
1. Check MySQL is running: `brew services list | grep mysql`
2. Check MySQL logs for errors
3. Verify `.env` file has correct format (no quotes around values)

