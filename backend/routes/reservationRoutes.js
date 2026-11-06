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

router.get('/', authenticate, getUserReservations);
router.post('/', authenticate, createReservation);
router.delete('/:id', authenticate, cancelReservation);
router.get('/all', authenticate, isAdmin, getAllReservations);
router.put('/:id/fulfill', authenticate, isAdmin, fulfillReservation);

module.exports = router;
