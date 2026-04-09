const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Route imports
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const skillsRoutes = require('./routes/skillsRoutes');
const offeringsRoutes = require('./routes/offeringsRoutes');
const requestsRoutes = require('./routes/requestsRoutes');
const exchangesRoutes = require('./routes/exchangesRoutes');
const profileRoutes = require('./routes/profileRoutes');

// Initialize Express app
const app = express();

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(morgan('dev')); // Logging

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/offerings', offeringsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/exchanges', exchangesRoutes);
app.use('/api/profile', profileRoutes);

// Root route for API health check
app.get('/api', (req, res) => {
  res.json({ message: 'SkillSphere API is running' });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;