const test = require('node:test');
const assert = require('node:assert/strict');

const { recordPromoRedemption } = require('../api/_lib/_promo-redemptions.js');
const stripeWebhookHandler = require('../api/stripe-webhook.js');

// The site applies coupons by lowering the charge itself, so Stripe never
// counts a redemption and max_redemptions on a promotion code never fires.
// These tests cover the webhook-side counter that closes that gap.

function createPromoStripe(promoCode) {
  const calls = { list: [], update: [] };
  return {
    calls,
    promotionCodes: {
      list: async (params) => {
        calls.list.push(params);
        return { data: promoCode ? [promoCode] : [] };
      },
      update: async (id, payload) => {
        calls.update.push({ id, payload });
        return { id, ...payload };
      },
    },
  };
}

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('a single-use code is deactivated after its first paid redemption', async () => {
  const stripe = createPromoStripe({
    id: 'promo_1',
    code: 'COMP649',
    active: true,
    max_redemptions: 1,
    times_redeemed: 0,
    metadata: {},
  });

  const result = await recordPromoRedemption({
    stripeClient: stripe,
    code: 'comp649',
    transactionId: 'pi_first',
  });

  assert.equal(result.deactivated, true);
  assert.deepEqual(stripe.calls.list[0], { code: 'COMP649', limit: 1 });
  assert.equal(stripe.calls.update.length, 1);
  assert.equal(stripe.calls.update[0].id, 'promo_1');
  assert.equal(stripe.calls.update[0].payload.active, false);
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemptions, '1');
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemption_ids, 'pi_first');
});

test('a multi-use code stays active and counts until its limit is reached', async () => {
  const stripe = createPromoStripe({
    id: 'promo_3',
    code: 'GROUP3',
    active: true,
    max_redemptions: 3,
    times_redeemed: 0,
    metadata: { site_redemptions: '1', site_redemption_ids: 'pi_a' },
  });

  const result = await recordPromoRedemption({
    stripeClient: stripe,
    code: 'GROUP3',
    transactionId: 'pi_b',
  });

  assert.equal(result.deactivated, false);
  assert.equal(stripe.calls.update[0].payload.active, undefined);
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemptions, '2');
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemption_ids, 'pi_a,pi_b');
});

test('Stripe-native redemptions count toward the limit too', async () => {
  const stripe = createPromoStripe({
    id: 'promo_2',
    code: 'TWOUSE',
    active: true,
    max_redemptions: 2,
    times_redeemed: 1,
    metadata: {},
  });

  const result = await recordPromoRedemption({
    stripeClient: stripe,
    code: 'TWOUSE',
    transactionId: 'pi_x',
  });

  assert.equal(result.deactivated, true);
  assert.equal(stripe.calls.update[0].payload.active, false);
});

test('a retried webhook for the same payment is not counted twice', async () => {
  const stripe = createPromoStripe({
    id: 'promo_3',
    code: 'GROUP3',
    active: true,
    max_redemptions: 3,
    times_redeemed: 0,
    metadata: { site_redemptions: '1', site_redemption_ids: 'pi_a' },
  });

  const result = await recordPromoRedemption({
    stripeClient: stripe,
    code: 'GROUP3',
    transactionId: 'pi_a',
  });

  assert.equal(result.alreadyRecorded, true);
  assert.equal(stripe.calls.update.length, 0);
});

test('codes without a redemption limit are left untouched', async () => {
  const stripe = createPromoStripe({
    id: 'promo_open',
    code: 'SAVE200',
    active: true,
    max_redemptions: null,
    times_redeemed: 0,
    metadata: {},
  });

  const result = await recordPromoRedemption({
    stripeClient: stripe,
    code: 'SAVE200',
    transactionId: 'pi_y',
  });

  assert.equal(result.skipped, true);
  assert.equal(stripe.calls.update.length, 0);
});

test('a payment without a coupon makes no Stripe calls', async () => {
  const stripe = createPromoStripe(null);
  const result = await recordPromoRedemption({ stripeClient: stripe, code: '', transactionId: 'pi_z' });

  assert.equal(result.skipped, true);
  assert.equal(stripe.calls.list.length, 0);
});

test('the redemption id list stays within Stripe metadata limits', async () => {
  const existingIds = Array.from({ length: 30 }, (_, i) => `pi_${String(i).padStart(24, '0')}`);
  const stripe = createPromoStripe({
    id: 'promo_big',
    code: 'BIG',
    active: true,
    max_redemptions: 100,
    times_redeemed: 0,
    metadata: { site_redemptions: '30', site_redemption_ids: existingIds.join(',') },
  });

  await recordPromoRedemption({ stripeClient: stripe, code: 'BIG', transactionId: 'pi_newest' });

  const ids = stripe.calls.update[0].payload.metadata.site_redemption_ids;
  assert.ok(ids.length <= 500, `metadata value is ${ids.length} chars`);
  assert.ok(ids.endsWith('pi_newest'));
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemptions, '31');
});

function setupWebhook(t, event, promoCode) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const stripe = createPromoStripe(promoCode);
  stripe.webhooks = { constructEvent: () => event };
  stripeWebhookHandler.__setStripeFactory(() => stripe);
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => ({ alreadyFulfilled: false }));
  stripeWebhookHandler.__setFulfillInstalmentCheckout(async () => ({}));
  stripeWebhookHandler.__setSendGa4Purchase(async () => {});
  t.after(() => stripeWebhookHandler.__resetForTests());
  return stripe;
}

const webhookReq = () => ({
  method: 'POST',
  headers: { 'stripe-signature': 't=123,v1=abc' },
  body: Buffer.from('{}'),
});

test('webhook records the coupon after a paid one-off checkout', async (t) => {
  const stripe = setupWebhook(t, {
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_paid', metadata: { base_slug: 'comprehensive', coupon_code: 'COMP649' } } },
  }, { id: 'promo_1', code: 'COMP649', active: true, max_redemptions: 1, times_redeemed: 0, metadata: {} });

  const res = createJsonResponseRecorder();
  await stripeWebhookHandler(webhookReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(stripe.calls.update.length, 1);
  assert.equal(stripe.calls.update[0].payload.active, false);
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemption_ids, 'pi_paid');
});

test('webhook records the coupon after a completed instalment checkout', async (t) => {
  const stripe = setupWebhook(t, {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_paid', metadata: { product_slug: 'comprehensive', payment_mode: 'instalments', coupon_code: 'COMP649' } } },
  }, { id: 'promo_1', code: 'COMP649', active: true, max_redemptions: 1, times_redeemed: 0, metadata: {} });

  const res = createJsonResponseRecorder();
  await stripeWebhookHandler(webhookReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(stripe.calls.update[0].payload.active, false);
  assert.equal(stripe.calls.update[0].payload.metadata.site_redemption_ids, 'cs_paid');
});

test('a redemption-tracking failure does not fail the webhook or block fulfilment', async (t) => {
  const stripe = setupWebhook(t, {
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_paid', metadata: { base_slug: 'comprehensive', coupon_code: 'COMP649' } } },
  }, null);
  stripe.promotionCodes.list = async () => {
    throw new Error('Stripe is down');
  };
  const alerts = [];
  stripeWebhookHandler.__setAlertFn(async (args) => alerts.push(args));

  const res = createJsonResponseRecorder();
  await stripeWebhookHandler(webhookReq(), res);

  assert.equal(res.statusCode, 200);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].failedStep, 'promo-code-redemption');
  assert.match(alerts[0].errorMessage, /COMP649/);
});
