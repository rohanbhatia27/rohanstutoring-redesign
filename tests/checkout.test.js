const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PRODUCTS,
  fmtPrice,
  getProductFromSearch,
  getInitialSelection,
  renderSummaryMarkup,
  getPayButtonLabel,
  getSuccessMessage,
  getApiServerErrorMessage,
  parseApiResponse,
} = require('../js/checkout.js');

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
  assert.match(markup, /pkg-option pkg-option--active/);
  assert.match(markup, /\$1,070 AUD/);
});

test('getPayButtonLabel reflects current amount', () => {
  assert.equal(getPayButtonLabel(347), 'Pay $347 AUD →');
  assert.equal(getPayButtonLabel(34.99), 'Pay $34.99 AUD →');
});

test('getSuccessMessage returns the correct post-payment copy for each product type', () => {
  assert.match(getSuccessMessage('blueprint'), /Google Drive/);
  assert.match(getSuccessMessage('essay-marking'), /essays@rohanstutoring\.com/);
  assert.match(getSuccessMessage('private-mentoring'), /booking link/);
  assert.match(getSuccessMessage('mastery'), /everything you need to get started/);
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

test('parseApiResponse converts HTML error pages into a clear checkout-server message', async () => {
  const result = await parseApiResponse({
    ok: false,
    text: async () => '<!DOCTYPE html><html><body>404</body></html>',
  });

  assert.equal(result.ok, false);
  assert.match(result.data.error, /Checkout API not found on this server/);
});
