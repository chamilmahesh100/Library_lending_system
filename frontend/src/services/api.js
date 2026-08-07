import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me')
};

// Books API
export const booksAPI = {
  getAll: (params) => api.get('/books', { params }),
  getAvailable: () => api.get('/books/available'),
  getById: (id) => api.get(`/books/${id}`),
  create: (data) => api.post('/books', data),
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`)
};

// Lending API
export const lendingAPI = {
  borrow: (data) => api.post('/lending/borrow', data),
  return: (data) => api.post('/lending/return', data),
  getHistory: () => api.get('/lending/history'),
  getAll: () => api.get('/lending/all')
};

// Reports API
export const reportsAPI = {
  getDaily: (params) => api.get('/reports/daily', { params }),
  getMonthly: (params) => api.get('/reports/monthly', { params }),
  exportDailyCSV: (params) => api.get('/reports/daily/export/csv', { params, responseType: 'blob' }),
  exportDailyPDF: (params) => api.get('/reports/daily/export/pdf', { params, responseType: 'blob' }),
  exportMonthlyCSV: (params) => api.get('/reports/monthly/export/csv', { params, responseType: 'blob' }),
  exportMonthlyPDF: (params) => api.get('/reports/monthly/export/pdf', { params, responseType: 'blob' })
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users')
};

export default api;

