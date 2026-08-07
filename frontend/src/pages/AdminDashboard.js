import React, { useState, useEffect } from 'react';
import { booksAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({ title: '', author: '', isbn: '', quantity: '' });
  const { user, logout } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [booksRes, usersRes] = await Promise.all([
        booksAPI.getAll(),
        usersAPI.getAll()
      ]);
      setBooks(booksRes.data.data.books);
      setUsers(usersRes.data.data.users);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    setEditingBook(null);
    setFormData({ title: '', author: '', isbn: '', quantity: '' });
    setShowAddForm(true);
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      quantity: book.quantity.toString()
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Frontend validation
    if (!formData.title || !formData.author || !formData.isbn || !formData.quantity) {
      setError('Please fill in all fields');
      return;
    }

    if (parseInt(formData.quantity) < 0) {
      setError('Quantity must be a non-negative number');
      return;
    }

    try {
      if (editingBook) {
        await booksAPI.update(editingBook.id, {
          title: formData.title,
          author: formData.author,
          isbn: formData.isbn,
          quantity: parseInt(formData.quantity)
        });
        setSuccess('Book updated successfully!');
      } else {
        await booksAPI.create({
          title: formData.title,
          author: formData.author,
          isbn: formData.isbn,
          quantity: parseInt(formData.quantity)
        });
        setSuccess('Book added successfully!');
      }
      setShowAddForm(false);
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

  if (loading) {
    return <div className="admin-container">Loading...</div>;
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

      <div className="admin-content">
        <section className="books-section">
          <div className="section-header">
            <h2>Book Management</h2>
            <button onClick={handleAdd} className="btn-primary">Add New Book</button>
          </div>

          {showAddForm && (
            <div className="form-modal">
              <div className="form-card">
                <h3>{editingBook ? 'Edit Book' : 'Add New Book'}</h3>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Author</label>
                    <input
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ISBN</label>
                    <input
                      type="text"
                      name="isbn"
                      value={formData.isbn}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      {editingBook ? 'Update' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="books-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>ISBN</th>
                  <th>Total</th>
                  <th>Available</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.length === 0 ? (
                  <tr>
                    <td colSpan="7">No books found</td>
                  </tr>
                ) : (
                  books.map(book => (
                    <tr key={book.id}>
                      <td>{book.id}</td>
                      <td>{book.title}</td>
                      <td>{book.author}</td>
                      <td>{book.isbn}</td>
                      <td>{book.quantity}</td>
                      <td>{book.available_quantity}</td>
                      <td>
                        <button
                          onClick={() => handleEdit(book)}
                          className="btn-small btn-edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
                          className="btn-small btn-delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="users-section">
          <h2>Registered Users</h2>
          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="5">No users found</td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;

