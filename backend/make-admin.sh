#!/bin/bash

# Quick script to make a user an admin

echo "=========================================="
echo "Make User Admin - Library Lending System"
echo "=========================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./make-admin.sh user@email.com"
    echo ""
    echo "Or run interactively:"
    echo ""
    read -p "Enter user email to make admin: " USER_EMAIL
else
    USER_EMAIL=$1
fi

if [ -z "$USER_EMAIL" ]; then
    echo "❌ Email is required"
    exit 1
fi

echo ""
echo "Updating user: $USER_EMAIL"
echo ""

# Read MySQL password from .env if available
if [ -f .env ]; then
    source .env
    MYSQL_PASSWORD=$DB_PASSWORD
    MYSQL_USER=$DB_USER
else
    echo "Enter MySQL root password:"
    read -s MYSQL_PASSWORD
    MYSQL_USER="root"
fi

# Update user role
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" library_lending_system << EOF
UPDATE users SET role = 'admin' WHERE email = '$USER_EMAIL';
SELECT id, name, email, role FROM users WHERE email = '$USER_EMAIL';
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ User '$USER_EMAIL' is now an admin!"
    echo ""
    echo "Next steps:"
    echo "1. Logout from the app (if logged in)"
    echo "2. Login again"
    echo "3. You'll be redirected to: http://localhost:3000/admin/dashboard"
    echo ""
else
    echo ""
    echo "❌ Failed to update user. Please check:"
    echo "   - MySQL credentials are correct"
    echo "   - User email exists in database"
    echo "   - Database 'library_lending_system' exists"
    echo ""
fi

