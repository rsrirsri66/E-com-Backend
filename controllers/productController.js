const pool = require('../config/database');

const getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imgsrc } = req.body;
  try {
    const result = await pool.query('UPDATE products SET name = $1, description = $2, price = $3, imgsrc = $4 WHERE id = $5 RETURNING *', [name, description, price, imgsrc, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllProducts, updateProduct, deleteProduct };
