#!/bin/bash

# MySQL Password Reset Helper for macOS (Homebrew)
# This script helps reset MySQL root password

echo "=========================================="
echo "MySQL Root Password Reset Helper"
echo "=========================================="
echo ""
echo "This script will help you reset your MySQL root password."
echo ""
read -p "Do you want to proceed? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping MySQL service..."
brew services stop mysql

if [ $? -ne 0 ]; then
    echo "❌ Failed to stop MySQL. Trying alternative method..."
    sudo killall mysqld 2>/dev/null
    sleep 2
fi

echo ""
echo "Step 2: Starting MySQL in safe mode (skip-grant-tables)..."
echo "This allows login without password."
echo ""

# Start MySQL in safe mode in background
mysqld_safe --skip-grant-tables --skip-networking &
MYSQL_PID=$!

echo "Waiting for MySQL to start..."
sleep 5

echo ""
read -sp "Enter your NEW MySQL root password: " NEW_PASSWORD
echo ""
read -sp "Confirm your NEW MySQL root password: " CONFIRM_PASSWORD
echo ""

if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo "❌ Passwords don't match!"
    kill $MYSQL_PID 2>/dev/null
    exit 1
fi

echo ""
echo "Step 3: Resetting password..."

# Connect and reset password
mysql -u root << EOF
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY '$NEW_PASSWORD';
FLUSH PRIVILEGES;
EXIT;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Password reset successful!"
    
    # Stop safe mode MySQL
    echo ""
    echo "Step 4: Stopping safe mode MySQL..."
    kill $MYSQL_PID 2>/dev/null
    sleep 2
    
    # Start MySQL normally
    echo "Step 5: Starting MySQL normally..."
    brew services start mysql
    sleep 3
    
    # Test new password
    echo ""
    echo "Step 6: Testing new password..."
    if mysql -u root -p"$NEW_PASSWORD" -e "SELECT 1" &> /dev/null; then
        echo "✅ MySQL is working with new password!"
        
        # Update .env file
        echo ""
        echo "Step 7: Updating .env file..."
        if [ -f .env ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s/^DB_PASSWORD=.*/DB_PASSWORD=$NEW_PASSWORD/" .env
            else
                sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$NEW_PASSWORD/" .env
            fi
            echo "✅ .env file updated!"
        else
            echo "⚠️  .env file not found. Please update it manually:"
            echo "   DB_PASSWORD=$NEW_PASSWORD"
        fi
        
        echo ""
        echo "=========================================="
        echo "✅ Setup complete!"
        echo "=========================================="
        echo ""
        echo "Your MySQL root password has been reset."
        echo "You can now start the backend server with:"
        echo "  npm start"
        echo ""
    else
        echo "❌ Password reset may have failed. Please try again."
    fi
else
    echo "❌ Failed to reset password. You may need to do this manually."
    echo ""
    echo "Manual steps:"
    echo "1. Stop MySQL: brew services stop mysql"
    echo "2. Start in safe mode: mysqld_safe --skip-grant-tables"
    echo "3. In another terminal: mysql -u root"
    echo "4. Run: ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_new_password';"
    echo "5. Run: FLUSH PRIVILEGES;"
    echo "6. Restart MySQL: brew services start mysql"
fi

