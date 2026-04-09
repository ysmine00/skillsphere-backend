const pool = require('../config/database');

/**
 * Get exchanges for authenticated user (as provider or requester)
 */
exports.getUserExchanges = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[EXCHANGES] Getting exchanges for user: ${userId}`);
    
    const exchangesQuery = await pool.query(
      `SELECT e.*, 
              po.title AS offering_title,
              po.description AS offering_description,
              po.mode AS offering_mode,
              po.availability AS offering_availability,
              s.name AS skill_name,
              c.name AS category_name,
              up.full_name AS provider_name,
              ur.full_name AS requester_name,
              CASE WHEN e.request_id IS NOT NULL THEN r.title ELSE NULL END AS request_title,
              CASE WHEN e.request_id IS NOT NULL THEN r.description ELSE NULL END AS request_description
       FROM exchanges e
       JOIN skill_offerings po ON e.offering_id = po.offering_id
       JOIN skills s ON po.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       JOIN user_profiles up ON e.provider_id = up.user_id
       JOIN user_profiles ur ON e.requester_id = ur.user_id
       LEFT JOIN skill_requests r ON e.request_id = r.request_id
       WHERE e.provider_id = $1 OR e.requester_id = $1
       ORDER BY 
         CASE 
           WHEN e.status = 'pending' THEN 1
           WHEN e.status = 'accepted' THEN 2
           WHEN e.status = 'completed' THEN 3
           ELSE 4
         END,
         e.updated_at DESC`,
      [userId]
    );
    
    res.json(exchangesQuery.rows);
  } catch (error) {
    console.error('[EXCHANGES] Error getting user exchanges:', error);
    res.status(500).json({ message: 'Server error fetching exchanges', error: error.message });
  }
};

/**
 * Get a single exchange by ID
 */
exports.getExchangeById = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    console.log(`[EXCHANGES] Getting exchange with ID: ${id}`);
    
    const exchangeQuery = await pool.query(
      `SELECT e.*, 
              po.title AS offering_title,
              po.description AS offering_description,
              po.mode AS offering_mode,
              po.availability AS offering_availability,
              s.name AS skill_name,
              c.name AS category_name,
              up.full_name AS provider_name,
              up.user_id AS provider_id,        -- This is from user_profiles
              u_provider.email AS provider_email, -- This is from users table for provider
              ur.full_name AS requester_name,
              ur.user_id AS requester_id,       -- This is from user_profiles
              u_requester.email AS requester_email, -- This is from users table for requester
              CASE WHEN e.request_id IS NOT NULL THEN r.title ELSE NULL END AS request_title,
              CASE WHEN e.request_id IS NOT NULL THEN r.description ELSE NULL END AS request_description,
              CASE WHEN e.request_id IS NOT NULL THEN r.urgency ELSE NULL END AS request_urgency,
              CASE WHEN e.request_id IS NOT NULL THEN r.preferred_timeframe ELSE NULL END AS request_timeframe
       FROM exchanges e
       JOIN skill_offerings po ON e.offering_id = po.offering_id
       JOIN skills s ON po.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       JOIN user_profiles up ON e.provider_id = up.user_id
       JOIN users u_provider ON up.user_id = u_provider.user_id -- Join for provider's email
       JOIN user_profiles ur ON e.requester_id = ur.user_id
       JOIN users u_requester ON ur.user_id = u_requester.user_id -- Join for requester's email
       LEFT JOIN skill_requests r ON e.request_id = r.request_id
       WHERE e.exchange_id = $1 AND (e.provider_id = $2 OR e.requester_id = $2)`,
      [id, userId]
    );
    
    if (exchangeQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Exchange not found or you do not have permission to view it' });
    }
    
    res.json(exchangeQuery.rows[0]);
  } catch (error) {
    console.error('[EXCHANGES] Error getting exchange by ID:', error);
    res.status(500).json({ message: 'Server error fetching exchange', error: error.message });
  }
};

/**
 * Create a new exchange
 */
exports.createExchange = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { offering_id, request_id } = req.body;
    
    console.log(`[EXCHANGES] Creating new exchange for user: ${userId}`);
    
    // Verify the offering exists
    const offeringQuery = await pool.query(
      'SELECT * FROM skill_offerings WHERE offering_id = $1',
      [offering_id]
    );
    
    if (offeringQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Offering not found' });
    }
    
    const offering = offeringQuery.rows[0];
    const providerId = offering.user_id;
    
    // If provider is trying to create an exchange, they need to specify a requester
    if (providerId === userId) {
      return res.status(400).json({ message: 'Providers cannot create exchanges with their own offerings' });
    }
    
    // If request_id is provided, verify it exists and belongs to the user
    if (request_id) {
      const requestQuery = await pool.query(
        'SELECT * FROM skill_requests WHERE request_id = $1',
        [request_id]
      );
      
      if (requestQuery.rows.length === 0) {
        return res.status(404).json({ message: 'Request not found' });
      }
      
      const request = requestQuery.rows[0];
      
      // Ensure the user creating the exchange is the requester
      if (request.user_id !== userId) {
        return res.status(403).json({ message: 'You can only include your own requests in an exchange' });
      }
    }
    
    // Create the exchange
    const exchangeResult = await pool.query(
      `INSERT INTO exchanges (provider_id, requester_id, offering_id, request_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING exchange_id`,
      [providerId, userId, offering_id, request_id || null]
    );
    
    // Get the new exchange details
    const newExchangeId = exchangeResult.rows[0].exchange_id;
    const newExchangeDetailsQuery = await pool.query( // Renamed variable to avoid conflict
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
       WHERE e.exchange_id = $1`,
      [newExchangeId]
    );
    
    res.status(201).json({
      message: 'Exchange created successfully',
      exchange: newExchangeDetailsQuery.rows[0] // Use the renamed variable
    });
  } catch (error) {
    console.error('[EXCHANGES] Error creating exchange:', error);
    res.status(500).json({ message: 'Server error creating exchange', error: error.message });
  }
};

