// Read-only API checks against the configured database. Skips startup schema
// changes and badge seeding; it does not register users or send messages.
const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../models');

async function main() {
  await sequelize.authenticate();
  app.init = async () => {};
  const endpoints = [
    '/health', '/api/health', '/public-config', '/auth/session',
    '/auth/register/academic-catalog', '/subscription/plans',
    '/content/featured', '/content/trending',
    '/resources/files', '/analytics/rating-summary', '/support/success-stories',
  ];
  let failures = 0;
  for (const endpoint of endpoints) {
    const response = await request(app).get(endpoint).timeout({ response: 15000, deadline: 20000 });
    const ok = response.status === 200 && response.body.success !== false;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${endpoint}: ${response.status}${!ok ? ` ${response.body.error || ''}` : ''}`);
    if (!ok) failures++;
  }
  const protectedResponse = await request(app).get('/subjects');
  const protectedOk = protectedResponse.status === 401;
  console.log(`${protectedOk ? 'PASS' : 'FAIL'} /subjects: unauthenticated access ${protectedResponse.status}`);
  if (!protectedOk) failures++;
  if (failures) process.exitCode = 1;
}

main().catch(error => {
  console.error('Read-only API check failed:', error.name, error.message);
  process.exitCode = 1;
}).finally(() => sequelize.close());
