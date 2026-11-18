const express = require('express');
const router = express.Router();
const {
  getUserReservations,
  createReservation,
  cancelReservation,
  getAllReservations,
  fulfillReservation
} = require('../controllers/reservationController');
const { authenticate, isAdmin } = require('../middleware/auth');
const auditActivity = require('../middleware/auditActivity');

router.get('/', authenticate, getUserReservations);
router.post('/', authenticate, auditActivity, createReservation);
router.delete('/:id', authenticate, auditActivity, cancelReservation);
router.get('/all', authenticate, isAdmin, getAllReservations);
router.put('/:id/fulfill', authenticate, isAdmin, auditActivity, fulfillReservation);

module.exports = router;
