const pool = require('../config/database');

const addToCart = async (req, res) => {
  const { product_id, name, description, price, imgsrc } = req.body;
  const user_id = req.user.id; // Get user_id from token

  try {
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    const result = await pool.query('INSERT INTO cart (product_id, name, description, price, imgsrc, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [product_id, name, description, price, imgsrc, user_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const fetchCartItems = async (req, res) => {
  const user_id = req.user.id; // Get user_id from token
  try {
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [user_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeFromCart = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id; // Get user_id from token
  try {
    const result = await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2 RETURNING *', [id, user_id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found or not authorized' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { addToCart, fetchCartItems, removeFromCart };
