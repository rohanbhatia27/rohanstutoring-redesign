const test = require('node:test');
const assert = require('node:assert/strict');
const adminHandler = require('../api/admin.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('retry rejects an unpaid PaymentIntent before any write or fulfillment', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'test-secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  let updates = 0;
  adminHandler.__setStripeFactory(() => ({ paymentIntents: {
    retrieve: async () => ({ id: 'pi_test123', status: 'requires_payment_method', invoice: 'in_test' }),
    update: async () => { updates += 1; },
  } }));
  const res = response();
  await adminHandler({ method: 'POST', headers: { origin: 'https://www.rohanstutoring.com', 'x-fulfillment-retry-token': 'test-secret' }, body: { action: 'retryFulfillment', payment_intent: 'pi_test123' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(updates, 0);
  adminHandler.__resetForTests();
  delete process.env.FULFILLMENT_RETRY_TOKEN;
  delete process.env.STRIPE_SECRET_KEY;
});

test('runtime diagnostic requires header authentication and reveals only Node version', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'test-secret';
  const unauthorized = response();
  await adminHandler({ method: 'GET', headers: {}, query: { action: 'runtimeHealth', token: 'test-secret' } }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const authorized = response();
  await adminHandler({ method: 'GET', headers: { 'x-fulfillment-retry-token': 'test-secret' }, query: { action: 'runtimeHealth' } }, authorized);
  assert.equal(authorized.statusCode, 200);
  assert.deepEqual(authorized.body, { nodeVersion: process.version });
  assert.equal(authorized.headers['Cache-Control'], 'no-store');
  delete process.env.FULFILLMENT_RETRY_TOKEN;
});

test('Drive share refuses GET even with a valid token', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'test-secret';
  const res = response();
  await adminHandler({ method: 'GET', headers: { 'x-test-token': 'test-secret' }, query: { action: 'testDriveShare', email: 'test@example.com' } }, res);
  assert.equal(res.statusCode, 405);
  delete process.env.FULFILLMENT_RETRY_TOKEN;
});
