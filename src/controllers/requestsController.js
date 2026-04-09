const pool = require('../config/database');

/**
 * Get all skill requests
 */
exports.getAllRequests = async (req, res) => {
  try {
    console.log(`[REQUESTS] Getting all skill requests`);
    
    const { category, skill, urgency } = req.query;
    
    // Build the WHERE clause dynamically based on filters
    let query = `
      SELECT r.*, s.name AS skill_name, c.name AS category_name, 
             p.full_name AS requester_name, p.user_id AS requester_id
      FROM skill_requests r
      JOIN skills s ON r.skill_id = s.skill_id
      JOIN categories c ON s.category_id = c.category_id
      JOIN user_profiles p ON r.user_id = p.user_id
      WHERE r.is_active = TRUE
    `;
    
    const queryParams = [];
    
    // Add category filter if provided
    if (category) {
      queryParams.push(category);
      query += ` AND c.category_id = $${queryParams.length}`;
    }
    
    // Add skill filter if provided
    if (skill) {
      queryParams.push(skill);
      query += ` AND s.skill_id = $${queryParams.length}`;
    }
    
    // Add urgency filter if provided
    if (urgency) {
      queryParams.push(urgency);
      query += ` AND r.urgency = $${queryParams.length}`;
    }
    
    query += ` ORDER BY 
               CASE
                 WHEN r.urgency = 'high' THEN 1
                 WHEN r.urgency = 'medium' THEN 2
                 ELSE 3
               END, 
               r.created_at DESC`;
    
    const requestsQuery = await pool.query(query, queryParams);
    
    res.json(requestsQuery.rows);
  } catch (error) {
    console.error('[REQUESTS] Error getting requests:', error);
    res.status(500).json({ message: 'Server error fetching requests', error: error.message });
  }
};

/**
 * Get user's skill requests
 */
exports.getUserRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[REQUESTS] Getting skill requests for user: ${userId}`);
    
    const requestsQuery = await pool.query(
      `SELECT r.*, s.name AS skill_name, c.name AS category_name
       FROM skill_requests r
       JOIN skills s ON r.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    
    res.json(requestsQuery.rows);
  } catch (error) {
    console.error('[REQUESTS] Error getting user requests:', error);
    res.status(500).json({ message: 'Server error fetching user requests', error: error.message });
  }
};

/**
 * Get a single skill request by ID
 */
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[REQUESTS] Getting skill request with ID: ${id}`);
    
    const requestQuery = await pool.query(
      `SELECT r.*, s.name AS skill_name, c.name AS category_name, 
              p.full_name AS requester_name, p.user_id AS requester_id
       FROM skill_requests r
       JOIN skills s ON r.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       JOIN user_profiles p ON r.user_id = p.user_id
       WHERE r.request_id = $1`,
      [id]
    );
    
    if (requestQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Get matching offerings for this request
    const matchingQuery = await pool.query(
      `SELECT find_matching_offerings($1) AS matching_offerings`,
      [id]
    );
    
    let matchingOfferings = [];
    if (matchingQuery.rows[0].matching_offerings) {
      matchingOfferings = matchingQuery.rows[0].matching_offerings;
    }
    
    res.json({
      request: requestQuery.rows[0],
      matchingOfferings
    });
  } catch (error) {
    console.error('[REQUESTS] Error getting request by ID:', error);
    res.status(500).json({ message: 'Server error fetching request', error: error.message });
  }
};

/**
 * Create a new skill request
 */
exports.createRequest = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { skill_id, title, description, urgency, preferred_timeframe } = req.body;
    
    console.log(`[REQUESTS] Creating new skill request for user: ${userId}`);
    
    // Validate the skill exists
    const skillCheck = await pool.query(
      'SELECT * FROM skills WHERE skill_id = $1',
      [skill_id]
    );
    
    if (skillCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    // Create the request
    const requestResult = await pool.query(
      `INSERT INTO skill_requests (user_id, skill_id, title, description, urgency, preferred_timeframe)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, skill_id, title, description, urgency, preferred_timeframe]
    );
    
    // Get full request details for response
    const newRequestId = requestResult.rows[0].request_id;
    const requestQuery = await pool.query(
      `SELECT r.*, s.name AS skill_name, c.name AS category_name
       FROM skill_requests r
       JOIN skills s ON r.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE r.request_id = $1`,
      [newRequestId]
    );
    
    res.status(201).json({
      message: 'Skill request created successfully',
      request: requestQuery.rows[0]
    });
  } catch (error) {
    console.error('[REQUESTS] Error creating request:', error);
    res.status(500).json({ message: 'Server error creating request', error: error.message });
  }
};

/**
 * Update a skill request
 */
exports.updateRequest = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    const { title, description, urgency, preferred_timeframe, is_active } = req.body;
    
    console.log(`[REQUESTS] Updating skill request ${id} for user: ${userId}`);
    
    // Check if the request exists and belongs to the user
    const requestCheck = await pool.query(
      'SELECT * FROM skill_requests WHERE request_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Request not found or you do not have permission to update it' 
      });
    }
    
    // Update the request
    await pool.query(
      `UPDATE skill_requests 
       SET title = $1, description = $2, urgency = $3, preferred_timeframe = $4, is_active = $5
       WHERE request_id = $6`,
      [title, description, urgency, preferred_timeframe, is_active, id]
    );
    
    // Get updated request details
    const updatedRequestQuery = await pool.query(
      `SELECT r.*, s.name AS skill_name, c.name AS category_name
       FROM skill_requests r
       JOIN skills s ON r.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE r.request_id = $1`,
      [id]
    );
    
    res.json({
      message: 'Skill request updated successfully',
      request: updatedRequestQuery.rows[0]
    });
  } catch (error) {
    console.error('[REQUESTS] Error updating request:', error);
    res.status(500).json({ message: 'Server error updating request', error: error.message });
  }
};

/**
 * Delete a skill request
 */
exports.deleteRequest = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    
    console.log(`[REQUESTS] Deleting skill request ${id} for user: ${userId}`);
    
    // Check if the request exists and belongs to the user
    const requestCheck = await pool.query(
      'SELECT * FROM skill_requests WHERE request_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Request not found or you do not have permission to delete it' 
      });
    }
    
    // Check if the request is involved in any exchanges
    const exchangesCheck = await pool.query(
      'SELECT * FROM exchanges WHERE request_id = $1',
      [id]
    );
    
    if (exchangesCheck.rows.length > 0) {
      // Instead of deleting, mark as inactive
      await pool.query(
        'UPDATE skill_requests SET is_active = FALSE WHERE request_id = $1',
        [id]
      );
      
      return res.json({
        message: 'Skill request marked as inactive because it has associated exchanges',
        deactivated: true,
        request_id: id
      });
    }
    
    // Delete the request if no exchanges are associated
    await pool.query(
      'DELETE FROM skill_requests WHERE request_id = $1',
      [id]
    );
    
    res.json({
      message: 'Skill request deleted successfully',
      deleted: true,
      request_id: id
    });
  } catch (error) {
    console.error('[REQUESTS] Error deleting request:', error);
    res.status(500).json({ message: 'Server error deleting request', error: error.message });
  }
};