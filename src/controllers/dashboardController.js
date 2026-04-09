const pool = require('../config/database');

/**
 * Get dashboard data for authenticated user
 */
exports.getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[DASHBOARD] Getting dashboard data for user: ${userId}`);

    // Get user profile data
    const profileQuery = await pool.query(
      `SELECT p.*, u.email, u.role 
       FROM user_profiles p 
       JOIN users u ON p.user_id = u.user_id 
       WHERE p.user_id = $1`,
      [userId]
    );

    if (profileQuery.rows.length === 0) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const userProfile = profileQuery.rows[0];

    // Get user's skill offerings (max 5 recent)
    const offeringsQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE o.user_id = $1 AND o.is_active = TRUE
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Get user's skill requests (max 5 recent)
    const requestsQuery = await pool.query(
      `SELECT r.*, s.name AS skill_name, c.name AS category_name
       FROM skill_requests r
       JOIN skills s ON r.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE r.user_id = $1 AND r.is_active = TRUE
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Get recent exchanges (as provider or requester)
    const exchangesQuery = await pool.query(
      `SELECT e.*, 
        po.title AS offering_title, 
        s.name AS skill_name,
        up.full_name AS provider_name,
        ur.full_name AS requester_name
       FROM exchanges e
       JOIN skill_offerings po ON e.offering_id = po.offering_id
       JOIN skills s ON po.skill_id = s.skill_id
       JOIN user_profiles up ON e.provider_id = up.user_id
       JOIN user_profiles ur ON e.requester_id = ur.user_id
       WHERE (e.provider_id = $1 OR e.requester_id = $1)
       ORDER BY e.updated_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get user's skills
    const skillsQuery = await pool.query(
      `SELECT us.*, s.name AS skill_name, c.name AS category_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE us.user_id = $1`,
      [userId]
    );

    // Get counts
    const countsQuery = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM skill_offerings WHERE user_id = $1 AND is_active = TRUE) AS offerings_count,
        (SELECT COUNT(*) FROM skill_requests WHERE user_id = $1 AND is_active = TRUE) AS requests_count,
        (SELECT COUNT(*) FROM exchanges WHERE provider_id = $1) AS provider_count,
        (SELECT COUNT(*) FROM exchanges WHERE requester_id = $1) AS requester_count,
        (SELECT COUNT(*) FROM exchanges 
         WHERE (provider_id = $1 OR requester_id = $1) 
         AND status = 'completed') AS completed_count`,
      [userId]
    );

    // Get activity score
    const activityScoreQuery = await pool.query(
      'SELECT calculate_user_activity_score($1) AS activity_score',
      [userId]
    );

    // Get related offerings that match user's skills
    const relatedOffersQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name, up.full_name AS provider_name
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       JOIN user_profiles up ON o.user_id = up.user_id
       WHERE o.is_active = TRUE 
         AND o.user_id != $1
         AND EXISTS (
           SELECT 1 FROM user_skills us 
           WHERE us.user_id = $1 
             AND us.skill_id = o.skill_id
         )
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      profile: userProfile,
      skills: skillsQuery.rows,
      offerings: offeringsQuery.rows,
      requests: requestsQuery.rows,
      exchanges: exchangesQuery.rows,
      stats: countsQuery.rows[0],
      activityScore: activityScoreQuery.rows[0].activity_score,
      relatedOffers: relatedOffersQuery.rows
    });
  } catch (error) {
    console.error('[DASHBOARD] Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Server error fetching dashboard data', error: error.message });
  }
};