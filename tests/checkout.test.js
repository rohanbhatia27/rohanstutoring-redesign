const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMAIL_PATTERN,
  PRODUCTS,
  fmtPrice,
  getProductFromSearch,
  getInitialSelection,
  getOrderBumpConfig,
  renderSummaryMarkup,
  buildOrderBumpMarkup,
  getPayButtonLabel,
  getSuccessMessage,
  getSuccessActionMarkup,
  buildSuccessUrl,
  getSuccessState,
  isProductAvailable,
  buildPurchaseItems,
  buildEssayUploadUrl,
  getApiServerErrorMessage,
  parseApiResponse,
  fetchCheckoutConfig,
  fetchPaymentIntentStatus,
  getSuccessPageTitle,
  getCustomerPayload,
  buildCheckoutPayload,
} = require('../js/checkout.js');
const createPaymentIntentHandler = require('../api/create-payment-intent.js');
const paymentIntentStatusHandler = require('../api/payment-intent-status.js');
const publicConfigHandler = require('../api/public-config.js');

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

test('fmtPrice formats whole and decimal amounts', () => {
  assert.equal(fmtPrice(599), '599');
  assert.equal(fmtPrice(1070), '1,070');
  assert.equal(fmtPrice(34.99), '34.99');
});

test('getProductFromSearch resolves a valid product slug', () => {
  const product = getProductFromSearch('?product=advanced');

  assert.equal(product.name, PRODUCTS.advanced.name);
});

test('getInitialSelection defaults private mentoring to the 10-class pack and essay collection bump', () => {
  const selection = getInitialSelection('private-mentoring', PRODUCTS['private-mentoring']);

  assert.deepEqual(selection, {
    pageSlug: 'private-mentoring',
    apiSlug: 'mentoring-pack',
    basePrice: 1070,
    price: 1070,
    packageIndex: 1,
    upsell: {
      slug: 'essay-collection',
      title: 'Add the Essay Collection',
      description: '25 essays scored 80+ · Immediate access',
      price: 79,
      badge: 'Optional add-on',
    },
    upsellSelected: false,
  });
});

test('getOrderBumpConfig returns the configured order bump per product', () => {
  assert.deepEqual(getOrderBumpConfig('blueprint'), {
    slug: 'essay-pack-10',
    title: 'Add the 10-essay pack',
    description: '10 x essay markings · Top 1% scorer feedback',
    price: 249,
    badge: 'Best value',
  });

  assert.deepEqual(getOrderBumpConfig('comprehensive'), {
    slug: 'mentoring-single',
    title: 'Add one 1:1 strategy class',
    description: 'Private strategy session with a top tutor before classes begin',
    price: 119,
    badge: 'Optional add-on',
  });

  assert.deepEqual(getOrderBumpConfig('advanced'), {
    slug: 'essay-collection',
    title: 'Add the Essay Collection',
    description: '25 essays scored 80+ · Immediate access',
    price: 79,
    badge: 'Optional add-on',
  });

  assert.equal(getOrderBumpConfig('mastery'), null);
});

