const test = require('node:test');
const assert = require('node:assert/strict');

const logPurchaseEvent = require('../api/_lib/_purchase-log.js');
const { sanitisePayload } = logPurchaseEvent;

// ── helpers ──────────────────────────────────────────────────────────────────

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

// ── sanitisePayload ───────────────────────────────────────────────────────────

test('sanitisePayload maps camelCase input to snake_case DB columns', () => {
  const result = sanitisePayload({
    eventType:     'stripe.fulfilled',
    provider:      'stripe',
    paymentId:     'pi_abc123',
    productSlug:   'blueprint',
    upsellSlug:    'essay-marking',
    customerEmail: 'buyer@example.com',
    customerName:  'Jane Doe',
    amountCents:   29900,
    currency:      'aud',
    outcome:       'success',
    errorMessage:  '',
    meta:          { foo: 'bar' },
  });

  assert.equal(result.event_type,     'stripe.fulfilled');
  assert.equal(result.provider,       'stripe');
  assert.equal(result.payment_id,     'pi_abc123');
  assert.equal(result.product_slug,   'blueprint');
  assert.equal(result.upsell_slug,    'essay-marking');
  assert.equal(result.customer_email, 'buyer@example.com');
  assert.equal(result.customer_name,  'Jane Doe');
  assert.equal(result.amount_cents,   29900);
  assert.equal(result.currency,       'aud');
  assert.equal(result.outcome,        'success');
  assert.equal(result.error_message,  null);
  assert.deepEqual(result.meta,       { foo: 'bar' });
});

test('sanitisePayload drops unknown caller keys — no secret leakage', () => {
  const result = sanitisePayload({
    eventType:        'stripe.fulfilled',
    stripeSecretKey:  'sk_live_secret',
    rawWebhookBody:   '{"type":"payment_intent.succeeded","data":{}}',
    cardNumber:       '4242424242424242',
    apiToken:         'Bearer xyz',
    SUPABASE_SERVICE_ROLE_KEY: 'sbp_secret',
  });

  const keys = Object.keys(result);
  assert.equal(keys.includes('stripeSecretKey'),           false);
  assert.equal(keys.includes('rawWebhookBody'),            false);
  assert.equal(keys.includes('cardNumber'),                false);
  assert.equal(keys.includes('apiToken'),                  false);
  assert.equal(keys.includes('SUPABASE_SERVICE_ROLE_KEY'), false);

  // only the expected DB columns are present
  const expected = [
    'event_type','provider','payment_id','product_slug','upsell_slug',
    'customer_email','customer_name','amount_cents','currency','outcome',
    'error_message','meta',
  ];
  assert.deepEqual(keys.sort(), expected.sort());
});

test('sanitisePayload truncates oversized strings', () => {
  const long600 = 'x'.repeat(600);
  const result = sanitisePayload({
    eventType:    long600,
    errorMessage: long600,
    provider:     long600,
    paymentId:    long600,
    productSlug:  long600,
    upsellSlug:   long600,
    customerEmail:long600,
    customerName: long600,
    currency:     long600,
    outcome:      long600,
  });

  assert.equal(result.event_type.length,     100);
  assert.equal(result.error_message.length,  500);
  assert.equal(result.provider.length,        50);
  assert.equal(result.payment_id.length,     200);
  assert.equal(result.product_slug.length,   100);
  assert.equal(result.upsell_slug.length,    100);
  assert.equal(result.customer_email.length, 320);
  assert.equal(result.customer_name.length,  120);
  assert.equal(result.currency.length,        10);
  assert.equal(result.outcome.length,         50);
});

test('sanitisePayload rounds amountCents and handles non-numeric gracefully', () => {
  assert.equal(sanitisePayload({ eventType: 'x', amountCents: 299.7 }).amount_cents, 300);
  assert.equal(sanitisePayload({ eventType: 'x', amountCents: 'bad' }).amount_cents, null);
  assert.equal(sanitisePayload({ eventType: 'x' }).amount_cents,                    null);
});

test('sanitisePayload sets nulls for missing optional fields', () => {
  const result = sanitisePayload({ eventType: 'payment_intent.created' });
  assert.equal(result.provider,       null);
  assert.equal(result.payment_id,     null);
  assert.equal(result.upsell_slug,    null);
  assert.equal(result.customer_email, null);
  assert.equal(result.amount_cents,   null);
  assert.equal(result.meta,           null);
});

