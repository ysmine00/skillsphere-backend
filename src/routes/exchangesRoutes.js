const express = require('express');
const exchangesController = require('../controllers/exchangesController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Get user's exchanges
router.get('/user', exchangesController.getUserExchanges);

// Get a single exchange by ID
router.get('/:id', exchangesController.getExchangeById);

// Create a new exchange
router.post('/', exchangesController.createExchange);

// Update exchange status
router.put('/:id/status', exchangesController.updateExchangeStatus);

// Delete an exchange
router.delete('/:id', exchangesController.deleteExchange);

module.exports = router;