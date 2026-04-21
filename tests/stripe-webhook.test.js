const test = require('node:test');
const assert = require('node:assert/strict');

const fulfillPaymentIntent = require('../api/lib/fulfill-payment-intent.js');
const stripeWebhookHandler = require('../api/stripe-webhook.js');

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('fulfillment helper maps product slugs to server-side fulfillment plans', () => {
  assert.deepEqual(fulfillPaymentIntent.getFulfillmentPlan('blueprint'), {
    productSlug: 'blueprint',
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
  });

  assert.deepEqual(fulfillPaymentIntent.getFulfillmentPlan('essay-marking'), {
    productSlug: 'essay-marking',
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay submission instructions',
  });

  assert.deepEqual(fulfillPaymentIntent.getFulfillmentPlan('essay-pack-10'), {
    productSlug: 'essay-pack-10',
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay pack submission instructions',
  });

  assert.deepEqual(fulfillPaymentIntent.getFulfillmentPlan('private-mentoring'), {
    productSlug: 'private-mentoring',
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
  });

  assert.deepEqual(fulfillPaymentIntent.getFulfillmentPlan('comprehensive', 'mentoring-single'), {
    productSlug: 'comprehensive',
    upsellSlug: 'private-mentoring',
    deliveryType: 'cohort-onboarding+booking-link',
    fulfillmentLabel: 'Send cohort onboarding email + Send mentoring booking link',
  });
});

test('fulfillment helper records fulfillment on the PaymentIntent metadata', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_123',
    metadata: {
      base_slug: 'blueprint',
      customer_email: 'jane@example.com',
    },
  };

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent,
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
    now: () => '2026-04-19T12:00:00.000Z',
  });

  assert.equal(result.alreadyFulfilled, false);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 'pi_123');
  assert.equal(updates[0].payload.metadata.fulfillment_status, 'fulfilled');
  assert.equal(updates[0].payload.metadata.fulfilled_at, '2026-04-19T12:00:00.000Z');
  assert.equal(updates[0].payload.metadata.fulfillment_delivery_type, 'digital-access');
  assert.equal(updates[0].payload.metadata.fulfillment_label, 'Send Google Drive access');
  assert.equal(updates[0].payload.metadata.base_slug, 'blueprint');
  assert.equal(updates[0].payload.metadata.fulfillment_product_slugs, 'blueprint');
});

test('fulfillment helper records combined purchase metadata without breaking base fulfillment', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_456',
    metadata: {
      base_slug: 'comprehensive',
      upsell_slug: 'mentoring-single',
      customer_email: 'jane@example.com',
    },
  };

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent,
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
    now: () => '2026-04-19T12:00:00.000Z',
  });

  assert.equal(result.alreadyFulfilled, false);
  assert.equal(result.plan.upsellSlug, 'private-mentoring');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].payload.metadata.fulfillment_delivery_type, 'cohort-onboarding+booking-link');
  assert.equal(
    updates[0].payload.metadata.fulfillment_label,
    'Send cohort onboarding email + Send mentoring booking link'
  );
  assert.equal(updates[0].payload.metadata.fulfillment_product_slugs, 'comprehensive,private-mentoring');
});

test('fulfillment helper skips duplicate webhook deliveries once already fulfilled', async () => {
  let updateCalled = false;

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
      metadata: {
        product_slug: 'blueprint',
        fulfillment_status: 'fulfilled',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => {
          updateCalled = true;
        },
      },
    },
  });

  assert.equal(result.alreadyFulfilled, true);
  assert.equal(updateCalled, false);
});

test('fulfillment helper skips stale webhook replays when Stripe already shows fulfillment', async () => {
  let updateCalled = false;

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_789',
      metadata: {
        product_slug: 'blueprint',
      },
    },
    stripeClient: {
      paymentIntents: {
        retrieve: async () => ({
          id: 'pi_789',
          metadata: {
            product_slug: 'blueprint',
            base_slug: 'blueprint',
            fulfillment_status: 'fulfilled',
          },
        }),
        update: async () => {
          updateCalled = true;
        },
      },
    },
  });

  assert.equal(result.alreadyFulfilled, true);
  assert.equal(updateCalled, false);
});

test('stripe webhook rejects requests without a signature header', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  const req = {
    method: 'POST',
    headers: {},
    body: Buffer.from('{}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Missing Stripe signature.' });
});

test('stripe webhook fulfills payment_intent.succeeded events and acknowledges retries safely', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  const constructedEvents = [];
  const fulfilledPaymentIntentIds = [];

  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent(payload, signature, secret) {
        constructedEvents.push({
          payload: String(payload),
          signature,
          secret,
        });

        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_456',
              metadata: {
                product_slug: 'essay-marking',
              },
            },
          },
        };
      },
    },
    paymentIntents: {
      update: async () => undefined,
    },
  }));

  stripeWebhookHandler.__setFulfillPaymentIntent(async ({ paymentIntent }) => {
    fulfilledPaymentIntentIds.push(paymentIntent.id);
    return { alreadyFulfilled: false };
  });

  const req = {
    method: 'POST',
    headers: {
      'stripe-signature': 't=123,v1=abc',
    },
    body: Buffer.from('{"id":"evt_123"}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(constructedEvents.length, 1);
  assert.equal(constructedEvents[0].signature, 't=123,v1=abc');
  assert.equal(constructedEvents[0].secret, 'whsec_test');
  assert.deepEqual(fulfilledPaymentIntentIds, ['pi_456']);

  stripeWebhookHandler.__resetForTests();
});
