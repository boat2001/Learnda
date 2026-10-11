const request = require('supertest');
jest.mock('../models', () => ({ ...jest.requireActual('../models'), connectAndSync: jest.fn() }));
const db = require('../models');
const app = require('../app');
const config = require('../config/env');
const analyticsService = require('../services/analyticsService');
const gamificationService = require('../services/gamificationService');
const logger = require('../config/logger');

afterEach(() => jest.restoreAllMocks());
afterAll(() => db.sequelize.close());

describe('API request wiring', () => {
  beforeEach(() => {
    jest.spyOn(app, 'init').mockResolvedValue();
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('keeps health checks available when database initialization fails', async () => {
    app.init.mockRejectedValue(new Error('offline'));
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/public-config')).status).toBe(503);
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await request(app).post('/support/report').set('Content-Type', 'application/json').send('{');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid JSON body');
  });

  it('allows configured origins and rejects untrusted origins with 403', async () => {
    const origin = config.corsOrigin.split(',')[0];
    const allowed = await request(app).get('/health').set('Origin', origin);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    expect((await request(app).get('/health').set('Origin', 'https://untrusted.invalid')).status).toBe(403);
  });

  it('mounts authenticated onboarding and application routes with both prefixes', async () => {
    for (const prefix of ['', '/api']) {
      expect((await request(app).get(`${prefix}/me/academic-catalog`)).status).toBe(401);
      expect((await request(app).get(`${prefix}/applications/admin`)).status).toBe(401);
      expect((await request(app).post(`${prefix}/me/promotion-notice/seen`).send({ key: 'test' })).status).toBe(401);
      expect((await request(app).post(`${prefix}/applications`).send({ type: 'invalid' })).status).toBe(400);
    }
  });

  it('returns 500 for a rejected content query and continues serving requests', async () => {
    jest.spyOn(db.sequelize, 'query').mockRejectedValue(new Error('query failed'));
    expect((await request(app).get('/content/featured')).status).toBe(500);
    expect((await request(app).get('/api/content/featured')).status).toBe(500);
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('validates ratings and reports a failed write instead of false success', async () => {
    const track = jest.spyOn(analyticsService, 'trackEvent').mockResolvedValue(null);
    for (const rating of [0, 6, 2.5, '5']) {
      expect((await request(app).post('/analytics/event').send({ eventName: 'platform_rating', properties: { rating } })).status).toBe(400);
    }
    expect(track).not.toHaveBeenCalled();
    expect((await request(app).post('/analytics/event').send({ eventName: 'platform_rating', properties: { rating: 5 } })).status).toBe(500);
    track.mockResolvedValue({ id: 'event' });
    expect((await request(app).post('/api/analytics/event').send({ eventName: 'platform_rating', properties: { rating: 5 } })).body.success).toBe(true);
  });

  it('persists contact, partnership, and issue reports through the same route', async () => {
    const create = jest.spyOn(db.SupportReport, 'create').mockResolvedValue({ id: 'report' });
    for (const category of ['Support', 'Partnership', 'Bug']) {
      const response = await request(app).post('/support/report').send({ name: 'Test', email: 'test@example.com', subject: 'Test request', message: 'A test message', category });
      expect(response.status).toBe(201);
      expect(response.body.report_id).toBe('report');
      expect(create.mock.calls.at(-1)[0].category).toBe(category);
    }
  });

  it('rejects blank and malformed support submissions before saving', async () => {
    const create = jest.spyOn(db.SupportReport, 'create');
    for (const body of [
      { name: ' ', email: 'test@example.com', subject: 'Help', message: 'Test' },
      { name: 'Test', email: 'invalid', subject: 'Help', message: 'Test' },
      { name: 'Test', email: 'test@example.com', subject: 'Help', message: ' ' },
    ]) expect((await request(app).post('/support/report').send(body)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('startup initialization', () => {
  it('retries a failed initialization and shares concurrent startup work', async () => {
    db.connectAndSync.mockRejectedValueOnce(new Error('transient')).mockResolvedValue();
    jest.spyOn(db.Badge, 'count').mockResolvedValue(0);
    jest.spyOn(gamificationService, 'initializeDefaultBadges').mockResolvedValue();
    await expect(app.init()).rejects.toThrow('transient');
    const first = app.init();
    expect(app.init()).toBe(first);
    await first;
    expect(db.connectAndSync).toHaveBeenCalledTimes(2);
  });
});
