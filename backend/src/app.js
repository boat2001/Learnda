const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const config = require('./config/env');
const logger = require('./config/logger');
const { connectAndSync } = require('./models');

// Routes
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const subscriptionRoutes = require('./routes/subscription');
const contributionRoutes = require('./routes/contribution');
const analyticsRoutes = require('./routes/analytics');
const paymentRoutes = require('./routes/payment');
const gptRoutes = require('./routes/gpt');
const revenueRoutes = require('./routes/revenue');
const coursesRoutes = require('./routes/courses');
const plsRoutes = require('./routes/pls');
const studyGroupsRoutes = require('./routes/studyGroups');
const gamificationRoutes = require('./routes/gamification');
const adminRoutes = require('./routes/admin');
const newsletterRoutes = require('./routes/newsletter');
const supportRoutes = require('./routes/support');
const notificationsRoutes = require('./routes/notifications');
const rewardsRoutes = require('./routes/rewards');
const communityRoutes = require('./routes/community');
const resourcesRoutes = require('./routes/resources');
const applicationsRoutes = require('./routes/applications');
const blogRoutes = require('./routes/blog');
const userRoutes = require('./routes/user');
const meRoutes = require('./routes/me');
const billingRoutes = require('./routes/billing');
const commentsRoutes = require('./routes/comments');
const siteContentRoutes = require('./routes/siteContent');
const publicConfigRoutes = require('./routes/publicConfig');
const cronRoutes = require('./routes/cron');
const contentController = require('./controllers/contentController');
const { optionalAuth } = require('./middleware/auth');
const { uploadDir } = require('./config/upload');

const app = express();
let initializationPromise = null;

// Trust proxy for deployments behind reverse proxies (Render/Fly/Nginx)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());
const normalizeOrigin = (origin) => (origin ? origin.replace(/\/$/, '') : origin);
const corsOrigins = (config.corsOrigin || '')
  .split(',')
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);

if (config.startup.logIncomingOrigin) {
  app.use((req, res, next) => {
    logger.info(`Incoming Origin: ${req.headers.origin}`);
    next();
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (corsOrigins.includes('*')) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (corsOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Static: uploaded files
const r2PublicBase = String(process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
app.use('/uploads', express.static(uploadDir));
if (r2PublicBase) {
  app.use('/uploads', (req, res) => {
    const normalizedPath = String(req.path || '').replace(/^\/+/, '');
    return res.redirect(`${r2PublicBase}/uploads/${normalizedPath}`);
  });
}

// Health
app.get(['/health', '/api/health'], (req, res) => {
  res.json({ ok: true, name: 'learnda-api', version: config.version });
});

// Vercel runs Express as a function instead of executing server.js. Initialize
// database-backed services on the first non-health request in each warm
// function instance. Normal Node startup has already awaited the same promise.
app.use(async (req, res, next) => {
  try {
    await app.init();
    return next();
  } catch (error) {
    logger.error('Application initialization failed:', error);
    return res.status(503).json({
      success: false,
      error: 'Service temporarily unavailable'
    });
  }
});

// API routes
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/subscription', subscriptionRoutes);
if (config.features.enableContributions) {
  app.use('/contributions', contributionRoutes);
}
if (config.features.enableAnalytics) {
  app.use('/analytics', analyticsRoutes);
}
app.use('/payment', paymentRoutes);
app.use('/gpt', gptRoutes);
app.use('/revenue', revenueRoutes);
app.use('/courses', coursesRoutes);
app.use('/pls', plsRoutes);
app.use('/study-groups', studyGroupsRoutes);
if (config.features.enableGamification) {
  app.use('/gamification', gamificationRoutes);
}
app.use('/admin', adminRoutes);
app.use('/newsletter', newsletterRoutes);
app.use('/support', supportRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/rewards', rewardsRoutes);
app.use('/community', communityRoutes);
app.use('/resources', resourcesRoutes);
app.use('/applications', applicationsRoutes);
app.use('/blog', blogRoutes);
app.use('/user', userRoutes);
app.use('/me', meRoutes);
app.use('/billing', billingRoutes);
app.use('/comments', commentsRoutes);
app.use('/site-content', siteContentRoutes);
app.use('/public-config', publicConfigRoutes);
app.use('/cron', cronRoutes);

// API prefix aliases (for frontend routes that use /api/*)
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/subscription', subscriptionRoutes);
if (config.features.enableContributions) {
  app.use('/api/contributions', contributionRoutes);
}
if (config.features.enableAnalytics) {
  app.use('/api/analytics', analyticsRoutes);
}
app.use('/api/payment', paymentRoutes);
app.use('/api/gpt', gptRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/pls', plsRoutes);
app.use('/api/study-groups', studyGroupsRoutes);
if (config.features.enableGamification) {
  app.use('/api/gamification', gamificationRoutes);
}
app.use('/api/admin', adminRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/user', userRoutes);
app.use('/api/me', meRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/public-config', publicConfigRoutes);
app.use('/api/cron', cronRoutes);

// Mobile alias
app.get('/search', optionalAuth, contentController.search);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ success: false, error: 'Server error' });
});

// Initialize DB on first import
// (Server will await this in server.js for deterministic startup)
app.init = () => {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    await connectAndSync();
    try {
      const gamificationService = require('./services/gamificationService');
      await gamificationService.initializeDefaultBadges();
    } catch (err) {
      logger.error('Badge seeding failed:', err);
    }
  })().catch((error) => {
    // Allow a later request to retry after a transient database outage.
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
};

module.exports = app;
