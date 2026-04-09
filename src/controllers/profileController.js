const pool = require('../config/database');

/**
 * Get current user's profile
 */
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[PROFILE] Getting profile for user: ${userId}`);
    
    // Get user profile data
    const profileQuery = await pool.query(
      `SELECT p.*, u.email, u.role, u.is_active
       FROM user_profiles p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.user_id = $1`,
      [userId]
    );
    
    if (profileQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Get counts and statistics
    const statsQuery = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM skill_offerings WHERE user_id = $1) AS offerings_count,
         (SELECT COUNT(*) FROM skill_requests WHERE user_id = $1) AS requests_count,
         (SELECT COUNT(*) FROM exchanges WHERE provider_id = $1) AS provided_count,
         (SELECT COUNT(*) FROM exchanges WHERE requester_id = $1) AS requested_count,
         (SELECT COUNT(*) FROM exchanges 
          WHERE (provider_id = $1 OR requester_id = $1) 
          AND status = 'completed') AS completed_count,
         (SELECT calculate_user_activity_score($1)) AS activity_score`,
      [userId]
    );
    
    // Get user skills
    const skillsQuery = await pool.query(
      `SELECT us.*, s.name AS skill_name, c.name AS category_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE us.user_id = $1
       ORDER BY us.proficiency_level DESC, s.name`,
      [userId]
    );
    
    res.json({
      profile: profileQuery.rows[0],
      stats: statsQuery.rows[0],
      skills: skillsQuery.rows
    });
  } catch (error) {
    console.error('[PROFILE] Error getting user profile:', error);
    res.status(500).json({ message: 'Server error fetching profile', error: error.message });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { full_name, department_major, contact_preference, bio } = req.body;
    
    console.log(`[PROFILE] Updating profile for user: ${userId}`);
    
    // Check if profile exists
    const profileCheck = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Update the profile
    await pool.query(
      `UPDATE user_profiles
       SET full_name = $1, department_major = $2, contact_preference = $3, bio = $4
       WHERE user_id = $5`,
      [full_name, department_major, contact_preference, bio, userId]
    );
    
    // Get updated profile
    const updatedProfileQuery = await pool.query(
      `SELECT p.*, u.email, u.role
       FROM user_profiles p
       JOIN users u ON p.user_id = u.user_id
       WHERE p.user_id = $1`,
      [userId]
    );
    
    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfileQuery.rows[0]
    });
  } catch (error) {
    console.error('[PROFILE] Error updating profile:', error);
    res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
};