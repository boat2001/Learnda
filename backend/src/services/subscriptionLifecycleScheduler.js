const subscriptionService = require('./subscriptionService');
const logger = require('../config/logger');

const runSweep = async () => {
  try {
    await subscriptionService.runLifecycleSweep();
    logger.info('Subscription lifecycle sweep completed');
  } catch (error) {
    logger.error('Subscription lifecycle sweep failed:', error);
    throw error;
  }
};

module.exports = {
  runSweep
};
