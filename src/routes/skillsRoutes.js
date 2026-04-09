const express = require('express');
const skillsController = require('../controllers/skillsController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Get all available skills grouped by category
router.get('/available', skillsController.getAllSkills);

// Get all categories
router.get('/categories', skillsController.getCategories);

// Get user's skills
router.get('/user', skillsController.getUserSkills);

// Add skill to user profile
router.post('/user', skillsController.addUserSkill);

// Update user skill
router.put('/user/:user_skill_id', skillsController.updateUserSkill);

// Remove skill from user profile
router.delete('/user/:user_skill_id', skillsController.removeUserSkill);

module.exports = router;