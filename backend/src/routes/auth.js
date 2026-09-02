// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authLimiter, visitorLimiter } = require('../middleware/rateLimiter');
const { upload, handleUploadError } = require('../config/upload');

// Visitor routes (no auth required)
router.post('/visitor/register', visitorLimiter, authController.registerVisitor);

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/register/resend-otp', authLimiter, authController.resendRegisterOtp);
router.post('/register/check-otp', authLimiter, authController.checkRegisterOtp);
router.post('/register/verify-otp', authLimiter, authController.verifyRegisterOtp);
router.get('/register/academic-catalog', authLimiter, authController.getRegistrationAcademicCatalog);
router.get('/register/session', authLimiter, authController.getRegistrationSession);
router.post('/register/avatar', authLimiter, upload.single('avatar'), handleUploadError, authController.uploadRegistrationAvatar);
router.post('/register/profile', authLimiter, authController.updateRegistrationProfile);
router.post('/register/select-plan', authLimiter, authController.selectRegistrationPlan);
router.post('/register/checkout', authLimiter, authController.checkoutRegistrationPlan);
router.post('/register/verify-payment', authLimiter, authController.verifyRegistrationPayment);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/forgot-password/otp', authLimiter, authController.forgotPasswordOtp);
router.post('/reset-password/otp', authLimiter, authController.resetPasswordWithOtp);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/logout', authenticate, authController.logout);

// Optional auth routes
router.get('/session', optionalAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user || null,
    isAuthenticated: !!req.user
  });
});

module.exports = router;
