import React, { useState, useEffect } from 'react';
import { lendingAPI, booksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Catalog.css';

const Catalog = () => {
  const [books, setBooks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [booksRes, historyRes] = await Promise.all([
        booksAPI.getAvailable(),
        lendingAPI.getHistory()
      ]);
      setBooks(booksRes.data.data.books);
      setHistory(historyRes.data.data.records);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async (bookId) => {
    try {
      setError('');
      setSuccess('');
      const response = await lendingAPI.borrow({ book_id: bookId });
      if (response.data.success) {
        setSuccess('Book borrowed successfully!');
        loadData(); // Refresh data
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to borrow book');
    }
  };

  const handleReturn = async (lendingId) => {
    try {
      setError('');
      setSuccess('');
      const response = await lendingAPI.return({ lending_id: lendingId });
      if (response.data.success) {
        setSuccess('Book returned successfully!');
        loadData(); // Refresh data
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return book');
    }
  };

  const getActiveBorrows = () => {
    return history.filter(record => !record.returned_date);
  };

  const activeBorrows = getActiveBorrows();

  if (loading) {
    return <div className="catalog-container">Loading...</div>;
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
        <section className="available-books">
          <h2>Available Books</h2>
          {books.length === 0 ? (
            <p>No books available at the moment.</p>
          ) : (
            <div className="books-grid">
              {books.map(book => (
                <div key={book.id} className="book-card">
                  <h3>{book.title}</h3>
                  <p className="book-author">by {book.author}</p>
                  <p className="book-isbn">ISBN: {book.isbn}</p>
                  <p className="book-availability">
                    Available: {book.available_quantity} / {book.quantity}
                  </p>
                  <button
                    onClick={() => handleBorrow(book.id)}
                    className="btn-primary"
                    disabled={book.available_quantity === 0}
                  >
                    {book.available_quantity === 0 ? 'Not Available' : 'Borrow'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="borrowing-history">
          <h2>My Borrowing History</h2>
          {activeBorrows.length > 0 && (
            <div className="active-borrows">
              <h3>Currently Borrowed</h3>
              <div className="history-list">
                {activeBorrows.map(record => (
                  <div key={record.id} className="history-item">
                    <div className="history-info">
                      <h4>{record.title}</h4>
                      <p>by {record.author}</p>
                      <p>Borrowed: {new Date(record.borrowed_date).toLocaleDateString()}</p>
                      <p>Due: {new Date(record.due_date).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => handleReturn(record.id)}
                      className="btn-primary"
                    >
                      Return
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h3>All History</h3>
          {history.length === 0 ? (
            <p>No borrowing history yet.</p>
          ) : (
            <div className="history-list">
              {history.map(record => (
                <div key={record.id} className="history-item">
                  <div className="history-info">
                    <h4>{record.title}</h4>
                    <p>by {record.author}</p>
                    <p>Borrowed: {new Date(record.borrowed_date).toLocaleDateString()}</p>
                    <p>Due: {new Date(record.due_date).toLocaleDateString()}</p>
                    {record.returned_date && (
                      <p>Returned: {new Date(record.returned_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  {!record.returned_date && (
                    <button
                      onClick={() => handleReturn(record.id)}
                      className="btn-primary"
                    >
                      Return
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Catalog;

