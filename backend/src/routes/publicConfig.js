const express = require('express');
const config = require('../config/env');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    config: {
      features: {
        social_subscription_popup: Boolean(config.features.enableSocialSubscriptionPopup),
        spotlight_popup: Boolean(config.features.enableSpotlightPopup),
      },
    },
  });
});

module.exports = router;
