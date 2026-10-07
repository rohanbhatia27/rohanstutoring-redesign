const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/resource-sync.js');
const store = require('../api/_lib/_resource-sync-store.js');
const kit = require('../api/_lib/_kit.js');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('daily job requires the configured cron bearer token', async () => {
  process.env.CRON_SECRET = 'secret';
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 401);
  delete process.env.CRON_SECRET;
});

test('daily job retries only failed Kit steps and marks the lead synced', async () => {
  process.env.CRON_SECRET = 'secret';
  process.env.KIT_API_KEY = 'kit-test';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb-test';
  const patches = [];
  store.__setFetch(async (url, options) => {
    if (options.method === 'PATCH') { patches.push(JSON.parse(options.body)); return { ok: true }; }
    if (url.includes('free_resource.reconciliation')) return { ok: true, json: async () => [{ id: 'already-done' }] };
    return { ok: true, json: async () => [{ id: 'lead-1', product_slug: 'game-plan', customer_email: 'jane@example.com', customer_name: 'Jane', meta: { failed_steps: ['tag'], email_status: 'sent' } }] };
  });
  const kitCalls = [];
  kit.__setFetch(async (url) => {
    kitCalls.push(url);
    if (url.includes('/subscribers?')) return { ok: true, status: 200, json: async () => ({ subscribers: [] }) };
    return { ok: true, status: 200, json: async () => ({ subscriber: { id: 123 } }) };
  });
  const res = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer secret' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.retried, 1);
  assert.equal(res.body.recovered, 1);
  assert.equal(patches[0].outcome, 'synced');
  assert.equal(kitCalls.length, 3);

  store.__resetForTests();
  kit.__resetForTests();
  delete process.env.CRON_SECRET;
  delete process.env.KIT_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
