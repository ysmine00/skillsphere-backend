
const express = require('express');
const requestsController = require('../controllers/requestsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Get all requests
router.get('/', requestsController.getAllRequests);

// Get user's requests
router.get('/user', requestsController.getUserRequests);

// Get a single request by ID
router.get('/:id', requestsController.getRequestById);

// Create a new request
router.post('/', requestsController.createRequest);

// Update a request
router.put('/:id', requestsController.updateRequest);

// Delete a request
router.delete('/:id', requestsController.deleteRequest);

module.exports = router;