test('sanitisePayload rejects non-object meta', () => {
  assert.equal(sanitisePayload({ eventType: 'x', meta: 'string' }).meta, null);
  assert.equal(sanitisePayload({ eventType: 'x', meta: 42 }).meta,       null);
  assert.equal(sanitisePayload({ eventType: 'x', meta: null }).meta,     null);
});

// ── no-op behaviour ───────────────────────────────────────────────────────────

test('no-ops when SUPABASE_URL is absent', async () => {
  await withEnv({ SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    let fetchCalled = false;
    logPurchaseEvent.__setFetchImpl(async () => { fetchCalled = true; return { ok: true }; });

    await logPurchaseEvent({ eventType: 'stripe.fulfilled', outcome: 'success' });

    assert.equal(fetchCalled, false, 'fetch must not be called without env vars');
    logPurchaseEvent.__resetForTests();
  });
});

test('no-ops when SUPABASE_URL is set but SUPABASE_SERVICE_ROLE_KEY is absent', async () => {
  await withEnv({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    let fetchCalled = false;
    logPurchaseEvent.__setFetchImpl(async () => { fetchCalled = true; return { ok: true }; });

    await logPurchaseEvent({ eventType: 'stripe.fulfilled', outcome: 'success' });

    assert.equal(fetchCalled, false);
    logPurchaseEvent.__resetForTests();
  });
});

// ── live insert path ──────────────────────────────────────────────────────────

test('calls Supabase REST API with correct URL and auth headers when env vars are present', async () => {
  await withEnv(
    { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sbp_service_key' },
    async () => {
      let captured = null;
      logPurchaseEvent.__setFetchImpl(async (url, opts) => {
        captured = { url, opts };
        return { ok: true };
      });

      await logPurchaseEvent({
        eventType:     'stripe.fulfilled',
        provider:      'stripe',
        paymentId:     'pi_abc',
        productSlug:   'blueprint',
        customerEmail: 'buyer@example.com',
        amountCents:   29900,
        currency:      'aud',
        outcome:       'success',
      });

      assert.ok(captured, 'fetch should have been called');
      assert.equal(captured.url, 'https://proj.supabase.co/rest/v1/purchase_events');
      assert.equal(captured.opts.method, 'POST');
      assert.equal(captured.opts.headers['Authorization'], 'Bearer sbp_service_key');
      assert.equal(captured.opts.headers['apikey'], 'sbp_service_key');
      assert.equal(captured.opts.headers['Prefer'], 'return=minimal');

      const body = JSON.parse(captured.opts.body);
      assert.equal(body.event_type,   'stripe.fulfilled');
      assert.equal(body.payment_id,   'pi_abc');
      assert.equal(body.outcome,      'success');
      assert.equal(body.amount_cents, 29900);

      logPurchaseEvent.__resetForTests();
    }
  );
});

test('body contains only safe DB columns — no raw credentials in insert payload', async () => {
  await withEnv(
    { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sbp_service_key' },
    async () => {
      let body = null;
      logPurchaseEvent.__setFetchImpl(async (_url, opts) => {
        body = JSON.parse(opts.body);
        return { ok: true };
      });

      await logPurchaseEvent({
        eventType:      'payment_intent.created',
        stripeSecretKey:'sk_live_real',
        cardData:       '4111111111111111',
      });

      assert.equal('stripeSecretKey' in body, false);
      assert.equal('cardData' in body, false);
      logPurchaseEvent.__resetForTests();
    }
  );
});

// ── resilience ────────────────────────────────────────────────────────────────

test('never throws when fetch rejects', async () => {
  await withEnv(
    { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sbp_key' },
    async () => {
      logPurchaseEvent.__setFetchImpl(async () => { throw new Error('Network failure'); });

      await assert.doesNotReject(async () => {
        await logPurchaseEvent({ eventType: 'stripe.fulfilled', outcome: 'success' });
      });

      logPurchaseEvent.__resetForTests();
    }
  );
});

test('never throws when Supabase returns a non-ok status', async () => {
  await withEnv(
    { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sbp_key' },
    async () => {
      logPurchaseEvent.__setFetchImpl(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }));

      await assert.doesNotReject(async () => {
        await logPurchaseEvent({ eventType: 'stripe.fulfilled', outcome: 'success' });
      });

      logPurchaseEvent.__resetForTests();
    }
  );
});

test('never throws when called with no arguments', async () => {
  await assert.doesNotReject(async () => {
    await logPurchaseEvent();
  });
});
