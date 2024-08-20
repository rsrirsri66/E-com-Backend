const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticateToken = require('../middlewares/authenticateToken');

router.post('/create', authenticateToken, orderController.createOrder);
router.post('/verify', authenticateToken, orderController.verifyPayment);
router.post('/store', authenticateToken, orderController.storeOrder);

module.exports = router;