test('checkout product prices stay in sync with payment-intent amounts', () => {
  const apiAmountsByPageSlug = {
    blueprint: createPaymentIntentHandler.AMOUNTS.blueprint,
    advanced: createPaymentIntentHandler.AMOUNTS.advanced,
    'essay-collection': createPaymentIntentHandler.AMOUNTS['essay-collection'],
    'essay-marking': createPaymentIntentHandler.AMOUNTS['essay-marking'],
    'essay-pack-10': createPaymentIntentHandler.AMOUNTS['essay-pack-10'],
    'starter-pack': createPaymentIntentHandler.AMOUNTS['starter-pack'],
    comprehensive: createPaymentIntentHandler.AMOUNTS.comprehensive,
    mastery: createPaymentIntentHandler.AMOUNTS.mastery,
    'private-mentoring-single': createPaymentIntentHandler.AMOUNTS['mentoring-single'],
    'private-mentoring-pack': createPaymentIntentHandler.AMOUNTS['mentoring-pack'],
  };

  assert.equal(PRODUCTS.blueprint.price * 100, apiAmountsByPageSlug.blueprint);
  assert.equal(PRODUCTS.advanced.price * 100, apiAmountsByPageSlug.advanced);
  assert.equal(PRODUCTS['essay-collection'].price * 100, apiAmountsByPageSlug['essay-collection']);
  assert.equal(PRODUCTS['essay-marking'].price * 100, apiAmountsByPageSlug['essay-marking']);
  assert.equal(PRODUCTS['essay-pack-10'].price * 100, apiAmountsByPageSlug['essay-pack-10']);
  assert.equal(PRODUCTS['starter-pack'].price * 100, apiAmountsByPageSlug['starter-pack']);
  assert.equal(PRODUCTS.comprehensive.price * 100, apiAmountsByPageSlug.comprehensive);
  assert.equal(PRODUCTS.mastery.price * 100, apiAmountsByPageSlug.mastery);
  assert.equal(PRODUCTS['private-mentoring'].packages[0].price * 100, apiAmountsByPageSlug['private-mentoring-single']);
  assert.equal(PRODUCTS['private-mentoring'].packages[1].price * 100, apiAmountsByPageSlug['private-mentoring-pack']);
});

