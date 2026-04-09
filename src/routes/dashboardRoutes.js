const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(protect);

// Get dashboard data for authenticated user
router.get('/', dashboardController.getUserDashboard);

module.exports = router;