const pool = require('../config/database');

/**
 * Get all skill offerings
 */
exports.getAllOfferings = async (req, res) => {
  try {
    console.log(`[OFFERINGS] Getting all skill offerings`);
    
    const { category, skill, mode } = req.query;
    
    // Build the WHERE clause dynamically based on filters
    let query = `
      SELECT o.*, s.name AS skill_name, c.name AS category_name, 
             p.full_name AS provider_name, p.user_id AS provider_id
      FROM skill_offerings o
      JOIN skills s ON o.skill_id = s.skill_id
      JOIN categories c ON s.category_id = c.category_id
      JOIN user_profiles p ON o.user_id = p.user_id
      WHERE o.is_active = TRUE
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
    
    // Add mode filter if provided
    if (mode) {
      queryParams.push(mode);
      query += ` AND o.mode = $${queryParams.length}`;
    }
    
    query += ` ORDER BY o.created_at DESC`;
    
    const offeringsQuery = await pool.query(query, queryParams);
    
    res.json(offeringsQuery.rows);
  } catch (error) {
    console.error('[OFFERINGS] Error getting offerings:', error);
    res.status(500).json({ message: 'Server error fetching offerings', error: error.message });
  }
};

/**
 * Get user's skill offerings
 */
exports.getUserOfferings = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[OFFERINGS] Getting skill offerings for user: ${userId}`);
    
    const offeringsQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );
    
    res.json(offeringsQuery.rows);
  } catch (error) {
    console.error('[OFFERINGS] Error getting user offerings:', error);
    res.status(500).json({ message: 'Server error fetching user offerings', error: error.message });
  }
};

/**
 * Get a single skill offering by ID
 */
exports.getOfferingById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[OFFERINGS] Getting skill offering with ID: ${id}`);
    
    const offeringQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name, 
              p.full_name AS provider_name, p.user_id AS provider_id
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       JOIN user_profiles p ON o.user_id = p.user_id
       WHERE o.offering_id = $1`,
      [id]
    );
    
    if (offeringQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Offering not found' });
    }
    
    res.json(offeringQuery.rows[0]);
  } catch (error) {
    console.error('[OFFERINGS] Error getting offering by ID:', error);
    res.status(500).json({ message: 'Server error fetching offering', error: error.message });
  }
};

/**
 * Create a new skill offering
 */
exports.createOffering = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { skill_id, title, description, mode, availability } = req.body;
    
    console.log(`[OFFERINGS] Creating new skill offering for user: ${userId}`);
    
    // Validate the skill exists
    const skillCheck = await pool.query(
      'SELECT * FROM skills WHERE skill_id = $1',
      [skill_id]
    );
    
    if (skillCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    // Create the offering
    const offeringResult = await pool.query(
      `INSERT INTO skill_offerings (user_id, skill_id, title, description, mode, availability)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, skill_id, title, description, mode, availability]
    );
    
    // Get full offering details for response
    const newOfferingId = offeringResult.rows[0].offering_id;
    const offeringQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE o.offering_id = $1`,
      [newOfferingId]
    );
    
    res.status(201).json({
      message: 'Skill offering created successfully',
      offering: offeringQuery.rows[0]
    });
  } catch (error) {
    console.error('[OFFERINGS] Error creating offering:', error);
    res.status(500).json({ message: 'Server error creating offering', error: error.message });
  }
};

/**
 * Update a skill offering
 */
exports.updateOffering = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    const { title, description, mode, availability, is_active = true } = req.body;
    
    console.log(`[OFFERINGS] Updating skill offering ${id} for user: ${userId}`);
    
    // Check if the offering exists and belongs to the user
    const offeringCheck = await pool.query(
      'SELECT * FROM skill_offerings WHERE offering_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (offeringCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Offering not found or you do not have permission to update it' 
      });
    }
    
    // Get the original offering to preserve skill_id
    const originalOffering = offeringCheck.rows[0];
    
    // Update the offering
    await pool.query(
      `UPDATE skill_offerings 
       SET title = $1, description = $2, mode = $3, availability = $4, is_active = $5
       WHERE offering_id = $6`,
      [title, description, mode, availability, is_active, id]
    );
    
    // Get updated offering details
    const updatedOfferingQuery = await pool.query(
      `SELECT o.*, s.name AS skill_name, c.name AS category_name
       FROM skill_offerings o
       JOIN skills s ON o.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE o.offering_id = $1`,
      [id]
    );
    
    res.json({
      message: 'Skill offering updated successfully',
      offering: updatedOfferingQuery.rows[0]
    });
  } catch (error) {
    console.error('[OFFERINGS] Error updating offering:', error);
    res.status(500).json({ message: 'Server error updating offering', error: error.message });
  }
};

/**
 * Delete a skill offering
 */
exports.deleteOffering = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    
    console.log(`[OFFERINGS] Deleting skill offering ${id} for user: ${userId}`);
    
    // Check if the offering exists and belongs to the user
    const offeringCheck = await pool.query(
      'SELECT * FROM skill_offerings WHERE offering_id = $1 AND user_id = $2',
      [id, userId]
    );
    
    if (offeringCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Offering not found or you do not have permission to delete it' 
      });
    }
    
    // Check if the offering is involved in any exchanges
    const exchangesCheck = await pool.query(
      'SELECT * FROM exchanges WHERE offering_id = $1',
      [id]
    );
    
    if (exchangesCheck.rows.length > 0) {
      // Instead of deleting, mark as inactive
      await pool.query(
        'UPDATE skill_offerings SET is_active = FALSE WHERE offering_id = $1',
        [id]
      );
      
      return res.json({
        message: 'Skill offering marked as inactive because it has associated exchanges',
        deactivated: true,
        offering_id: id
      });
    }
    
    // Delete the offering if no exchanges are associated
    await pool.query(
      'DELETE FROM skill_offerings WHERE offering_id = $1',
      [id]
    );
    
    res.json({
      message: 'Skill offering deleted successfully',
      deleted: true,
      offering_id: id
    });
  } catch (error) {
    console.error('[OFFERINGS] Error deleting offering:', error);
    res.status(500).json({ message: 'Server error deleting offering', error: error.message });
  }
};