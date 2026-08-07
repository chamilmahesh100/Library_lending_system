const express = require('express');
const router = express.Router();
const {
  generateDailyReport,
  generateMonthlyReport,
  exportDailyReportCSV,
  exportDailyReportPDF,
  exportMonthlyReportCSV,
  exportMonthlyReportPDF
} = require('../controllers/reportController');
const { authenticate, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/reports/daily
 * @desc    Generate daily report
 * @access  Private (Admin)
 */
router.get('/daily', authenticate, isAdmin, generateDailyReport);

/**
 * @route   GET /api/reports/monthly
 * @desc    Generate monthly report
 * @access  Private (Admin)
 */
router.get('/monthly', authenticate, isAdmin, generateMonthlyReport);

/**
 * @route   GET /api/reports/daily/export/csv
 * @desc    Export daily report as CSV
 * @access  Private (Admin)
 */
router.get('/daily/export/csv', authenticate, isAdmin, exportDailyReportCSV);

/**
 * @route   GET /api/reports/daily/export/pdf
 * @desc    Export daily report as PDF
 * @access  Private (Admin)
 */
router.get('/daily/export/pdf', authenticate, isAdmin, exportDailyReportPDF);

/**
 * @route   GET /api/reports/monthly/export/csv
 * @desc    Export monthly report as CSV
 * @access  Private (Admin)
 */
router.get('/monthly/export/csv', authenticate, isAdmin, exportMonthlyReportCSV);

/**
 * @route   GET /api/reports/monthly/export/pdf
 * @desc    Export monthly report as PDF
 * @access  Private (Admin)
 */
router.get('/monthly/export/pdf', authenticate, isAdmin, exportMonthlyReportPDF);

module.exports = router;

