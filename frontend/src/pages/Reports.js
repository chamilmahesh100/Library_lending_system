import React, { useState } from 'react';
import { reportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Reports.css';

const Reports = () => {
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);
  const [dailyReport, setDailyReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuth();

  const handleDailyReport = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reportsAPI.getDaily({ date: dailyDate });
      setDailyReport(response.data.data);
    } catch (err) {
      setError('Failed to generate daily report');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthlyReport = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reportsAPI.getMonthly({ year: monthlyYear, month: monthlyMonth });
      setMonthlyReport(response.data.data);
    } catch (err) {
      setError('Failed to generate monthly report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportDailyCSV = async () => {
    try {
      const response = await reportsAPI.exportDailyCSV({ date: dailyDate });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily_report_${dailyDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export CSV');
    }
  };

  const handleExportDailyPDF = async () => {
    try {
      const response = await reportsAPI.exportDailyPDF({ date: dailyDate });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daily_report_${dailyDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export PDF');
    }
  };

  const handleExportMonthlyCSV = async () => {
    try {
      const response = await reportsAPI.exportMonthlyCSV({ year: monthlyYear, month: monthlyMonth });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monthly_report_${monthlyYear}_${monthlyMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export CSV');
    }
  };

  const handleExportMonthlyPDF = async () => {
    try {
      const response = await reportsAPI.exportMonthlyPDF({ year: monthlyYear, month: monthlyMonth });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monthly_report_${monthlyYear}_${monthlyMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export PDF');
    }
  };

  return (
    <div className="reports-container">
      <header className="reports-header">
        <h1>Reports</h1>
        <div className="header-actions">
          <a href="/admin/dashboard" className="btn-link">Dashboard</a>
          <a href="/catalog" className="btn-link">Catalog</a>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="reports-content">
        <section className="daily-report-section">
          <h2>Daily Report</h2>
          <div className="report-controls">
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
            />
            <button onClick={handleDailyReport} disabled={loading} className="btn-primary">
              Generate Report
            </button>
          </div>

          {dailyReport && (
            <div className="report-results">
              <div className="report-summary">
                <p><strong>Date:</strong> {dailyReport.date}</p>
                <p><strong>Total Transactions:</strong> {dailyReport.total_transactions}</p>
              </div>
              {dailyReport.records.length > 0 && (
                <div className="export-buttons">
                  <button onClick={handleExportDailyCSV} className="btn-secondary">
                    Export CSV
                  </button>
                  <button onClick={handleExportDailyPDF} className="btn-secondary">
                    Export PDF
                  </button>
                </div>
              )}
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Book</th>
                      <th>Borrowed</th>
                      <th>Returned</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyReport.records.length === 0 ? (
                      <tr>
                        <td colSpan="6">No transactions found for this date</td>
                      </tr>
                    ) : (
                      dailyReport.records.map(record => (
                        <tr key={record.id}>
                          <td>{record.id}</td>
                          <td>{record.user_name}</td>
                          <td>{record.book_title}</td>
                          <td>{new Date(record.borrowed_date).toLocaleDateString()}</td>
                          <td>{record.returned_date ? new Date(record.returned_date).toLocaleDateString() : '-'}</td>
                          <td>{record.transaction_type}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="monthly-report-section">
          <h2>Monthly Report</h2>
          <div className="report-controls">
            <input
              type="number"
              value={monthlyYear}
              onChange={(e) => setMonthlyYear(parseInt(e.target.value))}
              min="2020"
              max="2100"
              placeholder="Year"
            />
            <input
              type="number"
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(parseInt(e.target.value))}
              min="1"
              max="12"
              placeholder="Month"
            />
            <button onClick={handleMonthlyReport} disabled={loading} className="btn-primary">
              Generate Report
            </button>
          </div>

          {monthlyReport && (
            <div className="report-results">
              <div className="report-summary">
                <p><strong>Period:</strong> {monthlyReport.start_date} to {monthlyReport.end_date}</p>
                <p><strong>Total Transactions:</strong> {monthlyReport.total_transactions}</p>
                <p><strong>Total Borrows:</strong> {monthlyReport.total_borrows}</p>
                <p><strong>Total Returns:</strong> {monthlyReport.total_returns}</p>
              </div>
              {monthlyReport.records.length > 0 && (
                <div className="export-buttons">
                  <button onClick={handleExportMonthlyCSV} className="btn-secondary">
                    Export CSV
                  </button>
                  <button onClick={handleExportMonthlyPDF} className="btn-secondary">
                    Export PDF
                  </button>
                </div>
              )}
              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Book</th>
                      <th>Borrowed</th>
                      <th>Returned</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.records.length === 0 ? (
                      <tr>
                        <td colSpan="6">No transactions found for this period</td>
                      </tr>
                    ) : (
                      monthlyReport.records.map(record => (
                        <tr key={record.id}>
                          <td>{record.id}</td>
                          <td>{record.user_name}</td>
                          <td>{record.book_title}</td>
                          <td>{new Date(record.borrowed_date).toLocaleDateString()}</td>
                          <td>{record.returned_date ? new Date(record.returned_date).toLocaleDateString() : '-'}</td>
                          <td>{record.transaction_type}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Reports;

