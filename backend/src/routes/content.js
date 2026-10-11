// src/routes/content.js
const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth, checkRole } = require('../middleware/auth');
const { requirePlanFeature, enforceContributionLimit } = require('../middleware/planAccess');
const { upload } = require('../config/upload');
const contentController = require('../controllers/contentController');
const { academicContentAccess } = require('../middleware/academicContentAccess');
router.param('id', (req, res, next) => optionalAuth(req, res, () => academicContentAccess(req, res, next).catch(next)));

// Public feeds
router.get('/', optionalAuth, contentController.list);
router.get('/featured', optionalAuth, contentController.featured);
router.get('/trending', optionalAuth, contentController.trending);
router.get('/search', optionalAuth, contentController.search);
router.get('/favorites', optionalAuth, contentController.favorites);

// Auth-only feeds
router.get('/personalized/:userId', authenticate, requirePlanFeature('personalization'), contentController.personalized);

// Creator/Admin management
router.get('/my-content', authenticate, contentController.myContent);
router.post('/', authenticate, checkRole(['admin']), contentController.create);
router.post(
  '/upload',
  authenticate,
  requirePlanFeature('contributions'),
  enforceContributionLimit,
  upload.single('file'),
  contentController.upload
);
router.get('/admin/edutainment/preview', authenticate, checkRole(['admin']), contentController.previewEdutainmentParser);

// Single content (keep AFTER fixed routes)
router.get('/:id/share-card', optionalAuth, contentController.shareCard);
router.get('/:id', optionalAuth, contentController.getById);

// Interactions
router.post('/:id/like', authenticate, contentController.like);
router.post('/:id/share', authenticate, contentController.share);
router.post('/:id/save', authenticate, contentController.save);
router.post('/:id/complete', authenticate, contentController.complete);
router.post('/:id/track-view', optionalAuth, contentController.trackView);
router.post('/:id/react', authenticate, contentController.react);
router.get('/:id/interactions', authenticate, contentController.interactions);
router.get('/:id/stats', optionalAuth, contentController.getStats);

// Comments
router.get('/:id/comments', optionalAuth, contentController.getComments);
router.post('/:id/comments', authenticate, requirePlanFeature('commenting'), contentController.addComment);

// Update/Delete
router.put('/:id', authenticate, contentController.update);
router.delete('/:id', authenticate, contentController.remove);

module.exports = router;
