// src/config/database.js
const { Sequelize } = require('sequelize');
const pg = require('pg');
const config = require('./env');

function createSequelize() {
  const { username, password, database, host, port, logging } = config.database;
  const sslEnabled = process.env.DATABASE_SSL !== 'false' && config.isProduction;
  const sharedOptions = {
    dialect: 'postgres',
    // Keep the driver explicit so Vercel's function tracer includes it.
    dialectModule: pg,
    logging: logging ? console.log : false,
    pool: config.database.pool,
    dialectOptions: sslEnabled ? { ssl: { require: true, rejectUnauthorized: false } } : {}
  };

  // Prefer DATABASE_URL if set (Render/Fly/Neon/etc.)
  const databaseUrl = process.env.DATABASE_URL;
  const sequelize = databaseUrl
    ? new Sequelize(databaseUrl, sharedOptions)
    : new Sequelize(database, username, password, {
        ...sharedOptions,
        host,
        port
      });

  return sequelize;
}

module.exports = { createSequelize };
