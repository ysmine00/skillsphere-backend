const express = require('express');
const profileController = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Get current user's profile
router.get('/', profileController.getUserProfile);

// Update user profile
router.put('/', profileController.updateProfile);

module.exports = router;