const test = require('node:test');
const assert = require('node:assert/strict');

const ga4 = require('../api/_lib/_ga4-measurement-protocol.js');

function withEnv(vars, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    ga4.__resetForTests();
  });
}

test('buildGa4PurchasePayload maps Stripe metadata to GA4 ecommerce purchase fields', () => {
  const payload = ga4.buildGa4PurchasePayload({
    transactionId: 'pi_test_123',
    amountCents: 179800,
    currency: 'aud',
    metadata: {
      base_slug: 'comprehensive',
      product_slug: 'comprehensive',
      upsell_slug: 'mentoring-single',
      payment_mode: 'full',
      coupon_code: 'WEBINAR200',
      cohort: '2',
      ga_client_id: '123456789.987654321',
      ga_session_id: '1712345678',
    },
  });

  assert.equal(payload.client_id, '123456789.987654321');
  assert.equal(payload.events[0].name, 'purchase');
  assert.equal(payload.events[0].params.transaction_id, 'pi_test_123');
  assert.equal(payload.events[0].params.currency, 'AUD');
  assert.equal(payload.events[0].params.value, 1798);
  assert.equal(payload.events[0].params.product_slug, 'comprehensive');
  assert.equal(payload.events[0].params.payment_mode, 'full');
  assert.equal(payload.events[0].params.coupon, 'WEBINAR200');
  assert.equal(payload.events[0].params.session_id, '1712345678');
  assert.deepEqual(payload.events[0].params.items, [
    {
      item_id: 'comprehensive',
      item_name: 'GAMSAT S1 & S2 Comprehensive Course',
      item_category: 'Course',
      item_variant: 'Cohort 2',
      price: 1699,
      quantity: 1,
    },
    {
      item_id: 'mentoring-single',
      item_name: 'Add one 1:1 Strategy Class With Rohan',
      item_category: 'Service',
      price: 99,
      quantity: 1,
    },
  ]);
});

test('sendGa4Purchase posts Measurement Protocol purchase when configured', async () => {
  await withEnv({
    GA4_MEASUREMENT_ID: 'G-TEST123',
    GA4_MEASUREMENT_PROTOCOL_SECRET: 'api_secret_test',
  }, async () => {
    let captured = null;
    ga4.__setFetchImpl(async (url, options) => {
      captured = { url: String(url), options };
      return { ok: true, text: async () => '' };
    });

    const result = await ga4.sendGa4Purchase({
      transactionId: 'pi_test_123',
      amountCents: 59900,
      currency: 'aud',
      metadata: {
        base_slug: 'blueprint',
        product_slug: 'blueprint',
        payment_mode: 'full',
        ga_client_id: '123456789.987654321',
      },
    });

    assert.equal(result.sent, true);
    assert.match(captured.url, /^https:\/\/www\.google-analytics\.com\/mp\/collect\?/);
    assert.match(captured.url, /measurement_id=G-TEST123/);
    assert.match(captured.url, /api_secret=api_secret_test/);
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(captured.options.body).events[0].params.product_slug, 'blueprint');
  });
});

test('sendGa4Purchase skips safely when the secret or client id is missing', async () => {
  await withEnv({
    GA4_MEASUREMENT_ID: 'G-TEST123',
    GA4_MEASUREMENT_PROTOCOL_SECRET: undefined,
  }, async () => {
    let fetchCalled = false;
    ga4.__setFetchImpl(async () => {
      fetchCalled = true;
      return { ok: true };
    });

    const missingSecret = await ga4.sendGa4Purchase({
      transactionId: 'pi_test_123',
      amountCents: 59900,
      metadata: {
        product_slug: 'blueprint',
        ga_client_id: '123456789.987654321',
      },
    });

    assert.equal(missingSecret.sent, false);
    assert.equal(missingSecret.reason, 'not_configured');
    assert.equal(fetchCalled, false);
  });

  await withEnv({
    GA4_MEASUREMENT_ID: 'G-TEST123',
    GA4_MEASUREMENT_PROTOCOL_SECRET: 'api_secret_test',
  }, async () => {
    let fetchCalled = false;
    ga4.__setFetchImpl(async () => {
      fetchCalled = true;
      return { ok: true };
    });

    const missingClientId = await ga4.sendGa4Purchase({
      transactionId: 'pi_test_123',
      amountCents: 59900,
      metadata: {
        product_slug: 'blueprint',
      },
    });

    assert.equal(missingClientId.sent, false);
    assert.equal(missingClientId.reason, 'missing_client_id');
    assert.equal(fetchCalled, false);
  });
});