test('renderSummaryMarkup renders standard products with included features', () => {
  const markup = renderSummaryMarkup(PRODUCTS.blueprint, getInitialSelection('blueprint', PRODUCTS.blueprint));

  assert.match(markup, /Rohan's Blueprint/);
  assert.match(markup, /What's included/);
  assert.match(markup, /\$599 AUD/);
});

test('renderSummaryMarkup renders mentoring selector with active default package', () => {
  const product = PRODUCTS['private-mentoring'];
  const markup = renderSummaryMarkup(product, getInitialSelection('private-mentoring', product));

  assert.match(markup, /Choose your package/);
  assert.match(markup, /type="radio"/);
  assert.match(markup, /role="radiogroup"/);
  assert.match(markup, /pkg-option pkg-option--active/);
  assert.match(markup, /\$1,070 AUD/);
});

test('renderSummaryMarkup keeps essay-marking summary focused on the core order', () => {
  const markup = renderSummaryMarkup(PRODUCTS['essay-marking'], getInitialSelection('essay-marking', PRODUCTS['essay-marking']));

  assert.doesNotMatch(markup, /checkout-upsell/);
  assert.match(markup, /Total due today/);
});

test('buildOrderBumpMarkup renders an unchecked opt-in card', () => {
  const markup = buildOrderBumpMarkup(getOrderBumpConfig('advanced'), getInitialSelection('advanced', PRODUCTS.advanced));

  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /id="order-bump-toggle"/);
  assert.match(markup, /Add the Essay Collection/);
  assert.match(markup, /\+\$79/);
  assert.doesNotMatch(markup, /checked/);
});

test('getPayButtonLabel reflects current amount', () => {
  assert.equal(getPayButtonLabel(347), 'Pay $347 AUD →');
  assert.equal(getPayButtonLabel(34.99), 'Pay $34.99 AUD →');
});

test('getSuccessMessage returns the correct post-payment copy for each product type', () => {
  assert.match(getSuccessMessage('blueprint'), /Google Drive/);
  assert.match(getSuccessMessage('essay-marking'), /upload your essay/);
  assert.match(getSuccessMessage('private-mentoring'), /booking link/);
  assert.match(getSuccessMessage('mastery'), /everything you need to get started/);
});

test('getSuccessActionMarkup renders essay-marking Tally CTA with fallback email', () => {
  const uploadUrl = buildEssayUploadUrl({
    paymentIntentId: 'pi_123',
    productSlug: 'essay-marking',
    upsellSlug: 'essay-collection',
  });
  const markup = getSuccessActionMarkup('essay-marking', {
    paymentIntentId: 'pi_123',
    productSlug: 'essay-marking',
    upsellSlug: 'essay-collection',
  });

  assert.ok(markup, 'should return markup for essay-marking');
  assert.match(markup, /success-tally-btn/);
  assert.match(markup, new RegExp(uploadUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(markup, /payment_intent=pi_123/);
  assert.match(markup, /product=essay-marking/);
  assert.match(markup, /upsell=essay-collection/);
  assert.match(markup, /essays@rohanstutoring\.com/);
  assert.match(markup, /success-fallback/);
});

test('buildEssayUploadUrl appends order context for Tally hidden fields', () => {
  assert.equal(
    buildEssayUploadUrl({
      paymentIntentId: 'pi_123',
      productSlug: 'essay-marking',
      upsellSlug: 'essay-collection',
      uploadToken: 'signed_token_123',
    }),
    'https://tally.so/r/zxQdMR?payment_intent=pi_123&product=essay-marking&upsell=essay-collection&upload_token=signed_token_123&source=checkout_success'
  );
});

test('getSuccessActionMarkup reassures essay-marking buyers about Essay Collection add-on delivery', () => {
  const markup = getSuccessActionMarkup('essay-marking', {
    paymentIntentId: 'pi_123',
    productSlug: 'essay-marking',
    upsellSlug: 'essay-collection',
    uploadToken: 'signed_token_123',
  });

  assert.match(markup, /upload_token=signed_token_123/);
  assert.match(markup, /Essay Collection add-on is confirmed/);
  assert.match(markup, /Google Drive/);
});

test('getSuccessActionMarkup renders essay-pack-10 email instructions', () => {
  const markup = getSuccessActionMarkup('essay-pack-10');
  assert.ok(markup, 'should return markup for essay-pack-10');
  assert.match(markup, /essays@rohanstutoring\.com/);
  assert.match(markup, /10 essays/);
});

test('getSuccessActionMarkup returns null for non-essay products', () => {
  assert.equal(getSuccessActionMarkup('blueprint'), null);
  assert.equal(getSuccessActionMarkup('mastery'), null);
  assert.equal(getSuccessActionMarkup('nonexistent'), null);
});

test('buildSuccessUrl preserves product and payment-intent ID without leaking the client secret', () => {
  const url = buildSuccessUrl(
    { pageSlug: 'blueprint' },
    'pi_123'
  );

  assert.equal(
    url,
    '/checkout/success?product=blueprint&payment_intent=pi_123'
  );
});

test('buildSuccessUrl preserves mentoring package slug for success-page analytics fallback', () => {
  const url = buildSuccessUrl(
    { pageSlug: 'private-mentoring', apiSlug: 'mentoring-single' },
    'pi_123'
  );

  assert.equal(
    url,
    '/checkout/success?product=private-mentoring&payment_intent=pi_123&package=mentoring-single'
  );
});

test('getSuccessState maps Stripe statuses to the right success-page copy', () => {
  assert.equal(getSuccessState('succeeded', 'blueprint').heading, 'Payment confirmed');
  assert.match(getSuccessState('succeeded', 'blueprint').message, /Google Drive/);
  assert.equal(getSuccessState('processing', 'blueprint').heading, 'Payment processing');
  assert.equal(getSuccessState('requires_payment_method', 'blueprint').heading, 'Payment not confirmed');
});

test('getSuccessPageTitle uses neutral and failure-aware browser titles', () => {
  assert.equal(getSuccessPageTitle('verifying'), "Checking Payment | Rohan's GAMSAT");
  assert.equal(getSuccessPageTitle('succeeded'), "Payment Confirmed | Rohan's GAMSAT");
  assert.equal(getSuccessPageTitle('requires_payment_method'), "Payment Not Confirmed | Rohan's GAMSAT");
});

test('buildPurchaseItems includes base and upsell products when checkout metadata has both', () => {
  assert.deepEqual(buildPurchaseItems('blueprint', 'essay-pack-10'), [
    {
      item_id: 'blueprint',
      item_name: "Rohan's Blueprint",
      price: 599,
      quantity: 1,
    },
    {
      item_id: 'essay-pack-10',
      item_name: 'S2 Essay Marking — 10-Essay Pack',
      price: 249,
      quantity: 1,
    },
  ]);
});

test('buildPurchaseItems maps mentoring package slugs to the matching package definition', () => {
  assert.deepEqual(buildPurchaseItems('mentoring-pack', 'essay-collection', 'private-mentoring'), [
    {
      item_id: 'mentoring-pack',
      item_name: '10-class pack',
      price: 1070,
      quantity: 1,
    },
    {
      item_id: 'essay-collection',
      item_name: 'Expert Essay Collection',
      price: 79,
      quantity: 1,
    },
  ]);
});

test('buildPurchaseItems falls back to the default mentoring package when success metadata omits the package slug', () => {
  assert.deepEqual(buildPurchaseItems('', '', 'private-mentoring'), [
    {
      item_id: 'private-mentoring',
      item_name: '10-class pack',
      price: 1070,
      quantity: 1,
    },
  ]);
});

test('getApiServerErrorMessage explains when HTML is returned instead of JSON', () => {
  const message = getApiServerErrorMessage('<!DOCTYPE html><html><body>404</body></html>');

  assert.match(message, /Vercel dev/);
  assert.match(message, /127\.0\.0\.1:3000/);
});

test('parseApiResponse returns parsed JSON for valid API responses', async () => {
  const result = await parseApiResponse({
    ok: true,
    text: async () => '{"clientSecret":"pi_secret_123"}',
  });

  assert.deepEqual(result, {
    ok: true,
    data: { clientSecret: 'pi_secret_123' },
  });
});

test('fetchCheckoutConfig returns the Stripe publishable key from the public config endpoint', async () => {
  global.fetch = async () => ({
    ok: true,
    text: async () => '{"stripePublishableKey":"pk_test_123"}',
  });

  await assert.doesNotReject(async () => {
    const config = await fetchCheckoutConfig();
    assert.deepEqual(config, { stripePublishableKey: 'pk_test_123' });
  });

  delete global.fetch;
});

test('fetchPaymentIntentStatus returns the parsed status payload', async () => {
  global.fetch = async () => ({
    ok: true,
    text: async () => '{"status":"succeeded","metadata":{"base_slug":"blueprint","upsell_slug":"essay-pack-10"}}',
  });

  try {
    const payload = await fetchPaymentIntentStatus('pi_123');

    assert.deepEqual(payload, {
      status: 'succeeded',
      metadata: {
        base_slug: 'blueprint',
        upsell_slug: 'essay-pack-10',
      },
    });
  } finally {
    delete global.fetch;
  }
});

test('parseApiResponse converts HTML error pages into a clear checkout-server message', async () => {
  const result = await parseApiResponse({
    ok: false,
    text: async () => '<!DOCTYPE html><html><body>404</body></html>',
  });

  assert.equal(result.ok, false);
  assert.match(result.data.error, /Checkout API not found on this server/);
});

test('getCustomerPayload returns email and full name for API submission', () => {
  const payload = getCustomerPayload({
    billingDetails: {
      email: 'jane@example.com',
      name: 'Jane Smith',
    },
  });

  assert.deepEqual(payload, {
    email: 'jane@example.com',
    customerName: 'Jane Smith',
  });
});

test('buildCheckoutPayload includes the primary slug and optional upsell fields', () => {
  const selection = getInitialSelection('comprehensive', PRODUCTS.comprehensive);
  selection.upsellSelected = true;
  selection.basePrice = 1549;
  selection.price = 1668;

  const payload = buildCheckoutPayload(selection, {
    billingDetails: {
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  });

  assert.deepEqual(payload, {
    slug: 'comprehensive',
    primaryProduct: {
      pageSlug: 'comprehensive',
      slug: 'comprehensive',
      price: 1549,
    },
    totalAmount: 1668,
    customerName: 'Jane Smith',
    email: 'jane@example.com',
    upsell: {
      slug: 'mentoring-single',
      price: 119,
      title: 'Add one 1:1 strategy class',
    },
    upsellSlug: 'mentoring-single',
    upsellPrice: 119,
    upsellSelected: true,
  });
});

test('EMAIL_PATTERN rejects obviously malformed addresses', () => {
  assert.equal(EMAIL_PATTERN.test('jane@example.com'), true);
  assert.equal(EMAIL_PATTERN.test('a@b.'), false);
  assert.equal(EMAIL_PATTERN.test('.@a.com'), false);
  assert.equal(EMAIL_PATTERN.test('not-an-email'), false);
});

test('payment intent handler origin allow-list covers production, own previews, and local dev', () => {
  const previousVercelUrl = process.env.VERCEL_URL;
  process.env.VERCEL_URL = 'rohanstutoring-redesign-git-main-rohan.vercel.app';

  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://rohanstutoring-redesign.vercel.app'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://rohanstutoring-redesign-git-main-rohan.vercel.app'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://preview-build.vercel.app'), false);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://evil.example.com'), false);

  if (previousVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = previousVercelUrl;
  }
});

test('payment intent handler validates customer details before Stripe call', () => {
  assert.deepEqual(
    createPaymentIntentHandler.normaliseCustomerDetails({
      email: 'jane@example.com',
      customerName: 'Jane Smith',
    }),
    {
      email: 'jane@example.com',
      customerName: 'Jane Smith',
    }
  );

  assert.equal(
    createPaymentIntentHandler.normaliseCustomerDetails({
      email: 'not-an-email',
      customerName: 'Jane Smith',
    }).error,
    'Please enter a valid email address.'
  );
});

test('payment intent handler resolves allowed checkout combinations and rejects invalid pairs', () => {
  assert.deepEqual(
    createPaymentIntentHandler.resolveCheckoutPurchase({
      slug: 'blueprint',
      upsellSlug: 'essay-pack-10',
    }),
    {
      amount: 84800,
      baseAmount: 59900,
      baseSlug: 'blueprint',
      upsellAmount: 24900,
      upsellSlug: 'essay-pack-10',
    }
  );

  assert.equal(
    createPaymentIntentHandler.resolveCheckoutPurchase({
      slug: 'blueprint',
      upsellSlug: 'essay-collection',
    }).error,
    'Invalid upsell combination: blueprint + essay-collection'
  );

  assert.equal(
    createPaymentIntentHandler.resolveCheckoutPurchase({
      slug: 's1-rescue-sprint',
    }).error,
    'This product is currently unavailable.'
  );
});

test('isProductAvailable flags sold-out sprint slugs as unavailable', () => {
  assert.equal(isProductAvailable('s1-rescue-sprint'), false);
  assert.equal(isProductAvailable('s2-rescue-sprint'), false);
  assert.equal(isProductAvailable('blueprint'), true);
});

test('payment intent handler rejects unavailable sprint products before creating a PaymentIntent', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  let createCalled = false;
  createPaymentIntentHandler.__setStripeFactory(() => ({
    paymentIntents: {
      create: async () => {
        createCalled = true;
        return { client_secret: 'pi_secret_should_not_exist' };
      },
    },
  }));

  try {
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://rohanstutoring.com',
      },
      body: {
        slug: 's2-rescue-sprint',
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    await createPaymentIntentHandler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'This product is currently unavailable.' });
    assert.equal(createCalled, false);
  } finally {
    createPaymentIntentHandler.__resetForTests();
  }
});

test('payment intent handler creates combined PaymentIntents with base and upsell metadata', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  const createPayloads = [];
  createPaymentIntentHandler.__setStripeFactory(() => ({
    paymentIntents: {
      create: async (payload) => {
        createPayloads.push(payload);
        return { client_secret: 'pi_secret_123' };
      },
    },
  }));

  try {
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://rohanstutoring.com',
      },
      body: {
        slug: 'comprehensive',
        upsellSlug: 'mentoring-single',
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    await createPaymentIntentHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { clientSecret: 'pi_secret_123' });
    assert.equal(createPayloads.length, 1);
    assert.equal(createPayloads[0].amount, 166800);
    assert.equal(createPayloads[0].description, "Rohan's GAMSAT - comprehensive + mentoring-single");
    assert.deepEqual(createPayloads[0].metadata, {
      product_slug: 'comprehensive',
      base_slug: 'comprehensive',
      upsell_slug: 'mentoring-single',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Smith',
    });
  } finally {
    createPaymentIntentHandler.__resetForTests();
  }
});

