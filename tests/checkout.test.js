const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMAIL_PATTERN,
  PRODUCTS,
  fmtPrice,
  getProductFromSearch,
  getInitialSelection,
  renderSummaryMarkup,
  getPayButtonLabel,
  getSuccessMessage,
  getSuccessActionMarkup,
  buildSuccessUrl,
  getSuccessState,
  getApiServerErrorMessage,
  parseApiResponse,
  fetchCheckoutConfig,
  getCustomerPayload,
} = require('../js/checkout.js');
const createPaymentIntentHandler = require('../api/create-payment-intent.js');
const paymentIntentStatusHandler = require('../api/payment-intent-status.js');
const publicConfigHandler = require('../api/public-config.js');

test('fmtPrice formats whole and decimal amounts', () => {
  assert.equal(fmtPrice(599), '599');
  assert.equal(fmtPrice(1070), '1,070');
  assert.equal(fmtPrice(34.99), '34.99');
});

test('getProductFromSearch resolves a valid product slug', () => {
  const product = getProductFromSearch('?product=advanced');

  assert.equal(product.name, PRODUCTS.advanced.name);
});

test('getInitialSelection defaults private mentoring to the 10-class pack', () => {
  const selection = getInitialSelection('private-mentoring', PRODUCTS['private-mentoring']);

  assert.deepEqual(selection, {
    pageSlug: 'private-mentoring',
    apiSlug: 'mentoring-pack',
    price: 1070,
    packageIndex: 1,
  });
});

test('checkout product prices stay in sync with payment-intent amounts', () => {
  const apiAmountsByPageSlug = {
    blueprint: createPaymentIntentHandler.AMOUNTS.blueprint,
    advanced: createPaymentIntentHandler.AMOUNTS.advanced,
    'essay-collection': createPaymentIntentHandler.AMOUNTS['essay-collection'],
    'essay-marking': createPaymentIntentHandler.AMOUNTS['essay-marking'],
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
  const markup = getSuccessActionMarkup('essay-marking');
  assert.ok(markup, 'should return markup for essay-marking');
  assert.match(markup, /success-tally-btn/);
  assert.match(markup, /tally\.so/);
  assert.match(markup, /essays@rohanstutoring\.com/);
  assert.match(markup, /success-fallback/);
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

test('getSuccessState maps Stripe statuses to the right success-page copy', () => {
  assert.equal(getSuccessState('succeeded', 'blueprint').heading, 'Payment confirmed');
  assert.match(getSuccessState('succeeded', 'blueprint').message, /Google Drive/);
  assert.equal(getSuccessState('processing', 'blueprint').heading, 'Payment processing');
  assert.equal(getSuccessState('requires_payment_method', 'blueprint').heading, 'Payment not confirmed');
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

test('EMAIL_PATTERN rejects obviously malformed addresses', () => {
  assert.equal(EMAIL_PATTERN.test('jane@example.com'), true);
  assert.equal(EMAIL_PATTERN.test('a@b.'), false);
  assert.equal(EMAIL_PATTERN.test('.@a.com'), false);
  assert.equal(EMAIL_PATTERN.test('not-an-email'), false);
});

test('payment intent handler origin allow-list covers production, preview, and local dev', () => {
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://preview-build.vercel.app'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(createPaymentIntentHandler.isAllowedOrigin('https://evil.example.com'), false);
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

test('payment intent status handler origin allow-list matches checkout endpoint', () => {
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://preview-build.vercel.app'), true);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(paymentIntentStatusHandler.isAllowedOrigin('https://evil.example.com'), false);
});

test('payment intent status handler validates Stripe payment-intent IDs', () => {
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId('pi_123'), true);
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId('seti_123'), false);
  assert.equal(paymentIntentStatusHandler.isValidPaymentIntentId(''), false);
});

test('public config handler origin allow-list matches checkout endpoint', () => {
  assert.equal(publicConfigHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://preview-build.vercel.app'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://evil.example.com'), false);
});
