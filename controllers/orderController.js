const pool = require('../config/database');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = async (req, res) => {
  const { amount } = req.body;
  try {
    const options = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Math.random().toString(36).substring(7)}`,
    };
    const order = await razorpay.orders.create(options);
    const result = await pool.query('INSERT INTO orders (amount, currency, razorpay_order_id, status) VALUES ($1, $2, $3, $4) RETURNING *', [amount, options.currency, order.id, 'pending']);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      orderDetails: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const verifyPayment = async (req, res) => {
  const { paymentId, orderId, signature } = req.body;
  const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                   .update(`${orderId}|${paymentId}`)
                                   .digest('hex');

  if (generatedSignature === signature) {
    try {
      await pool.query('UPDATE orders SET razorpay_payment_id = $1, razorpay_signature = $2, status = $3 WHERE razorpay_order_id = $4', [paymentId, signature, 'completed', orderId]);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(400).json({ error: 'Invalid signature' });
  }
};

const storeOrder = async (req, res) => {
  const user_id = req.user.id; // Get user_id from token
  const { cartItems, orderDetails } = req.body;

  try {
    const newOrder = await pool.query('INSERT INTO orders (amount, currency, razorpay_order_id, razorpay_payment_id, razorpay_signature, status, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [orderDetails.amount, orderDetails.currency, orderDetails.razorpay_order_id, orderDetails.razorpay_payment_id, orderDetails.razorpay_signature, 'completed', user_id]);

    const orderId = newOrder.rows[0].id;
    for (const item of cartItems) {
      await pool.query('INSERT INTO order_items (order_id, product_id, name, description, price, imgsrc) VALUES ($1, $2, $3, $4, $5, $6)', [orderId, item.product_id, item.name, item.description, item.price, item.imgsrc]);
    }

    await pool.query('DELETE FROM cart WHERE user_id = $1', [user_id]); // Clear cart after order

    res.json({ success: true, orderId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { createOrder, verifyPayment, storeOrder };