test('payment intent handler persists essay upload recovery metadata after creating an essay-marking intent', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.ESSAY_UPLOAD_TOKEN_SECRET = 'upload_secret_for_tests';

  const createPayloads = [];
  const updatePayloads = [];
  createPaymentIntentHandler.__setStripeFactory(() => ({
    paymentIntents: {
      create: async (payload) => {
        createPayloads.push(payload);
        return {
          id: 'pi_essay123',
          client_secret: 'pi_essay123_secret_abc',
          metadata: payload.metadata,
        };
      },
      update: async (id, payload) => {
        updatePayloads.push({ id, payload });
        return { id, metadata: payload.metadata };
      },
    },
  }));

  try {
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://rohanstutoring.com',
      },
      body: {
        slug: 'essay-marking',
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    await createPaymentIntentHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { clientSecret: 'pi_essay123_secret_abc' });
    assert.equal(createPayloads.length, 1);
    assert.equal(updatePayloads.length, 1);
    assert.equal(updatePayloads[0].id, 'pi_essay123');
    assert.equal(
      updatePayloads[0].payload.metadata.essay_upload_url,
      'https://tally.so/r/zxQdMR?payment_intent=pi_essay123&product=essay-marking&upload_token=4bf2dcdd522ca15ad48c9c7e6a08533f89e2ceaa2c8be2fa65b64e3568c860b6&source=stripe_metadata'
    );
    assert.equal(
      updatePayloads[0].payload.metadata.essay_upload_token,
      '4bf2dcdd522ca15ad48c9c7e6a08533f89e2ceaa2c8be2fa65b64e3568c860b6'
    );
    assert.equal(updatePayloads[0].payload.metadata.essay_upload_required, 'true');
    assert.match(updatePayloads[0].payload.description, /Upload essay after payment:/);
  } finally {
    createPaymentIntentHandler.__resetForTests();
    delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
  }
});

