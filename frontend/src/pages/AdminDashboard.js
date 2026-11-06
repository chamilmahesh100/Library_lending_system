import React, { useState, useEffect, useCallback } from 'react';
import { booksAPI, usersAPI, categoriesAPI, lendingAPI, reservationAPI, reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

const defaultBookForm = {
  title: '',
  author: '',
  isbn: '',
  quantity: '',
  publisher: '',
  publication_year: '',
  edition: '',
  language: '',
  shelf_location: '',
  description: '',
  category_id: ''
};

const defaultCategoryForm = {
  name: '',
  description: ''
};

const formatLoanDate = (value) => {
  const datePart = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const AdminDashboard = () => {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lendingRecords, setLendingRecords] = useState([]);
  const [overdueRecords, setOverdueRecords] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [overview, setOverview] = useState({
    total_books: 0,
    total_members: 0,
    active_loans: 0,
    overdue_books: 0,
    pending_reservations: 0,
    outstanding_fines: 0,
    unavailable_books: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [returningLoan, setReturningLoan] = useState(null);
  const [returnFineAmount, setReturnFineAmount] = useState('0.00');
  const [returnValidationError, setReturnValidationError] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [requestActionId, setRequestActionId] = useState(null);
  const [isRefreshingRequests, setIsRefreshingRequests] = useState(false);
  const [formData, setFormData] = useState(defaultBookForm);
  const [categoryFormData, setCategoryFormData] = useState(defaultCategoryForm);
  const { user, logout } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const refreshBorrowRequests = useCallback(async () => {
    setIsRefreshingRequests(true);
    try {
      const response = await lendingAPI.getAll();
      setLendingRecords(response.data.data.records || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to refresh borrow requests');
    } finally {
      setIsRefreshingRequests(false);
    }
  }, []);

  useEffect(() => {
    const refreshInterval = setInterval(refreshBorrowRequests, 15000);
    return () => clearInterval(refreshInterval);
  }, [refreshBorrowRequests]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [booksRes, usersRes, categoriesRes, lendingRes, overdueRes, reservationsRes, overviewRes] = await Promise.all([
        booksAPI.getAll(),
        usersAPI.getAll(),
        categoriesAPI.getAll(),
        lendingAPI.getAll(),
        lendingAPI.getOverdue(),
        reservationAPI.getAllAdmin(),
        reportsAPI.getOverview()
      ]);

      const booksWithCopies = await Promise.all(
        (booksRes.data.data.books || []).map(async (book) => {
          try {
            const copiesRes = await booksAPI.getCopies(book.id);
            return { ...book, copies: copiesRes.data.data.copies || [] };
          } catch (error) {
            return { ...book, copies: [] };
          }
        })
      );

      setBooks(booksWithCopies);
      setUsers(usersRes.data.data.users);
      setCategories(categoriesRes.data.data.categories || []);
      setLendingRecords(lendingRes.data.data.records || []);
      setOverdueRecords(overdueRes.data.data.records || []);
      setReservations(reservationsRes.data.data.reservations || []);
      setOverview(overviewRes?.data?.data?.metrics || {
        total_books: 0,
        total_members: 0,
        active_loans: 0,
        overdue_books: 0,
        pending_reservations: 0,
        outstanding_fines: 0,
        unavailable_books: 0
      });
      setRecentActivity(overviewRes?.data?.data?.recent_activity || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCategoryInputChange = (e) => {
    setCategoryFormData({ ...categoryFormData, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    setEditingBook(null);
    setFormData(defaultBookForm);
    setShowAddForm(true);
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: book.quantity.toString(),
      publisher: book.publisher || '',
      publication_year: book.publication_year ? book.publication_year.toString() : '',
      edition: book.edition || '',
      language: book.language || '',
      shelf_location: book.shelf_location || '',
      description: book.description || '',
      category_id: book.category_id ? String(book.category_id) : ''
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.title || !formData.author || !formData.isbn || !formData.quantity) {
      setError('Please fill in all required fields');
      return;
    }

    const parsedQuantity = parseInt(formData.quantity, 10);
    if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
      setError('Quantity must be a non-negative number');
      return;
    }

    try {
      const payload = {
        title: formData.title,
        author: formData.author,
        isbn: formData.isbn,
        quantity: parsedQuantity,
        publisher: formData.publisher,
        publication_year: formData.publication_year ? parseInt(formData.publication_year, 10) : null,
        edition: formData.edition,
        language: formData.language,
        shelf_location: formData.shelf_location,
        description: formData.description,
        category_id: formData.category_id ? parseInt(formData.category_id, 10) : null
      };

      if (editingBook) {
        await booksAPI.update(editingBook.id, payload);
        setSuccess('Book updated successfully!');
      } else {
        await booksAPI.create(payload);
        setSuccess('Book added successfully!');
      }
      setShowAddForm(false);
      setFormData(defaultBookForm);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this book?')) {
      return;
    }

    try {
      setError('');
      await booksAPI.delete(id);
      setSuccess('Book deleted successfully!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete book');
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData(defaultCategoryForm);
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryFormData({ name: category.name, description: category.description || '' });
    setShowCategoryForm(true);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!categoryFormData.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, categoryFormData);
        setSuccess('Category updated successfully!');
      } else {
        await categoriesAPI.create(categoryFormData);
        setSuccess('Category created successfully!');
      }
      setShowCategoryForm(false);
      setCategoryFormData(defaultCategoryForm);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      setError('');
      await categoriesAPI.delete(id);
      setSuccess('Category deleted successfully!');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleMemberStatusToggle = async (member) => {
    try {
      setError('');
      setSuccess('');
      await usersAPI.updateStatus(member.id, {
        is_active: member.is_active ? 0 : 1,
        max_active_loans: Number(member.max_active_loans || 5)
      });
      setSuccess(`Member ${member.name} status updated successfully.`);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update member status');
    }
  };

  const handleBorrowLimitChange = async (memberId, limit) => {
    try {
      setError('');
      setSuccess('');
      await usersAPI.updateStatus(memberId, {
        is_active: 1,
        max_active_loans: Number(limit)
      });
      setSuccess('Borrowing limit updated successfully.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update borrowing limit');
    }
  };

  const handleReservationFulfill = async (reservationId) => {
    try {
      setError('');
      setSuccess('');
      await reservationAPI.fulfill(reservationId);
      setSuccess('Reservation fulfilled successfully.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fulfill reservation');
    }
  };

  const handleCopyStatusChange = async (bookId, copyId, status) => {
    try {
      setError('');
      setSuccess('');
      await booksAPI.updateCopyStatus(bookId, copyId, { status });
      setSuccess('Copy status updated successfully.');
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update copy status');
    }
  };

  const handleAdminReturn = async (lendingId) => {
    const fineValue = returnFineAmount.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(fineValue)) {
      setReturnValidationError('Enter a non-negative amount with up to two decimal places.');
      return;
    }

    const parsedFine = Number(fineValue);
    if (!Number.isFinite(parsedFine) || parsedFine > 99999999.99) {
      setReturnValidationError('Fine amount must not exceed $99,999,999.99.');
      return;
    }

    setIsReturning(true);
    setReturnValidationError('');
    try {
      setError('');
      setSuccess('');
      const response = await lendingAPI.return({ lending_id: lendingId, fine_amount: fineValue });
      setSuccess(response.data.message || 'Book returned successfully.');
      setReturningLoan(null);
      await loadData();
    } catch (err) {
      setReturnValidationError(err.response?.data?.message || 'Failed to return book');
    } finally {
      setIsReturning(false);
    }
  };

  const handleBorrowRequestDecision = async (record, decision) => {
    setRequestActionId(record.id);
    setError('');
    setSuccess('');
    try {
      const response = decision === 'approve'
        ? await lendingAPI.approve(record.id)
        : await lendingAPI.reject(record.id);
      setSuccess(response.data.message || `Borrow request ${decision}d successfully.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${decision} borrow request`);
    } finally {
      setRequestActionId(null);
    }
  };

  const pendingBorrowRequests = lendingRecords.filter((record) => record.status === 'PENDING');

  if (loading) {
    return <div className="admin-container"><div className="page-loading">Loading dashboard...</div></div>;
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="header-actions">
          <a href="/catalog" className="btn-link">View Catalog</a>
          <a href="/admin/reports" className="btn-link">Reports</a>
          <span>Welcome, {user?.name}</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {returningLoan && (
        <div className="form-modal" role="presentation">
          <div className="form-card return-modal-card" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
            <h2 id="return-modal-title">Return Book</h2>
            <dl className="return-loan-details">
              <div><dt>Book</dt><dd>{returningLoan.book_title}</dd></div>
              <div><dt>Member</dt><dd>{returningLoan.user_name}</dd></div>
              <div><dt>Borrowed</dt><dd>{formatLoanDate(returningLoan.borrowed_date)}</dd></div>
              <div><dt>Due</dt><dd>{formatLoanDate(returningLoan.due_date)}</dd></div>
            </dl>
            <form onSubmit={(event) => {
              event.preventDefault();
              handleAdminReturn(returningLoan.id);
            }}>
              <div className="form-group">
                <label htmlFor="return-fine-amount">Fine Amount</label>
                <input
                  id="return-fine-amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  maxLength="32"
                  value={returnFineAmount}
                  onChange={(event) => {
                    setReturnFineAmount(event.target.value);
                    setReturnValidationError('');
                  }}
                  aria-describedby={returnValidationError ? 'return-fine-error' : undefined}
                  aria-invalid={Boolean(returnValidationError)}
                />
              </div>
              {returnValidationError && <p id="return-fine-error" className="return-validation-error" role="alert">{returnValidationError}</p>}
              <div className="form-actions">
                <button type="button" className="btn-secondary" disabled={isReturning} onClick={() => {
                  setReturningLoan(null);
                  setReturnValidationError('');
                }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isReturning}>
                  {isReturning ? 'Returning...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-content">
        <section className="overview-section dashboard-panel">
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">Total Books</span>
              <strong>{overview.total_books}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Members</span>
              <strong>{overview.total_members}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Active Loans</span>
              <strong>{overview.active_loans}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Overdue</span>
              <strong>{overview.overdue_books}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Reservations</span>
              <strong>{overview.pending_reservations}</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Outstanding Fines</span>
              <strong>${Number(overview.outstanding_fines || 0).toFixed(2)}</strong>
            </div>
          </div>
        </section>

        <section className="borrow-requests-section dashboard-panel">
          <div className="section-header">
            <h2>Borrow Requests</h2>
            <div className="borrow-requests-actions">
              <span className="status-badge status-pending">
                {pendingBorrowRequests.length} pending
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={refreshBorrowRequests}
                disabled={isRefreshingRequests}
              >
                {isRefreshingRequests ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
          {pendingBorrowRequests.length === 0 ? (
            <p className="empty-state">There are no borrow requests waiting for approval.</p>
          ) : (
            <div className="table-scroll">
              <table className="lending-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Requested</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBorrowRequests.map((record) => (
                      <tr key={record.id}>
                        <td>{record.book_title}<br /><small>{record.book_author}</small></td>
                        <td>{record.user_name}<br /><small>{record.user_email}</small></td>
                        <td>{formatLoanDate(record.created_at)}</td>
                        <td>
                          <button
                            onClick={() => handleBorrowRequestDecision(record, 'approve')}
                            className="btn-small btn-edit"
                            disabled={requestActionId === record.id}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleBorrowRequestDecision(record, 'reject')}
                            className="btn-small btn-delete"
                            disabled={requestActionId === record.id}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="activity-section dashboard-panel">
          <div className="section-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p>No recent activity recorded yet.</p>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-description">
                    <strong className="activity-action">{activity.action}</strong>
                    <p>{activity.description || 'System event'}</p>
                  </div>
                  <div className="activity-meta">
                    <span>{activity.user_name || 'System'}</span>
                    <small>{new Date(activity.created_at).toLocaleString()}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="books-section dashboard-panel">
          <div className="section-header">
            <h2>Book Management</h2>
            <button onClick={handleAdd} className="btn-primary">Add New Book</button>
          </div>

          {showAddForm && (
            <div className="form-modal">
              <div className="form-card" role="dialog" aria-modal="true" aria-labelledby="book-form-title">
                <div className="form-card-header">
                  <h3 id="book-form-title">{editingBook ? 'Edit Book' : 'Add New Book'}</h3>
                  <button type="button" onClick={() => setShowAddForm(false)} className="modal-close" aria-label="Close book form">×</button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Title</label>
                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Author</label>
                    <input type="text" name="author" value={formData.author} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>ISBN</label>
                    <input type="text" name="isbn" value={formData.isbn} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select name="category_id" value={formData.category_id} onChange={handleInputChange}>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Publisher</label>
                    <input type="text" name="publisher" value={formData.publisher} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Publication Year</label>
                    <input type="number" name="publication_year" value={formData.publication_year} onChange={handleInputChange} min="1900" />
                  </div>
                  <div className="form-group">
                    <label>Edition</label>
                    <input type="text" name="edition" value={formData.edition} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Language</label>
                    <input type="text" name="language" value={formData.language} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Shelf Location</label>
                    <input type="text" name="shelf_location" value={formData.shelf_location} onChange={handleInputChange} />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} min="0" required />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      {editingBook ? 'Update' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="books-table table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>ISBN</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 ? (
                  <tr>
                    <td className="empty-cell" colSpan="8">No books found</td>
                  </tr>
                ) : (
                  books.map(book => (
                    <tr key={book.id}>
                      <td>{book.id}</td>
                      <td>{book.title}</td>
                      <td>{book.author}</td>
                      <td>{book.category_name || 'Uncategorized'}</td>
                      <td>{book.isbn}</td>
                      <td>{book.quantity}</td>
                      <td>{book.available_quantity}</td>
                      <td>
                        <button onClick={() => handleEdit(book)} className="btn-small btn-edit">Edit</button>
                        <button onClick={() => handleDelete(book.id)} className="btn-small btn-delete">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="categories-section dashboard-panel">
          <div className="section-header">
            <h2>Categories</h2>
            <button onClick={handleAddCategory} className="btn-primary">Add Category</button>
          </div>

          {showCategoryForm && (
            <div className="form-modal">
              <div className="form-card" role="dialog" aria-modal="true" aria-labelledby="category-form-title">
                <div className="form-card-header">
                  <h3 id="category-form-title">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
                  <button type="button" onClick={() => setShowCategoryForm(false)} className="modal-close" aria-label="Close category form">×</button>
                </div>
                <form onSubmit={handleCategorySubmit}>
                  <div className="form-group">
                    <label>Name</label>
                    <input type="text" name="name" value={categoryFormData.name} onChange={handleCategoryInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea name="description" value={categoryFormData.description} onChange={handleCategoryInputChange} rows="3" />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">{editingCategory ? 'Update' : 'Add'}</button>
                    <button type="button" onClick={() => setShowCategoryForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="categories-list">
            {categories.length === 0 ? (
              <p className="empty-state">No categories available.</p>
            ) : (
              categories.map((category) => (
                <div key={category.id} className="list-item">
                  <div>
                    <strong>{category.name}</strong>
                    {category.description && <p>{category.description}</p>}
                  </div>
                  <div>
                    <button onClick={() => handleEditCategory(category)} className="btn-small btn-edit">Edit</button>
                    <button onClick={() => handleDeleteCategory(category.id)} className="btn-small btn-delete">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="users-section dashboard-panel">
          <h2>Member Management</h2>
          <div className="users-table table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Active Loans</th>
                  <th>Max Limit</th>
                  <th>Overdue Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="empty-cell" colSpan="9">No users found</td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td><span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>{user.active_loans || 0}</td>
                      <td>
                        <select
                          value={user.max_active_loans || 5}
                          onChange={(e) => handleBorrowLimitChange(user.id, e.target.value)}
                        >
                          {[1, 2, 3, 5, 10, 15].map((limit) => (
                            <option key={limit} value={limit}>{limit}</option>
                          ))}
                        </select>
                      </td>
                      <td>${Number(user.overdue_balance || 0).toFixed(2)}</td>
                      <td>
                        <button onClick={() => handleMemberStatusToggle(user)} className="btn-small btn-edit">
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lending-section dashboard-panel">
          <h2>Lending Management</h2>
          {lendingRecords.length === 0 ? (
            <p className="empty-state">No lending records found.</p>
          ) : (
            <div className="table-scroll">
              <table className="lending-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Member</th>
                    <th>Borrowed / Requested</th>
                    <th>Due</th>
                    <th>Returned</th>
                    <th>Status</th>
                    <th>Fine</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lendingRecords.map((record) => {
                    const fine = Number(record.fine_amount || 0);
                    const isOverdue = overdueRecords.some((overdue) => overdue.id === record.id);
                    const status = record.status === 'PENDING'
                      ? 'PENDING'
                      : record.status === 'REJECTED'
                        ? 'REJECTED'
                        : record.returned_date
                      ? 'RETURNED'
                      : isOverdue ? 'OVERDUE' : 'ACTIVE';

                    return (
                      <tr key={record.id}>
                        <td>{record.book_title}</td>
                        <td>{record.user_name}<br /><small>{record.user_email}</small></td>
                        <td>{formatLoanDate(record.borrowed_date || record.created_at)}</td>
                        <td>{formatLoanDate(record.due_date)}</td>
                        <td>{record.returned_date ? formatLoanDate(record.returned_date) : '—'}</td>
                        <td><span className={`status-badge status-${status.toLowerCase()}`}>{status}</span></td>
                        <td>${fine.toFixed(2)}</td>
                        <td>
                          {record.status === 'APPROVED' && !record.returned_date ? (
                            <button onClick={() => {
                              setReturningLoan(record);
                              setReturnFineAmount('0.00');
                              setReturnValidationError('');
                            }} className="btn-small btn-edit">
                              Return
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overdue-section dashboard-panel">
          <h2>Overdue Management</h2>
          {overdueRecords.length === 0 ? (
            <p className="empty-state">No overdue books at the moment.</p>
          ) : (
            <div className="record-list">
              {overdueRecords.map((record) => (
                <div key={record.id} className="overdue-card">
                  <div className="record-main">
                    <strong>{record.book_title}</strong>
                    <p className="record-member">{record.user_name} <span>({record.user_email})</span></p>
                    <div className="record-details">
                      <span>Due: {formatLoanDate(record.due_date)}</span>
                      <span>{record.overdue_days} day(s) overdue</span>
                    </div>
                  </div>
                  <strong className="record-fine">Fine: ${Number(record.overdue_fine || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="reservations-section dashboard-panel">
          <h2>Reservations</h2>
          {reservations.length === 0 ? (
            <p className="empty-state">No reservations found.</p>
          ) : (
            <div className="record-list">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="reservation-card">
                  <div className="record-main">
                    <strong>{reservation.book_title}</strong>
                    <p>{reservation.user_name} ({reservation.user_email})</p>
                    <span className={`status-badge status-${String(reservation.status).toLowerCase()}`}>{reservation.status}</span>
                  </div>
                  {reservation.status === 'WAITING' && (
                    <button onClick={() => handleReservationFulfill(reservation.id)} className="btn-small btn-edit reservation-fulfill">
                      Fulfill
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="copy-status-section dashboard-panel">
          <h2>Copy Status Management</h2>
          <div className="copy-book-grid">
            {books.map((book) => (
              <div key={book.id} className="copy-book-card">
                <div className="copy-book-header">
                  <div>
                    <strong>{book.title}</strong>
                    <p>{book.available_quantity} of {book.quantity} available</p>
                  </div>
                </div>
                <div className="copy-list">
                  {book.copies && book.copies.length > 0 ? (
                    book.copies.map((copy) => (
                      <div key={copy.id} className="copy-row">
                        <span className="copy-accession">{copy.accession_number}</span>
                        <span className={`status-badge status-${String(copy.status).toLowerCase()}`}>{copy.status}</span>
                        <div className="copy-actions">
                          <button onClick={() => handleCopyStatusChange(book.id, copy.id, 'AVAILABLE')} className="btn-small btn-edit">Set Available</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">No copies available.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
