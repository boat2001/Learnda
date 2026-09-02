/* eslint-disable no-console */
/**
 * Run this once to archive any collected-* database entries
 * that no longer exist in the main collection JSON files.
 * Usage: node backend/src/scripts/sync_collected_now.js
 */
const { connectAndSync } = require('../models');
const { syncCollected } = require('../services/collectedEdutainmentSync');

(async () => {
  await connectAndSync();
  console.log('Syncing collected edutainment to database...');
  const result = await syncCollected();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
