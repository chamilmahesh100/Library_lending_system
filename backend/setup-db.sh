#!/bin/bash

# Database Setup Helper Script
# This script helps you set up the MySQL database for the Library Lending System

echo "=========================================="
echo "Library Lending System - Database Setup"
echo "=========================================="
echo ""

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "❌ MySQL is not installed or not in PATH"
    echo "Please install MySQL first"
    exit 1
fi

echo "This script will help you:"
echo "1. Create the database"
echo "2. Create a dedicated MySQL user (optional)"
echo "3. Update your .env file"
echo ""
read -p "Do you want to proceed? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "Please enter your MySQL root password:"
read -s ROOT_PASSWORD

echo ""
echo "Testing MySQL connection..."
if mysql -u root -p"$ROOT_PASSWORD" -e "SELECT 1" &> /dev/null; then
    echo "✅ MySQL connection successful!"
else
    echo "❌ MySQL connection failed. Please check your root password."
    exit 1
fi

echo ""
read -p "Do you want to create a dedicated MySQL user? (recommended) (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter username for new MySQL user (default: library_user): " DB_USER
    DB_USER=${DB_USER:-library_user}
    
    echo ""
    read -sp "Enter password for new MySQL user (default: library_password_123): " DB_PASSWORD
    echo ""
    DB_PASSWORD=${DB_PASSWORD:-library_password_123}
    
    echo ""
    echo "Creating database and user..."
    mysql -u root -p"$ROOT_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS library_lending_system;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON library_lending_system.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Database and user created successfully!"
    else
        echo "❌ Failed to create database/user"
        exit 1
    fi
else
    echo ""
    echo "Using root user for database connection."
    DB_USER="root"
    DB_PASSWORD="$ROOT_PASSWORD"
fi

echo ""
echo "Updating .env file..."

# Update .env file
if [ -f .env ]; then
    # Update DB_USER
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/^DB_USER=.*/DB_USER=$DB_USER/" .env
        sed -i '' "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    else
        # Linux
        sed -i "s/^DB_USER=.*/DB_USER=$DB_USER/" .env
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" .env
    fi
    echo "✅ .env file updated!"
else
    echo "❌ .env file not found. Please create it from env.template first."
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "You can now start the backend server with:"
echo "  npm start"
echo ""

