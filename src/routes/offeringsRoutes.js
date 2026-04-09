const express = require('express');
const offeringsController = require('../controllers/offeringsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Get all offerings
router.get('/', offeringsController.getAllOfferings);

// Get user's offerings
router.get('/user', offeringsController.getUserOfferings);

// Get a single offering by ID
router.get('/:id', offeringsController.getOfferingById);

// Create a new offering
router.post('/', offeringsController.createOffering);

// Update an offering
router.put('/:id', offeringsController.updateOffering);

// Delete an offering
router.delete('/:id', offeringsController.deleteOffering);

module.exports = router;