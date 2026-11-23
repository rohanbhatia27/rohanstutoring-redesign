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

test('a delivery that was already sent is flagged so callers do not log it as a new send', async () => {
  let row = { delivery_key: 'k', provider: 'paypal', payment_id: 'o_1', purpose: 'confirmation', status: 'sent', message_id: 'msg_old', created_at: new Date().toISOString() };
  let sends = 0;
  delivery.__setRequest(async (method) => { if (method === 'get') return row; });
  try {
    const replay = await delivery.run({ provider: 'paypal', paymentId: 'o_1', purpose: 'confirmation', send: async () => { sends++; return { messageId: 'msg_new' }; } });
    assert.deepEqual(replay, { messageId: 'msg_old', alreadySent: true });
    assert.equal(sends, 0);
  } finally { delivery.__resetForTests(); }
});

test('a fresh send is not flagged as already sent', async () => {
  let row;
  delivery.__setRequest(async (method, data) => {
    if (method === 'reserve') { row ||= { ...data, status: 'pending', created_at: new Date().toISOString() }; return; }
    if (method === 'get') return row;
    if (method === 'complete') { row = { ...row, status: 'sent', message_id: data.messageId }; }
  });
  try {
    const result = await delivery.run({ provider: 'paypal', paymentId: 'o_2', purpose: 'confirmation', send: async () => ({ messageId: 'msg_1' }) });
    assert.equal(result.alreadySent, undefined);
  } finally { delivery.__resetForTests(); }
});

test('fulfilment logs record an already-sent email as skipped, not as a new send', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['_paypal-fulfillment.js', '_fulfill-payment-intent.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', file), 'utf8');
    assert.match(source, /emailResult\.alreadySent \? 'skipped' : 'success'/, `${file} confirmation log`);
    assert.match(source, /result\.alreadySent \? 'skipped' : 'success'/, `${file} essay PDF log`);
    assert.doesNotMatch(source, /eventType: 'email\.sent', outcome: 'success'/, `${file} must not log every email.sent as success`);
  }
});
