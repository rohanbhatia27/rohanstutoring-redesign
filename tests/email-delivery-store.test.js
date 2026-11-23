const test = require('node:test');
const assert = require('node:assert/strict');
const delivery = require('../api/_lib/_email-delivery-store.js');

test('email delivery records acceptance once and reuses a stable idempotency key on retry', async () => {
  let row, calls = 0;
  const requests = [];
  delivery.__setRequest(async (method, data) => {
    if (method === 'reserve') { row ||= { ...data, status: 'pending', created_at: new Date().toISOString() }; return; }
    if (method === 'get') return row;
    if (method === 'complete') { row = { ...row, status: 'sent', message_id: data.messageId }; }
  });
  const send = async key => { requests.push(key); calls++; if (calls === 1) throw new Error('timeout'); return { messageId: 'msg_1' }; };
  try {
    await assert.rejects(() => delivery.run({ provider: 'stripe', paymentId: 'pi_1', purpose: 'confirmation', send }), /timeout/);
    assert.deepEqual(await delivery.run({ provider: 'stripe', paymentId: 'pi_1', purpose: 'confirmation', send }), { messageId: 'msg_1' });
    await delivery.run({ provider: 'stripe', paymentId: 'pi_1', purpose: 'confirmation', send });
    assert.equal(calls, 2);
    assert.equal(requests[0], requests[1]);
  } finally { delivery.__resetForTests(); }
});

test('a definite rejection remains retryable after the idempotency window', async () => {
  let row;
  delivery.__setRequest(async (method, data) => {
    if (method === 'reserve') { row ||= { ...data, status: 'pending', created_at: new Date().toISOString() }; return; }
    if (method === 'get') return row;
    if (method === 'fail') { row.status = 'failed'; row.created_at = new Date(Date.now() - 25 * 3600 * 1000).toISOString(); }
    if (method === 'restart') { row.status = 'pending'; row.created_at = new Date().toISOString(); }
    if (method === 'complete') { row.status = 'sent'; row.message_id = data.messageId; }
  });
  try {
    await assert.rejects(() => delivery.run({ provider: 'stripe', paymentId: 'pi_2', purpose: 'confirmation', send: async () => { const error = new Error('rejected'); error.notAccepted = true; throw error; } }), /rejected/);
    assert.equal(row.status, 'failed');
    const result = await delivery.run({ provider: 'stripe', paymentId: 'pi_2', purpose: 'confirmation', send: async () => ({ messageId: 'msg_2' }) });
    assert.equal(result.messageId, 'msg_2');
  } finally { delivery.__resetForTests(); }
});

test('delivery storage uses the current Supabase secret-key authentication', async () => {
  process.env.SUPABASE_URL = 'https://db.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key';
  const oldFetch = global.fetch, seen = [];
  global.fetch = async (_, options) => {
    seen.push(options.headers);
    return { ok: true, json: async () => [{ status: 'pending', created_at: new Date().toISOString() }] };
  };
  try {
    await delivery.run({ provider: 'stripe', paymentId: 'pi_auth', purpose: 'confirmation', send: async () => ({ messageId: 'message' }) });
    assert.equal(seen.length, 3);
    assert.ok(seen.every(headers => headers.apikey === 'sb_secret_test_key' && !headers.Authorization));
  } finally {
    global.fetch = oldFetch;
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
