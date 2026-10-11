const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/services/api.js'), 'utf8');
const apiClass = source.slice(source.indexOf('class ApiService'), source.indexOf('export const api ='));

function createClient(values = {}) {
  const storage = new Map(Object.entries(values));
  const context = {
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { dispatchEvent: jest.fn() },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    FormData: class {}, URLSearchParams, fetch: jest.fn(), console: { error: jest.fn() },
  };
  vm.runInNewContext(`const API_BASE_URL = 'http://api.test'; const PLACEHOLDER_MODE = false; ${apiClass}; this.api = new ApiService();`, context);
  return { ...context, storage };
}

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test('expired sessions reject instead of returning a false successful submission', async () => {
  const client = createClient({ token: 'expired', user: '{}' });
  client.fetch.mockResolvedValue(response(401, { error: 'Invalid authentication token' }));
  await expect(client.api.support.submitReport({ message: 'test' })).rejects.toMatchObject({ status: 401 });
  expect(client.storage.has('token')).toBe(false);
  expect(client.window.dispatchEvent).toHaveBeenCalled();
});

test('optional analytics still tolerate session failures', async () => {
  const client = createClient();
  client.fetch.mockResolvedValue(response(401, { error: 'Authentication required' }));
  await expect(client.api.analytics.trackEvent('test')).resolves.toBeNull();
  expect(client.window.dispatchEvent).not.toHaveBeenCalled();
});

test('guest authorization failures reject without expiring a nonexistent session', async () => {
  const client = createClient();
  client.fetch.mockResolvedValue(response(401, { error: 'Authentication required' }));
  await expect(client.api.subjects.getAll()).rejects.toMatchObject({ status: 401 });
  expect(client.window.dispatchEvent).not.toHaveBeenCalled();
});

test('refresh retries preserve cache and failure options', async () => {
  const client = createClient({ token: 'expired', refreshToken: 'refresh' });
  client.fetch.mockResolvedValueOnce(response(401, { error: 'Invalid authentication token' }))
    .mockResolvedValueOnce(response(200, { accessToken: 'fresh' }))
    .mockResolvedValueOnce(response(200, { success: true }));
  await client.api.request('/me', { cacheTtlMs: 60000 });
  await client.api.request('/me', { cacheTtlMs: 60000 });
  expect(client.fetch).toHaveBeenCalledTimes(3);
  expect(client.storage.get('token')).toBe('fresh');
});
