// src/routes/subscription.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');
const { subscriptionLimiter } = require('../middleware/rateLimiter');

router.get('/plans', subscriptionController.getPlans);
router.get('/current', authenticate, subscriptionController.getCurrent);
router.get('/invoices', authenticate, subscriptionController.getInvoices);
router.get('/payment-methods', authenticate, subscriptionController.getPaymentMethods);
router.post('/payment-methods', authenticate, subscriptionController.addPaymentMethod);
router.delete('/payment-methods/:id', authenticate, subscriptionController.removePaymentMethod);

// Stubs for MVP (can be implemented with payments later)
router.post('/subscribe', authenticate, subscriptionLimiter, subscriptionController.subscribe);
router.post('/cancel', authenticate, subscriptionLimiter, subscriptionController.cancel);
router.post('/upgrade', authenticate, subscriptionLimiter, subscriptionController.upgrade);

module.exports = router;
