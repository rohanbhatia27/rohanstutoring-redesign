const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../api/_lib/_resource-sync-store.js');

test('lead is inserted before delivery and remains queryable for retry', async () => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const calls = [];
  store.__setFetch(async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'POST') return { ok: true, json: async () => [{ id: 'lead-1' }] };
    if (options.method === 'PATCH') return { ok: true, json: async () => [] };
    return { ok: true, json: async () => [{ id: 'lead-1', outcome: 'sync_failed', customer_email: 'jane@example.com', product_slug: 'game-plan', meta: { failed_steps: ['tag'] } }] };
  });

  const row = await store.createLead({ resourceKey: 'game-plan', email: 'Jane@Example.com', firstName: 'Jane' });
  assert.equal(row.id, 'lead-1');
  assert.equal(JSON.parse(calls[0].options.body).outcome, 'pending');
  assert.equal(JSON.parse(calls[0].options.body).customer_email, 'jane@example.com');

  await store.updateLead('lead-1', { outcome: 'sync_failed', errorMessage: 'Kit unavailable', meta: { failed_steps: ['tag'] } });
  assert.match(calls[1].url, /id=eq\.lead-1/);
  assert.equal(JSON.parse(calls[1].options.body).outcome, 'sync_failed');

  const rows = await store.listRetryable();
  assert.equal(rows[0].id, 'lead-1');
  assert.match(calls[2].url, /outcome=in\./);

  store.__resetForTests();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test('storage fails closed when production credentials are missing', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await assert.rejects(() => store.createLead({ resourceKey: 'game-plan', email: 'jane@example.com' }), /SUPABASE/);
});
