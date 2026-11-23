const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../api/_lib/_paypal-order-store.js');

test('PayPal order record stores the validated checkout recipient and purchase', async () => {
  process.env.SUPABASE_URL = 'https://db.example'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const calls = [];
  store.__setFetch(async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => [{ order_id: 'ORDER123', customer_email: 'student@example.com', purchase: { baseSlug: 'blueprint', amount: 100 } }] }; });
  try {
    await store.save({ orderID: 'ORDER123', customer: { email: 'student@example.com', customerName: 'Student' }, purchase: { baseSlug: 'blueprint', amount: 100 }, currency: 'AUD' });
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.customer_email, 'student@example.com');
    assert.equal(body.purchase.amount, 100);
    const record = await store.load('ORDER123');
    assert.equal(record.customer.email, 'student@example.com');
  } finally { store.__resetForTests(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});

test('PayPal order storage supports the new Supabase secret key', async () => {
  process.env.SUPABASE_URL = 'https://db.example'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key';
  let headers;
  store.__setFetch(async (_, options) => { headers = options.headers; return { ok: true }; });
  try {
    await store.save({ orderID: 'ORDER123', customer: { email: 'student@example.com', customerName: 'Student' }, purchase: { baseSlug: 'blueprint', amount: 100 }, currency: 'AUD' });
    assert.equal(headers.apikey, 'sb_secret_test_key');
    assert.equal(headers.Authorization, undefined);
  } finally { store.__resetForTests(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
