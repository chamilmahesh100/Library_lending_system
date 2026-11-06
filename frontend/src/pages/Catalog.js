import React, { useState, useEffect, useCallback } from 'react';
import { lendingAPI, booksAPI, categoriesAPI, reservationAPI, notificationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Catalog.css';

const formatLoanDate = (value) => {
  const datePart = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const Catalog = () => {
  const [books, setBooks] = useState([]);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, logout } = useAuth();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [booksRes, historyRes, categoriesRes, reservationsRes, notificationsRes] = await Promise.all([
        booksAPI.search({
          search,
          category_id: selectedCategory,
          availability: availabilityFilter,
          sort: 'title_asc'
        }),
        lendingAPI.getHistory(),
        categoriesAPI.getAll(),
        reservationAPI.getAll(),
        notificationAPI.getAll()
      ]);

      setBooks(booksRes.data.data.books || []);
      setHistory(historyRes.data.data.records || []);
      setCategories(categoriesRes.data.data.categories || []);
      setReservations(reservationsRes.data.data.reservations || []);
      setNotifications(notificationsRes.data.data.notifications || []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, availabilityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBorrow = async (bookId) => {
    try {
      setError('');
      setSuccess('');
      const response = await lendingAPI.borrow({ book_id: bookId });
      if (response.data.success) {
        setSuccess(response.data.message || 'Borrow request submitted. Awaiting admin approval.');
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to borrow book');
    }
  };

  const handleReserve = async (bookId) => {
    try {
      setError('');
      setSuccess('');
      const response = await reservationAPI.create({ book_id: bookId });
      if (response.data.success) {
        setSuccess('Book reserved successfully!');
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reserve book');
    }
  };

  const handleNotificationRead = async (notificationId) => {
    try {
      await notificationAPI.markRead(notificationId);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notification');
    }
  };

  const handleRenew = async (lendingId) => {
    try {
      setError('');
      setSuccess('');
      const response = await lendingAPI.renew(lendingId);
      if (response.data.success) {
        setSuccess('Loan renewed successfully!');
        loadData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to renew loan');
    }
  };

  const getActiveBorrows = () => history.filter(record => record.status === 'APPROVED' && !record.returned_date);
  const activeBorrows = getActiveBorrows();

  const isOverdue = (dueDateValue) => {
    const [year, month, day] = String(dueDateValue).slice(0, 10).split('-').map(Number);
    const dueDay = Date.UTC(year, month - 1, day);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    if (!year || !month || !day || Number.isNaN(dueDay)) {
      return false;
    }

    return today > dueDay;
  };

  const getFineAmount = (record) => Number(record.fine_amount || 0);

  if (loading) {
    return <div className="catalog-container"><div className="page-loading">Loading catalog...</div></div>;
  }

  return (
    <div className="catalog-container">
      <header className="catalog-header">
        <h1>Book Catalog</h1>
        <div className="header-actions">
          <span>Welcome, {user?.name}</span>
          {user?.role === 'admin' && (
            <a href="/admin/dashboard" className="btn-link">Admin Dashboard</a>
          )}
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="catalog-content">
        <section className="available-books catalog-panel">
          <h2>Available Books</h2>

          <div className="catalog-filters">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, author, ISBN, publisher or category"
            />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
              <option value="all">All Availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          {books.length === 0 ? (
            <p className="empty-state">No books match your search and filters.</p>
          ) : (
            <div className="books-grid">
              {books.map(book => (
                <div key={book.id} className="book-card">
                  <div className="book-card-details">
                    <h3>{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                    {book.category_name && <p className="book-category">Category: {book.category_name}</p>}
                    {book.publisher && <p className="book-publisher">Publisher: {book.publisher}</p>}
                    <p className="book-isbn">ISBN: {book.isbn}</p>
                  </div>
                  <div className="book-card-footer">
                    <p className="book-availability">Available: {book.available_quantity} / {book.quantity}</p>
                    {book.available_quantity === 0 ? (
                      <button onClick={() => handleReserve(book.id)} className="btn-secondary">
                        Reserve
                      </button>
                    ) : (
                      <button onClick={() => handleBorrow(book.id)} className="btn-primary">
                        Request to Borrow
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="borrowing-history catalog-panel">
          <h2>My Borrowing History</h2>

          <div className="active-borrows">
            <h3>Active Reservations</h3>
            {reservations.filter((reservation) => reservation.status === 'WAITING').length === 0 ? (
              <p className="empty-state">No active reservations.</p>
            ) : (
              <div className="history-list">
                {reservations.filter((reservation) => reservation.status === 'WAITING').map((reservation) => (
                  <div key={reservation.id} className="history-item reservation-history-item">
                    <div className="history-info">
                      <h4>{reservation.title}</h4>
                      <p>Reserved: {new Date(reservation.reservation_date).toLocaleDateString()}</p>
                      <span className="status-badge status-waiting">WAITING</span>
                    </div>
                    <button onClick={() => reservationAPI.cancel(reservation.id).then(() => loadData())} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeBorrows.length > 0 && (
            <div className="active-borrows">
              <h3>Currently Borrowed</h3>
              <div className="history-list">
                {activeBorrows.map(record => (
                  <div key={record.id} className="history-item">
                    <div className="history-info">
                      <h4>{record.title}</h4>
                      <p>by {record.author}</p>
                      <p>Borrowed: {formatLoanDate(record.borrowed_date)}</p>
                      <p>Due: {formatLoanDate(record.due_date)}</p>
                      <p>Status: <span className={`status-badge status-${isOverdue(record.due_date) ? 'overdue' : 'borrowed'}`}>{isOverdue(record.due_date) ? 'OVERDUE' : 'ACTIVE'}</span></p>
                      {isOverdue(record.due_date) && (
                        <p className="overdue-status"><span className="status-badge status-overdue">Overdue</span></p>
                      )}
                    </div>
                    <div className="history-actions">
                      <button onClick={() => handleRenew(record.id)} className="btn-secondary">Renew</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>All History</h3>
          {history.length === 0 ? (
            <p className="empty-state">No borrowing history yet.</p>
          ) : (
            <div className="history-list">
              {history.map(record => (
                <div key={record.id} className="history-item">
                  <div className="history-info">
                    <h4>{record.title}</h4>
                    <p>by {record.author}</p>
                    <p>Borrowed: {formatLoanDate(record.borrowed_date)}</p>
                    <p>Due: {formatLoanDate(record.due_date)}</p>
                    <p>Status: <span className={`status-badge status-${record.status === 'PENDING' ? 'waiting' : record.status === 'REJECTED' ? 'rejected' : record.returned_date ? 'available' : isOverdue(record.due_date) ? 'overdue' : 'borrowed'}`}>
                      {record.status === 'PENDING' ? 'PENDING APPROVAL' : record.status === 'REJECTED' ? 'REQUEST DECLINED' : record.returned_date ? 'RETURNED' : isOverdue(record.due_date) ? 'OVERDUE' : 'ACTIVE'}
                    </span></p>
                    {record.status === 'PENDING' ? (
                      <p>Requested: {formatLoanDate(record.created_at)}</p>
                    ) : record.status === 'REJECTED' ? (
                      <p>Request was declined.</p>
                    ) : record.returned_date ? (
                      <>
                        <p>Returned: {formatLoanDate(record.returned_date)}</p>
                        <p>Fine: ${getFineAmount(record).toFixed(2)}</p>
                      </>
                    ) : isOverdue(record.due_date) ? (
                      <p className="overdue-status"><span className="status-badge status-overdue">Overdue</span></p>
                    ) : null}
                  </div>
                  {record.status === 'APPROVED' && !record.returned_date && (
                    <div className="history-actions">
                      <button onClick={() => handleRenew(record.id)} className="btn-secondary">Renew</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="active-borrows">
            <h3>Notifications</h3>
            {notifications.length === 0 ? (
              <p>No notifications.</p>
            ) : (
              <div className="history-list">
                {notifications.map((notification) => (
                  <div key={notification.id} className="history-item">
                    <div className="history-info">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <p>{new Date(notification.created_at).toLocaleString()}</p>
                    </div>
                    {!notification.is_read && (
                      <button onClick={() => handleNotificationRead(notification.id)} className="btn-secondary">
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Catalog;
