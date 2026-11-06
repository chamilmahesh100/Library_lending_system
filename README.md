# Library Lending System

A full-stack library management application for managing books, borrowing and returning books, user access, and administrative reporting. The project combines a MySQL-backed Node.js API and a React frontend to provide a complete digital library workflow for both library members and administrators.

## Overview

The Library Lending System allows users to:

- Register and log in securely
- Browse the available book catalog
- Borrow books with due dates
- Return books and view borrowing history
- Access role-based functionality based on admin or regular user permissions

The admin panel allows administrators to:

- Manage the book catalog (add, edit, delete books)
- View registered users
- View all lending records
- Generate daily and monthly reports
- Export reports as CSV or PDF

## Project Architecture

This repository contains two major application layers:

- Backend: Node.js + Express.js + MySQL
- Frontend: React + React Router + Axios

The system is designed as a typical three-tier application with:

- Presentation layer: React web application
- API layer: Express REST API
- Data layer: MySQL relational database

## Features

### User Features

- User registration and login
- JWT-based authentication
- Book catalog browsing
- Borrowing and returning books
- Borrowing history tracking
- Active borrow status view

### Admin Features

- Admin dashboard
- Book management operations
- User list management
- Lending transaction overview
- Daily and monthly reporting
- CSV and PDF export for reports
- Role-based route protection

### Technical Features

- Secure password hashing with bcrypt
- JWT authentication and route protection
- MySQL connection pooling
- Database schema auto-initialization
- Swagger API documentation at `/api-docs`
- Request validation middleware
- Error handling and logging

## Phase Roadmap

### Phase 1

- Categories management
- Enhanced book metadata and library copy tracking
- Advanced book search and filtering
- Admin catalog updates and category-aware browsing

### Phase 2

- Automatic overdue fines based on due date calculations
- Overdue tracking and admin visibility for outstanding items
- Member management controls for activation, deactivation, and borrowing limits
- Borrowing enforcement with per-user loan caps and overdue blocking

### Phase 3

- Reservation queues for books that are temporarily unavailable
- User notifications for reservation and pickup updates
- Audit logging for key lending and member management actions
- Admin oversight for outstanding reservations and system activity

### Phase 4

- Loan renewal support with a maximum renewal cap and overdue protection
- Copy condition management for damaged or lost physical items
- Admin tools for updating copy status and tracking stock health
- Better circulation control by preventing renewals on overdue loans

### Phase 5

- Operational dashboard with live KPIs for books, members, and loans
- Recent audit-trail visibility for administrative decision making
- Overdue and reservation workload snapshot for daily operations
- Better user-facing operational insights without changing the underlying architecture

## Tech Stack

### Backend

- Node.js
- Express.js
- MySQL2
- JWT
- bcrypt
- Swagger UI
- PDFKit
- CSV Writer
- Winston
- dotenv

### Frontend

- React
- React Router DOM
- Axios
- Create React App

## Repository Structure

```text
Library Lending System/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   ├── logger.js
│   │   └── swagger.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── bookController.js
│   │   ├── lendingController.js
│   │   ├── reportController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── validation.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── bookRoutes.js
│   │   ├── lendingRoutes.js
│   │   ├── reportRoutes.js
│   │   └── userRoutes.js
│   ├── .env
│   ├── adminSeeder.js
│   ├── DATABASE_SETUP.md
│   ├── package.json
│   ├── server.js
│   ├── setup-db.sh
│   ├── make-admin.sh
│   ├── reset-mysql-password.sh
│   └── package-lock.json
├── frontend/
│   ├── public/
│   ├── src/
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
├── reports/
├── README.md
└── .git
```

## Prerequisites

Before running the project, ensure you have the following installed:

- Node.js (v18 or later recommended)
- npm (comes with Node.js)
- MySQL Server
- Git

## Database Setup

The project uses MySQL and creates the required tables automatically when the backend starts.

### 1. Create the database

Open MySQL and run:

```sql
CREATE DATABASE library_lending_system;
```

### 2. Configure environment variables

