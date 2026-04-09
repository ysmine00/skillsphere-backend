const jwt = require('jsonwebtoken');
const pool = require('../config/database');

exports.protect = async (req, res, next) => {
  try {
    // Get token from authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    // Verify token
    const tokenSecret = process.env.JWT_SECRET || 'your-secret-key-here';
    const decoded = jwt.verify(token, tokenSecret);

    // Check if user exists
    const userResult = await pool.query(
      'SELECT user_id, email, role FROM users WHERE user_id = $1 AND is_active = TRUE', 
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found or deactivated' });
    }

    // Add user to request object
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('[AUTH] Authentication middleware error:', error);
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};