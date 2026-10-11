const app = require('./app');
const logger = require('./config/logger');
const config = require('./config/env');
const { sequelize } = require('./models');

const PORT = config.port;
const HOST = config.host;
let server;
let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; closing the API.`);
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  const closeDatabase = async () => {
    try {
      await sequelize.close();
      clearTimeout(timeout);
      process.exit(0);
    } catch (error) {
      logger.error('Database shutdown failed:', error);
      process.exit(1);
    }
  };
  if (server) {
    server.close(closeDatabase);
    // Idle keep-alive sockets (e.g. the dev proxy) would otherwise hold the port open.
    server.closeIdleConnections?.();
  } else {
    closeDatabase();
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

(async () => {
  try {
    await app.init();
    server = app.listen(PORT, HOST, () => {
      logger.info(`API running on http://${HOST}:${PORT}`);
    });
    server.on('error', error => {
      logger.error('Server listener failed:', error);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
})();
