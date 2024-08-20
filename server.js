const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const session = require('express-session');
const bcrypt = require('bcrypt');

const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const app = express();
const port = 5000;

// PostgreSQL client setup
// const pool = new Pool({
//   user: 'postgres',
//   host: 'localhost',
//   database: 'Ecommerce',
//   password: 'sridharan',
//   port: 5432,
// });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));

app.use(cors());
app.use(bodyParser.json());
// Register route
// Register route
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    // Check if the username or email already exists
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (userResult.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, email) VALUES ($1, $2, $3)',
      [username, hashedPassword, email]
    );
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during user registration:', err);
    res.status(500).json({ error: 'User registration failed', details: err.message });
  }
});


// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Query the database for the user
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    // Check if user exists and password matches
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, role: user.role }); 
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});


// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  console.log("Token:", token); // Debugging line

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Error:", err); // Debugging line
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};



app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: `Hello User ${req.user.id}` });
});
// Get all products
app.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a product
app.post('/products', async (req, res) => {
  const { name, description, price, imgsrc } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, imgsrc) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, price, imgsrc]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a product
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, imgsrc } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET name = $1, description = $2, price = $3, imgsrc = $4 WHERE id = $5 RETURNING *',
      [name, description, price, imgsrc, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add to cart
app.post('/cart', authenticateToken, async (req, res) => {
  const { product_id, name, description, price, imgsrc } = req.body;
  const user_id = req.user.id; // Get user_id from token

  try {
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }
    const result = await pool.query(
      'INSERT INTO cart (product_id, name, description, price, imgsrc, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [product_id, name, description, price, imgsrc, user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch cart items
app.get('/cart', authenticateToken, async (req, res) => {
  const user_id = req.user.id; // Get user_id from token
  try {
    const result = await pool.query('SELECT * FROM cart WHERE user_id = $1', [user_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from cart
app.delete('/cart/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id; // Get user_id from token
  try {
    // Ensure the item being deleted belongs to the user
    const result = await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2 RETURNING *', [id, user_id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found or not authorized' });
    }
    
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/create-order', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  const user_id = req.user.id;

  try {
    // Create an order in Razorpay
    const order = await razorpay.orders.create({
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      receipt:` order_rcptid_${new Date().getTime()}`
    });

    const result = await pool.query(
      'INSERT INTO orders (user_id, amount, currency, razorpay_order_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, amount, 'INR', order.id, 'pending']
    );

    res.json({
      orderId: order.id,
      amount: result.rows[0].amount,
      currency: result.rows[0].currency
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

app.post('/verify-payment', async (req, res) => {
  const { paymentId, orderId, signature } = req.body;
  const crypto = require('crypto');
  const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                   .update(`${orderId}|${paymentId}`)
                                   .digest('hex');
  
  if (generatedSignature === signature) {
    try {
      // Update the order status and payment details
      await pool.query(
        'UPDATE orders SET razorpay_payment_id = $1, razorpay_signature = $2, status = $3 WHERE razorpay_order_id = $4',
        [paymentId, signature, 'completed', orderId]
      );
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(400).json({ error: 'Invalid signature' });
  }
});

  // Endpoint to store orders
app.post('/store-order', authenticateToken, async (req, res) => {
  const { cartItems, orderDetails } = req.body;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      'INSERT INTO orders (user_id, amount, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, orderDetails.amount, orderDetails.currency, orderDetails.razorpay_order_id, orderDetails.razorpay_payment_id, orderDetails.razorpay_signature, 'completed']
    );

    // Insert order items into order_items table
    for (const item of cartItems) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, name, description, price, imgsrc) VALUES ($1, $2, $3, $4, $5, $6)',
        [result.rows[0].id, item.product_id, item.name, item.description, item.price, item.imgsrc]
      );
    }

    res.status(201).json({ message: 'Order stored successfully' });
  } catch (err) {
    console.error('Error storing order:', err);
    res.status(500).json({ error: 'Failed to store order', details: err.message });
  }
});

  

// Endpoint to get order history
app.get('/order-history', authenticateToken, async (req, res) => {
  const user_id = req.user.id; // Assuming you get user_id from the token

  try {
      const result = await pool.query(
          `SELECT o.id AS order_id, o.amount, o.currency, o.status, o.created_at, 
                  oi.product_id, oi.name, oi.description, oi.price, oi.imgsrc 
           FROM orders o 
           JOIN order_items oi ON o.id = oi.order_id
           WHERE o.user_id = $1
           ORDER BY o.created_at DESC`, [user_id]
      );

      const orders = result.rows.reduce((acc, row) => {
          let order = acc.find(o => o.order_id === row.order_id);
          if (!order) {
              order = {
                  order_id: row.order_id,
                  amount: row.amount,
                  currency: row.currency,
                  status: row.status,
                  created_at: row.created_at,
                  items: []
              };
              acc.push(order);
          }
          order.items.push({
              product_id: row.product_id,
              name: row.name,
              description: row.description,
              price: row.price,
              imgsrc: row.imgsrc
          });
          return acc;
      }, []);

      res.json(orders);
  } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
  }
});






app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});