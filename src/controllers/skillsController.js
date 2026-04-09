const pool = require('../config/database');

/**
 * Get all available skills grouped by category
 */
exports.getAllSkills = async (req, res) => {
  try {
    console.log(`[SKILLS] Getting all available skills`);
    
    const skillsQuery = await pool.query(
      `SELECT s.skill_id, s.name AS skill_name, s.description, 
              c.category_id, c.name AS category_name
       FROM skills s
       JOIN categories c ON s.category_id = c.category_id
       ORDER BY c.name, s.name`
    );

    // Group skills by category
    const skillsByCategory = skillsQuery.rows.reduce((acc, skill) => {
      const category = skill.category_name;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        skill_id: skill.skill_id,
        name: skill.skill_name,
        description: skill.description
      });
      return acc;
    }, {});

    res.json(skillsByCategory);
  } catch (error) {
    console.error('[SKILLS] Error getting skills:', error);
    res.status(500).json({ message: 'Server error fetching skills', error: error.message });
  }
};

/**
 * Get user's skills
 */
exports.getUserSkills = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`[SKILLS] Getting skills for user: ${userId}`);
    
    const userSkillsQuery = await pool.query(
      `SELECT us.user_skill_id, us.skill_id, us.proficiency_level, us.notes,
              s.name AS skill_name, s.description,
              c.category_id, c.name AS category_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE us.user_id = $1
       ORDER BY c.name, s.name`,
      [userId]
    );

    res.json(userSkillsQuery.rows);
  } catch (error) {
    console.error('[SKILLS] Error getting user skills:', error);
    res.status(500).json({ message: 'Server error fetching user skills', error: error.message });
  }
};

/**
 * Add skill to user profile
 */
exports.addUserSkill = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { skill_id, proficiency_level, notes } = req.body;
    
    console.log(`[SKILLS] Adding skill ${skill_id} to user ${userId}`);
    
    // Check if skill exists
    const skillQuery = await pool.query(
      'SELECT * FROM skills WHERE skill_id = $1',
      [skill_id]
    );
    
    if (skillQuery.rows.length === 0) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    // Check if user already has this skill
    const existingSkillQuery = await pool.query(
      'SELECT * FROM user_skills WHERE user_id = $1 AND skill_id = $2',
      [userId, skill_id]
    );
    
    if (existingSkillQuery.rows.length > 0) {
      return res.status(409).json({ message: 'User already has this skill' });
    }
    
    // Add skill to user profile
    const insertResult = await pool.query(
      `INSERT INTO user_skills (user_id, skill_id, proficiency_level, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING user_skill_id`,
      [userId, skill_id, proficiency_level, notes]
    );
    
    // Get detailed skill info for response
    const newSkillQuery = await pool.query(
      `SELECT us.user_skill_id, us.skill_id, us.proficiency_level, us.notes,
              s.name AS skill_name, s.description,
              c.category_id, c.name AS category_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE us.user_skill_id = $1`,
      [insertResult.rows[0].user_skill_id]
    );
    
    res.status(201).json({
      message: 'Skill added successfully',
      skill: newSkillQuery.rows[0]
    });
  } catch (error) {
    console.error('[SKILLS] Error adding user skill:', error);
    res.status(500).json({ message: 'Server error adding skill', error: error.message });
  }
};

/**
 * Update user skill
 */
exports.updateUserSkill = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { user_skill_id } = req.params;
    const { proficiency_level, notes } = req.body;
    
    console.log(`[SKILLS] Updating user skill ${user_skill_id} for user ${userId}`);
    
    // Check if this skill belongs to the user
    const userSkillQuery = await pool.query(
      'SELECT * FROM user_skills WHERE user_skill_id = $1 AND user_id = $2',
      [user_skill_id, userId]
    );
    
    if (userSkillQuery.rows.length === 0) {
      return res.status(404).json({ message: 'User skill not found' });
    }
    
    // Update the skill - REMOVING THE UPDATED_AT REFERENCE
    await pool.query(
      `UPDATE user_skills 
       SET proficiency_level = $1, notes = $2
       WHERE user_skill_id = $3`,
      [proficiency_level, notes, user_skill_id]
    );
    
    // Get updated skill info
    const updatedSkillQuery = await pool.query(
      `SELECT us.user_skill_id, us.skill_id, us.proficiency_level, us.notes,
              s.name AS skill_name, s.description,
              c.category_id, c.name AS category_name
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.skill_id
       JOIN categories c ON s.category_id = c.category_id
       WHERE us.user_skill_id = $1`,
      [user_skill_id]
    );
    
    res.json({
      message: 'Skill updated successfully',
      skill: updatedSkillQuery.rows[0]
    });
  } catch (error) {
    console.error('[SKILLS] Error updating user skill:', error);
    res.status(500).json({ message: 'Server error updating skill', error: error.message });
  }
};

/**
 * Remove skill from user profile
 */
exports.removeUserSkill = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { user_skill_id } = req.params;
    
    console.log(`[SKILLS] Removing user skill ${user_skill_id} from user ${userId}`);
    
    // Check if this skill belongs to the user
    const userSkillQuery = await pool.query(
      'SELECT * FROM user_skills WHERE user_skill_id = $1 AND user_id = $2',
      [user_skill_id, userId]
    );
    
    if (userSkillQuery.rows.length === 0) {
      return res.status(404).json({ message: 'User skill not found' });
    }
    
    // Remove the skill
    await pool.query(
      'DELETE FROM user_skills WHERE user_skill_id = $1',
      [user_skill_id]
    );
    
    res.json({
      message: 'Skill removed successfully',
      user_skill_id
    });
  } catch (error) {
    console.error('[SKILLS] Error removing user skill:', error);
    res.status(500).json({ message: 'Server error removing skill', error: error.message });
  }
};

/**
 * Get all categories
 */
exports.getCategories = async (req, res) => {
  try {
    console.log(`[SKILLS] Getting all categories`);
    
    const categoriesQuery = await pool.query(
      'SELECT category_id, name, description FROM categories ORDER BY name'
    );
    
    res.json(categoriesQuery.rows);
  } catch (error) {
    console.error('[SKILLS] Error getting categories:', error);
    res.status(500).json({ message: 'Server error fetching categories', error: error.message });
  }
};