test('payment intent status handler origin allow-list matches checkout endpoint', () => {
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://preview-build.vercel.app'), false);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://evil.example.com'), false);
});

test('payment intent status handler validates Stripe payment-intent IDs', () => {
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId('pi_123'), true);
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId('seti_123'), false);
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId(''), false);
});

test('payment intent status handler returns status with safe checkout metadata', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.ESSAY_UPLOAD_TOKEN_SECRET = 'upload_secret_for_tests';

  paymentIntentStatusHandler.__setStripeFactory(() => ({
    paymentIntents: {
      retrieve: async (paymentIntentId) => {
        assert.equal(paymentIntentId, 'pi_123');
        return {
          status: 'succeeded',
          metadata: {
            product_slug: 'essay-marking',
            base_slug: 'essay-marking',
            upsell_slug: 'essay-collection',
            essay_upload_token: 'persisted_token',
            customer_email: 'jane@example.com',
            customer_name: 'Jane Smith',
          },
        };
      },
    },
  }));

  try {
    const req = {
      method: 'GET',
      headers: {
        origin: 'https://rohanstutoring.com',
      },
      query: {
        payment_intent: 'pi_123',
      },
    };
    const res = createJsonResponseRecorder();

    await paymentIntentStatusHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: 'succeeded',
      metadata: {
        base_slug: 'essay-marking',
        upsell_slug: 'essay-collection',
        essay_upload_token: 'persisted_token',
      },
    });
  } finally {
    paymentIntentStatusHandler.__resetForTests();
    delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
  }
});

test('public config handler origin allow-list matches checkout endpoint', () => {
  assert.equal(publicConfigHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://preview-build.vercel.app'), false);
  assert.equal(publicConfigHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://evil.example.com'), false);
});
