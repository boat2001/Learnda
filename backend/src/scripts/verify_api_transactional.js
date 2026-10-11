// Real authenticated API checks inside a rolled-back transaction. No email,
// SMS, payment, or file-storage provider is invoked.
const assert = require('assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../models');
const config = require('../config/env');
const emailService = require('../services/emailService');
for (const key of Object.keys(emailService)) if (/^send/.test(key) && typeof emailService[key] === 'function') emailService[key] = async () => ({ skipped: true });
const app = require('../app');
const authController = require('../controllers/authController');
let deliveredOtp;
emailService.isConfigured = () => true;
authController.sendRegistrationOtp = async ({ otp }) => { deliveredOtp = otp; };

async function main() {
  await db.sequelize.authenticate();
  const transaction = await db.sequelize.transaction();
  const originalQuery = db.sequelize.query;
  const previousNamespace = db.sequelize.constructor._cls;
  // Sequelize findOrCreate must reuse the fixture transaction rather than
  // create and commit an independent transaction during free-plan enrollment.
  db.sequelize.constructor.useCLS({ bind: fn => fn, run: fn => fn(), get: key => key === 'transaction' ? transaction : undefined, set: () => {} });
  const fixtureIds = [];
  app.init = async () => {};
  // All requests in this process use the same uncommitted fixture records.
  db.sequelize.query = function transactionalQuery(sql, options = {}) {
    return originalQuery.call(this, sql, { ...options, transaction });
  };
  try {
    const freePlan = await db.Plan.findOne({ where: { price: 0, is_active: true } });
    assert.ok(freePlan, 'An active free plan must exist.');
    {
      const contact = `signup-check-${crypto.randomUUID()}@example.invalid`;
      const password = crypto.randomUUID();
      const registration = await request(app).post('/auth/register').send({ contact });
      assert.equal(registration.status, 202, registration.body.error);
      const signup = await request(app).post('/auth/register/verify-otp').send({ contact, challenge_token: registration.body.challenge_token, otp: deliveredOtp, password, full_name: 'API Signup Verification' });
      assert.ok([200, 201].includes(signup.status), signup.body.error);
      assert.ok(signup.body.user?.id && (signup.body.token || signup.body.accessToken));
      fixtureIds.push(signup.body.user.id);
      const enrolled = await db.Subscription.findOne({ where: { user_id: signup.body.user.id, status: 'active' } });
      assert.equal(enrolled?.plan_id, freePlan.id);
      const login = await request(app).post('/auth/login').send({ email: contact, password });
      assert.equal(login.status, 200, login.body.error);
      assert.ok(login.body.token || login.body.accessToken);
      console.log('PASS signup with simulated OTP delivery, automatic free enrollment, and password login.');
    }
    for (const classLevel of ['KG1', 'B2', 'JHS1', 'SHS1', 'SHS2']) {
      const sessionToken = crypto.randomUUID();
      const user = await db.User.create({
        full_name: 'API Verification', email: `api-check-${crypto.randomUUID()}@example.invalid`,
        password_hash: crypto.randomUUID(), session_token: sessionToken,
        profile_complete: true, password_set: true, last_active_at: new Date(),
      });
      fixtureIds.push(user.id);
      await db.Subscription.create({ user_id: user.id, plan_id: freePlan.id, status: 'active', started_at: new Date() });
      const token = jwt.sign({ userId: user.id, sessionToken }, config.jwt.secret, { expiresIn: '5m' });
      const auth = { Authorization: `Bearer ${token}` };
      const payload = { class_level: classLevel };
      if (classLevel.startsWith('SHS')) payload.pathway_id = (await db.LearningPathway.findOne({ where: { slug: 'business' } })).id;
      const placement = await request(app).put('/me/class-placement').set(auth).send(payload);
      assert.equal(placement.status, 200, `Class placement: ${placement.body.error || ''}`);
      assert.equal((await request(app).put('/me/class-placement').set(auth).send(payload)).status, 409);
      const subjects = await request(app).get('/subjects').set(auth);
      assert.equal(subjects.status, 200);
      const units = subjects.body.data.subjects || subjects.body.data.units || subjects.body.data.learning_units;
      assert.ok(Array.isArray(units) && units.length, `No subjects returned for ${classLevel}`);
      if (classLevel === 'SHS1') {
        assert.ok(units.some(unit => unit.slug === 'business_studies'));
        assert.ok(!units.some(unit => unit.slug === 'accounting'));
      }
      if (classLevel === 'SHS2') assert.ok(units.some(unit => unit.slug === 'accounting'));
      const lessonResponse = await request(app).get(`/subjects/${units[0].slug}/lessons`).set(auth);
      assert.equal(lessonResponse.status, 200);
      if (classLevel === 'B2') {
        const lesson = await db.Lesson.create({ title: 'Transactional lesson', creator_id: user.id, learning_unit_id: units[0].id, class_level_code: 'B2', status: 'published' });
        const futureLesson = await db.Lesson.create({ title: 'Future lesson', creator_id: user.id, learning_unit_id: units[0].id, class_level_code: 'B3', status: 'published' });
        assert.equal((await request(app).get(`/content/${lesson.id}`).set(auth)).status, 200);
        assert.equal((await request(app).get(`/content/${lesson.id}`)).status, 401);
        assert.equal((await request(app).get(`/content/${futureLesson.id}`).set(auth)).status, 404);
        assert.equal((await request(app).post(`/content/${futureLesson.id}/complete`).set(auth).send({})).status, 404);
        const quiz = await db.TextItem.create({ title: 'Transactional quiz', subtype: 'quiz', creator_id: user.id, status: 'published', metadata: { learning_unit_id: units[0].id, class_level_code: 'B2' }, questions: [] });
        const practice = await request(app).get(`/subjects/${units[0].slug}/practice`).set(auth);
        assert.equal(practice.status, 200);
        assert.ok(practice.body.data.quizzes.some(item => item.id === quiz.id));
        const feed = await request(app).get('/content').set(auth);
        assert.equal(feed.status, 200);
        assert.ok(!feed.body.content.some(item => item.id === futureLesson.id));
        console.log('PASS lesson access, future-content guard, and subject practice wiring.');
      }
      assert.equal((await request(app).get(`/subjects/${units[0].slug}/lessons?class_level=SHS3`).set(auth)).status, 403);
      console.log(`PASS ${classLevel}: placement, subjects, revision guard, and immutable class.`);
    }
    for (const category of ['Support', 'Partnership', 'Bug']) {
      const response = await request(app).post('/support/report').send({ name: 'API Verification', email: 'api-check@example.invalid', subject: 'Transactional API check', message: 'This test report is rolled back.', category });
      assert.equal(response.status, 201);
      assert.ok(await db.SupportReport.findByPk(response.body.report_id));
    }
    const rating = await request(app).post('/analytics/event').send({ eventName: 'platform_rating', properties: { rating: 5 } });
    assert.equal(rating.status, 200);
    assert.ok(await db.Event.findOne({ where: { event_type: 'platform_rating' } }));
    console.log('PASS report and rating persistence.');
  } finally {
    db.sequelize.query = originalQuery;
    db.sequelize.constructor._cls = previousNamespace;
    await transaction.rollback();
  }
  assert.equal(await db.User.count({ where: { id: fixtureIds } }), 0, 'Verification users must be rolled back.');
  console.log('PASS rollback: no verification users or submissions were retained.');
}

main().catch(error => {
  console.error('Transactional API check failed:', error.message);
  process.exitCode = 1;
}).finally(() => db.sequelize.close());
