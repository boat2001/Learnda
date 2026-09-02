// src/routes/contribution.js
const express = require('express');
const router = express.Router();
const { upload } = require('../config/upload');
const { authenticate, checkRole } = require('../middleware/auth');
const { requirePlanFeature, enforceContributionLimit } = require('../middleware/planAccess');
const contributionController = require('../controllers/contributionController');

// Student/Contributor submit
router.post(
  '/',
  authenticate,
  requirePlanFeature('contributions'),
  enforceContributionLimit,
  upload.single('file'),
  contributionController.create
);

router.get('/mine', authenticate, contributionController.getMine);

// Admin moderation
router.get(
  '/',
  authenticate,
  checkRole(['admin']),
  contributionController.list
);

router.post(
  '/:id/approve',
  authenticate,
  checkRole(['admin']),
  contributionController.approve
);

router.post(
  '/:id/reject',
  authenticate,
  checkRole(['admin']),
  contributionController.reject
);

module.exports = router;
