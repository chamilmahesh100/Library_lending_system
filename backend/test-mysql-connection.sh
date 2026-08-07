#!/bin/bash
echo "Testing MySQL connection options..."

# Try common passwords
PASSWORDS=("" "root" "1234" "password" "admin" "mysql")

for pass in "${PASSWORDS[@]}"; do
    if [ -z "$pass" ]; then
        echo "Testing: No password"
        mysql -u root -e "SELECT 1" 2>&1 | grep -q "ERROR" || { echo "✅ SUCCESS: No password required!"; exit 0; }
    else
        echo "Testing password: $pass"
        mysql -u root -p"$pass" -e "SELECT 1" 2>&1 | grep -q "ERROR" || { echo "✅ SUCCESS: Password is '$pass'"; exit 0; }
    fi
done

echo "❌ None of the common passwords worked."
echo "You may need to reset your MySQL root password."