/**
 * Update exchange status
 */
// In exchangesController.js - updateExchangeStatus function

exports.updateExchangeStatus = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`[EXCHANGES] Updating status for exchange ${id} to ${status}`);
    
    // Validate status
    const validStatuses = ['pending', 'accepted', 'completed', 'canceled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Check if the exchange exists and user is involved
    const exchangeCheck = await pool.query(
      `SELECT e.*, 
              up.full_name AS provider_name,
              u_provider.email AS provider_email, 
              ur.full_name AS requester_name,
              u_requester.email AS requester_email
       FROM exchanges e
       JOIN user_profiles up ON e.provider_id = up.user_id
       JOIN users u_provider ON up.user_id = u_provider.user_id
       JOIN user_profiles ur ON e.requester_id = ur.user_id
       JOIN users u_requester ON ur.user_id = u_requester.user_id
       WHERE e.exchange_id = $1 AND (e.provider_id = $2 OR e.requester_id = $2)`,
      [id, userId]
    );
    
    if (exchangeCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Exchange not found or you do not have permission to update it' 
      });
    }
    
    const exchange = exchangeCheck.rows[0];
    
    // Apply status update logic
    if (status === 'accepted' && exchange.status === 'pending') {
      // Only the provider can accept an exchange
      if (exchange.provider_id !== userId) {
        return res.status(403).json({ message: 'Only the provider can accept an exchange' });
      }
    } else if (status === 'completed' && exchange.status === 'accepted') {
      // Only the requester can mark an exchange as completed
      if (exchange.requester_id !== userId) {
        return res.status(403).json({ message: 'Only the requester can mark an exchange as completed' });
      }
    } else if (status === 'canceled') {
      // Both provider and requester can cancel an exchange
      if (exchange.provider_id !== userId && exchange.requester_id !== userId) {
        return res.status(403).json({ message: 'You do not have permission to cancel this exchange' });
      }
    } else if (status === 'pending' && exchange.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot revert an exchange back to pending status' });
    }
    
    // Update the exchange status
    await pool.query(
      'UPDATE exchanges SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE exchange_id = $2',
      [status, id]
    );
    
    // Get the updated exchange
    const updatedExchangeQuery = await pool.query(
      `SELECT e.*, 
              po.title AS offering_title,
              s.name AS skill_name,
              up.full_name AS provider_name,
              u_provider.email AS provider_email,
              ur.full_name AS requester_name,
              u_requester.email AS requester_email
       FROM exchanges e
       JOIN skill_offerings po ON e.offering_id = po.offering_id
       JOIN skills s ON po.skill_id = s.skill_id
       JOIN user_profiles up ON e.provider_id = up.user_id
       JOIN users u_provider ON up.user_id = u_provider.user_id
       JOIN user_profiles ur ON e.requester_id = ur.user_id
       JOIN users u_requester ON ur.user_id = u_requester.user_id
       WHERE e.exchange_id = $1`,
      [id]
    );
    
    const updatedExchange = updatedExchangeQuery.rows[0];
    
    // Send notification email
    if (status === 'canceled') {
      const canceledBy = userId === exchange.provider_id ? "provider" : "requester";
      
      // Determine recipient based on who canceled
      const recipientEmail = canceledBy === "provider" 
        ? updatedExchange.requester_email 
        : updatedExchange.provider_email;
      
      const recipientName = canceledBy === "provider" 
        ? updatedExchange.requester_name 
        : updatedExchange.provider_name;
        
      // Log to verify emails are correctly retrieved
      console.log(`[EXCHANGES] Sending cancellation email to ${recipientName} (${recipientEmail})`);
    
      // Only attempt to send if recipientEmail is defined
      if (recipientEmail) {
        // Your email sending code here
      } else {
        console.error(`[EXCHANGES] Error: Unable to send email - recipient email is undefined`);
      }
    }
    
    res.json({
      message: `Exchange status updated to ${status}`,
      exchange: updatedExchange
    });
  } catch (error) {
    console.error('[EXCHANGES] Error updating exchange status:', error);
    res.status(500).json({ message: 'Server error updating exchange status', error: error.message });
  }
};

/**
 * Delete an exchange
 */
exports.deleteExchange = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { id } = req.params;
    
    console.log(`[EXCHANGES] Deleting exchange ${id}`);
    
    // Check if the exchange exists and user is involved
    const exchangeCheck = await pool.query(
      'SELECT * FROM exchanges WHERE exchange_id = $1 AND (provider_id = $2 OR requester_id = $2)',
      [id, userId]
    );
    
    if (exchangeCheck.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Exchange not found or you do not have permission to delete it' 
      });
    }
    
    const exchange = exchangeCheck.rows[0];
    
    // Only allow deletion of pending exchanges
    if (exchange.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Only pending exchanges can be deleted. Consider canceling instead.' 
      });
    }
    
    // Delete the exchange
    await pool.query(
      'DELETE FROM exchanges WHERE exchange_id = $1',
      [id]
    );
    
    res.json({
      message: 'Exchange deleted successfully',
      exchange_id: id
    });
  } catch (error) {
    console.error('[EXCHANGES] Error deleting exchange:', error);
    res.status(500).json({ message: 'Server error deleting exchange', error: error.message });
  }
};