The backend includes a `.env` file. Update it with your local MySQL and JWT configuration:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=library_lending_system
JWT_SECRET=your_super_secret_jwt_key_change_in_production
PORT=5001
NODE_ENV=development
```

### 3. Install backend dependencies

```bash
cd backend
npm install
```

### 4. Start the backend

```bash
cd backend
npm start
```

The server will initialize the database schema and run on:

- http://localhost:5001
- Swagger documentation: http://localhost:5001/api-docs

### 5. Seed the default admin user

The project includes an admin seeding script.

```bash
cd backend
node adminSeeder.js
```

This creates an admin user with:

- Email: admin@example.com
- Password: Admin@123

Note: Only run this once unless you intentionally want to recreate the admin user.

## Frontend Setup

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Configure frontend environment

The frontend `.env` file should point to the backend API:

```env
REACT_APP_API_URL=http://localhost:5001/api
```

### 3. Start the frontend

```bash
cd frontend
npm start
```

The React app runs by default on:

- http://localhost:3000

## Default Login Credentials

### Admin

- Email: admin@example.com
- Password: Admin@123

### Regular User

Create a new account from the registration page in the frontend.

## Application Flow

### User Journey

1. User opens the application and clicks Register.
2. User submits name, email, and password.
3. System creates a user account and issues a JWT token.
4. User logs in and sees the book catalog.
5. User borrows available books from the catalog.
6. User returns books when finished.
7. User sees borrowing history and active returns.

### Admin Journey

1. Admin logs in with the seeded admin account.
2. Admin opens the dashboard.
3. Admin can manage books, view all users, and review lending activity.
4. Admin can generate daily and monthly reports.
5. Admin can export reports to CSV or PDF.

## API Overview

The backend exposes the following main API groups:

### Authentication

- POST `/api/auth/register` - register user
- POST `/api/auth/login` - login user
- GET `/api/auth/me` - get current user profile

### Books

- GET `/api/books` - get paginated list of books
- GET `/api/books/available` - get available books
- GET `/api/books/:id` - get single book by ID
- POST `/api/books` - create a book (admin only)
- PUT `/api/books/:id` - update a book (admin only)
- DELETE `/api/books/:id` - delete a book (admin only)

### Lending

- POST `/api/lending/borrow` - submit a borrow request; the book is issued only after admin approval
- PUT `/api/lending/:id/approve` - approve a pending borrow request (admin only)
- PUT `/api/lending/:id/reject` - reject a pending borrow request (admin only)
- POST `/api/lending/return` - return a book
- GET `/api/lending/history` - get user borrowing history
- GET `/api/lending/all` - get all records (admin only)

### Reports

- GET `/api/reports/daily` - generate daily report
- GET `/api/reports/monthly` - generate monthly report
- GET `/api/reports/daily/export/csv` - export daily CSV report
- GET `/api/reports/daily/export/pdf` - export daily PDF report
- GET `/api/reports/monthly/export/csv` - export monthly CSV report
- GET `/api/reports/monthly/export/pdf` - export monthly PDF report

### Users

- GET `/api/users` - list all users (admin only)

The API documentation is also available through Swagger at:

- http://localhost:5001/api-docs

## Database Schema

The backend creates these main tables automatically:

### users

- id
- name
- email
- password_hash
- role
- created_at

### books

- id
- title
- author
- isbn
- quantity
- available_quantity
- created_at

### lending_records

- id
- user_id
- book_id
- copy_id
- status (`PENDING`, `APPROVED`, or `REJECTED`)
- borrowed_date
- due_date
- returned_date
- fine_amount
- created_at

Relationships:

- users to lending_records: one-to-many
- books to lending_records: one-to-many

## Report Export Functionality

The system supports generating reports for:

- Daily lending activity
- Monthly lending activity

Reports can be exported as:

- CSV
- PDF

The generated files are stored in the `/reports` directory at the project root.

## Security Notes

The application includes basic security measures such as:

- Password hashing with bcrypt
- JWT token authentication
- Admin-only access checks
- Input validation for registration and book creation
- MySQL parameterized queries to help prevent SQL injection

For production deployment, additional hardening is recommended, including:

- Strong JWT secret management
- HTTPS enforcement
- Environment-based secrets management
- Rate limiting
- Role-based authorization audits
- Database backups

## Troubleshooting

### Database connection errors

If MySQL fails to connect:

- Verify MySQL is running
- Check the values in `backend/.env`
- Make sure the database exists
- Confirm the MySQL user has permission to access the database

A helper guide is also included at:

- `backend/DATABASE_SETUP.md`

### Port issues

If port 5001 is already in use, update the backend port in `backend/.env` and align the frontend `REACT_APP_API_URL` accordingly.

### Frontend not loading data

- Ensure the backend is running
- Confirm `REACT_APP_API_URL` matches the backend URL
- Check browser console/network tab for failed requests

## Running Both Applications Together

Open two terminals:

Terminal 1:

```bash
cd backend
npm start
```

Terminal 2:

```bash
cd frontend
npm start
```

Then access the UI at:

- http://localhost:3000

## Production Considerations

This project is a solid foundation for a real library system, but for production use consider:

- using a managed database service
- moving secrets to environment variables or vault systems
- enabling secure HTTPS
- adding email verification and password reset flows
- implementing more advanced fines and overdue logic
- adding book categories and search filters
- adding audit logs and system monitoring

## Contributors

This project was developed as a library management system assignment/project with full-stack functionality for both users and administrators.

## License

This project is distributed under the ISC license, as defined in the backend package metadata.

## Summary

The Library Lending System provides a practical, end-to-end solution for managing a small to medium-sized library. It combines a user-friendly React interface with a secure Express API and relational database backend to support lending operations, administrative management, and reporting.
