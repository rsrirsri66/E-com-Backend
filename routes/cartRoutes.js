const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authenticateToken = require('../middlewares/authenticateToken');

router.post('/cart', authenticateToken, cartController.addToCart);
router.get('/carts', authenticateToken, cartController.fetchCartItems);
router.delete('/:id', authenticateToken, cartController.removeFromCart);

module.exports = router;
