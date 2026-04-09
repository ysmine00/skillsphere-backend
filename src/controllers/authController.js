const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

/**
 * User registration controller
 */
exports.register = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    
    console.log(`[REGISTER] Starting registration for email: ${email}`);
    console.log(`[REGISTER] Password length: ${password ? password.length : 'undefined'}`);
    
    // Validate AUI email domain
    if (!email.endsWith('@aui.ma')) {
      console.log(`[REGISTER] Invalid email domain: ${email}`);
      return res.status(400).json({ message: 'Email must be from the AUI domain (@aui.ma)' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      console.log(`[REGISTER] User already exists: ${email}`);
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    console.log(`[REGISTER] Hashing password for user: ${email}`);
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log(`[REGISTER] Password hashed successfully. Hash starts with: ${hashedPassword.substring(0, 10)}...`);
    
    // Begin transaction
    console.log(`[REGISTER] Beginning database transaction`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert into users table
      console.log(`[REGISTER] Inserting user into database`);
      const userResult = await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id',
        [email, hashedPassword, role]
      );
      
      const userId = userResult.rows[0].user_id;
      console.log(`[REGISTER] User inserted with ID: ${userId}`);
      
      // Insert into user_profiles table
      console.log(`[REGISTER] Creating user profile`);
      await client.query(
        'INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)',
        [userId, full_name]
      );
      
      await client.query('COMMIT');
      console.log(`[REGISTER] Transaction committed successfully`);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          user_id: userId,
          email,
          role,
          full_name
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[REGISTER] Error during transaction: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[REGISTER] Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

/**
 * User login controller
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(`[LOGIN] Login attempt for email: ${email}`);
    console.log(`[LOGIN] Provided password length: ${password ? password.length : 'undefined'}`);
    console.log(`[LOGIN] Password type: ${typeof password}`);
    
    // Find the user
    console.log(`[LOGIN] Querying database for user: ${email}`);
    const userResult = await pool.query(
      'SELECT u.*, p.full_name FROM users u JOIN user_profiles p ON u.user_id = p.user_id WHERE u.email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[LOGIN] User not found: ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    console.log(`[LOGIN] User found. ID: ${user.user_id}, Role: ${user.role}`);
    console.log(`[LOGIN] Stored password hash starts with: ${user.password_hash ? user.password_hash.substring(0, 10) : 'undefined'}...`);
    
    // Check if user is active
    if (!user.is_active) {
      console.log(`[LOGIN] Account is deactivated: ${email}`);
      return res.status(403).json({ message: 'Account is deactivated. Please contact an administrator.' });
    }
    
    // Verify password - with detailed logging
    console.log(`[LOGIN] Attempting to verify password`);
    try {
      // Convert password to string if it's not already
      const passwordStr = String(password).trim();
      console.log(`[LOGIN] Trimmed password length: ${passwordStr.length}`);
      
      // Log some hints about the password without revealing it
      console.log(`[LOGIN] First character of password: ${passwordStr.charAt(0)}`);
      console.log(`[LOGIN] Last character of password: ${passwordStr.charAt(passwordStr.length - 1)}`);
      
      // Try to compare
      console.log(`[LOGIN] Calling bcrypt.compare`);
      const passwordMatch = await bcrypt.compare(passwordStr, user.password_hash);
      console.log(`[LOGIN] bcrypt.compare result: ${passwordMatch}`);
      
      if (!passwordMatch) {
        console.log(`[LOGIN] Password verification failed`);
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      console.log(`[LOGIN] Password verified successfully`);
    } catch (error) {
      console.error(`[LOGIN] Error during password verification: `, error);
      return res.status(500).json({ message: 'Error verifying password', error: error.message });
    }
    
    // Generate JWT token
    console.log(`[LOGIN] Generating JWT token`);
    const tokenSecret = process.env.JWT_SECRET || 'your-secret-key-here';
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role
      },
      tokenSecret,
      { expiresIn: '1d' }
    );
    
    console.log(`[LOGIN] Login successful for user: ${email}`);
    
    // Return user info and token
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('[LOGIN] Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

/**
 * Verify JWT token and return user data
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const tokenSecret = process.env.JWT_SECRET || 'your-secret-key-here';
    const decoded = jwt.verify(token, tokenSecret);
    
    console.log(`[AUTH] Getting current user data for user ID: ${decoded.userId}`);
    
    // Get user data
    const userResult = await pool.query(
      'SELECT u.user_id, u.email, u.role, p.full_name FROM users u JOIN user_profiles p ON u.user_id = p.user_id WHERE u.user_id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[AUTH] User not found for ID: ${decoded.userId}`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log(`[AUTH] User data retrieved successfully for ID: ${decoded.userId}`);
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    console.error('[AUTH] Authentication error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};