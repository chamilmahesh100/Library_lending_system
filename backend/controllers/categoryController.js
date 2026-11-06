const { pool } = require('../config/database');
const logger = require('../config/logger');

const getAllCategories = async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM categories ORDER BY name ASC'
    );

    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    logger.error('Get all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories'
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
      [name.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description ? description.trim() : null]
    );

    const [categories] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [result.insertId]
    );

    logger.info(`Category created by admin ${req.user.id}: ${name.trim()}`);

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: categories[0] }
    });
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating category'
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [existingCategories] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (existingCategories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const normalizedName = name ? name.trim() : existingCategories[0].name;
    const normalizedDescription = description !== undefined ? description.trim() : existingCategories[0].description;

    const [duplicate] = await pool.execute(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?',
      [normalizedName, id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists'
      });
    }

    await pool.execute(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [normalizedName, normalizedDescription, id]
    );

    const [updatedCategories] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    logger.info(`Category updated by admin ${req.user.id}: Category ID ${id}`);

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategories[0] }
    });
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating category'
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [categories] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const [books] = await pool.execute(
      'SELECT COUNT(*) as count FROM books WHERE category_id = ?',
      [id]
    );

    if (books[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be deleted because books are assigned to it'
      });
    }

    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

    logger.info(`Category deleted by admin ${req.user.id}: Category ID ${id}`);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting category'
    });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
