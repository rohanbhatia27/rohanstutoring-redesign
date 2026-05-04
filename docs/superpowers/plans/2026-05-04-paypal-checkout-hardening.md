# PayPal Checkout Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four PayPal launch risks without changing the static-site architecture or disturbing the existing Stripe checkout path.

**Architecture:** Keep PayPal server-side behavior inside Vercel API functions under `api/`. Add one shared validation helper so create, capture, status, and webhook flows use the same amount/currency/product rules. The browser should only render PayPal success after a server endpoint verifies the PayPal order against PayPal.

**Tech Stack:** Static HTML/CSS/vanilla JS, Vercel serverless functions, Node built-in `fetch`, PayPal Orders/Webhooks REST APIs, existing `node --test` suite.

---

## File Structure

- Modify: `site/vercel.json`
  - Allow PayPal SDK scripts, PayPal frames, PayPal network calls, and PayPal image assets in CSP.
- Modify: `site/tests/url-normalization.test.js`
  - Add CSP regression assertions for PayPal domains.
- Create: `site/api/lib/paypal-order-validation.js`
  - Shared helpers for PayPal amount formatting, purchase custom IDs, request validation, order/capture validation, and order ID validation.
- Modify: `site/api/create-paypal-order.js`
  - Use shared helper and persist enough product metadata into the PayPal order.
- Modify: `site/api/capture-paypal-order.js`
  - Validate request purchase, captured amount, currency, status, and custom ID before returning success.
- Create: `site/api/paypal-order-status.js`
  - Server-side status endpoint for the success page to verify `paypal_order`.
- Modify: `site/js/checkout.js`
  - Add `fetchPayPalOrderStatus()` and require server verification before rendering PayPal success.
- Create: `site/api/paypal-webhook.js`
  - Verify PayPal webhooks and process `PAYMENT.CAPTURE.COMPLETED` as a redirect-independent fulfillment signal.
- Create: `site/docs/ops/paypal-fulfillment.md`
  - Document required Vercel env vars, PayPal webhook setup, and manual fulfillment checks.
- Modify: `site/tests/checkout.test.js`
  - Add PayPal endpoint and client helper tests.

---

## Task 1: Fix PayPal CSP

**Files:**
- Modify: `site/vercel.json`
- Modify: `site/tests/url-normalization.test.js`

- [ ] **Step 1: Write the failing CSP regression test**

Add these assertions to the existing `CSP allows GA script and collection endpoints without unsafe inline scripts` test in `site/tests/url-normalization.test.js`:

```js
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypal\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypalobjects\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.paypalobjects\.com/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd site
node --test tests/url-normalization.test.js
```

Expected: FAIL because PayPal domains are missing from CSP.

- [ ] **Step 3: Update CSP**

In `site/vercel.json`, update only the CSP header value. Keep all existing Stripe, analytics, PostHog, Kit, Formspree, and Turnstile domains. Add PayPal domains to the relevant directives:

```txt
img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com;
script-src 'self' https://cdnjs.cloudflare.com https://js.stripe.com https://f.convertkit.com https://challenges.cloudflare.com https://www.googletagmanager.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://www.paypal.com https://www.paypalobjects.com;
connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.network https://q.stripe.com https://formspree.io https://app.kit.com https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://us.i.posthog.com https://eu.i.posthog.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://*.paypal.com;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://app.kit.com https://*.paypal.com;
```

Do not add `'unsafe-inline'` to `script-src`.

- [ ] **Step 4: Run CSP test**

Run:

```bash
cd site
node --test tests/url-normalization.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C site add vercel.json tests/url-normalization.test.js
git -C site commit -m "fix: allow paypal checkout csp"
```

---

## Task 2: Add Shared PayPal Validation

**Files:**
- Create: `site/api/lib/paypal-order-validation.js`
- Modify: `site/api/create-paypal-order.js`
- Modify: `site/tests/checkout.test.js`

- [ ] **Step 1: Write failing validation tests**

At the top of `site/tests/checkout.test.js`, add:

```js
const createPayPalOrderHandler = require('../api/create-paypal-order.js');
const capturePayPalOrderHandler = require('../api/capture-paypal-order.js');
const paypalValidation = require('../api/lib/paypal-order-validation.js');
```

Add these tests after the existing purchase validation tests:

```js
test('PayPal validation formats cents and custom IDs from server-side purchase data', () => {
  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase({
    slug: 'blueprint',
    upsellSlug: 'essay-pack-10',
  });

  assert.equal(paypalValidation.formatPayPalAmount(purchase.amount), '848.00');
  assert.equal(paypalValidation.getPayPalPurchaseCustomId(purchase), 'blueprint+essay-pack-10');
});

test('PayPal validation rejects mismatched capture amount and currency', () => {
  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase({
    slug: 'blueprint',
  });

  const mismatch = paypalValidation.validateCompletedPayPalOrder(
    {
      id: 'ORDER123',
      status: 'COMPLETED',
      purchase_units: [
        {
          custom_id: 'blueprint',
          payments: {
            captures: [
              {
                status: 'COMPLETED',
                amount: { value: '34.99', currency_code: 'AUD' },
              },
            ],
          },
        },
      ],
    },
    purchase,
    'ORDER123'
  );

  assert.equal(mismatch.error, 'Captured PayPal amount does not match checkout amount.');

  const wrongCurrency = paypalValidation.validateCompletedPayPalOrder(
    {
      id: 'ORDER123',
      status: 'COMPLETED',
      purchase_units: [
        {
          custom_id: 'blueprint',
          payments: {
            captures: [
              {
                status: 'COMPLETED',
                amount: { value: '599.00', currency_code: 'USD' },
              },
            ],
          },
        },
      ],
    },
    purchase,
    'ORDER123'
  );

  assert.equal(wrongCurrency.error, 'Captured PayPal currency does not match checkout currency.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: FAIL because `api/lib/paypal-order-validation.js` does not exist.

- [ ] **Step 3: Create validation helper**

Create `site/api/lib/paypal-order-validation.js`:

```js
const createPaymentIntentHandler = require('../create-payment-intent.js');

const PAYPAL_CURRENCY = 'AUD';
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{8,32}$/;

function formatPayPalAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function getPayPalPurchaseCustomId(purchase) {
  if (!purchase || !purchase.baseSlug) return '';
  return purchase.upsellSlug ? `${purchase.baseSlug}+${purchase.upsellSlug}` : purchase.baseSlug;
}

function isValidPayPalOrderId(value) {
  return PAYPAL_ORDER_ID_PATTERN.test(String(value || '').trim());
}

function resolvePayPalPurchaseFromBody(body) {
  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase(body || {});
  if (purchase.error) return { error: purchase.error };

  const customer = createPaymentIntentHandler.normaliseCustomerDetails(body || {});
  if (customer.error) return { error: customer.error };

  return { purchase, customer };
}

function getPrimaryPurchaseUnit(orderData) {
  return orderData && Array.isArray(orderData.purchase_units)
    ? orderData.purchase_units[0]
    : null;
}

function getPrimaryCapture(orderData) {
  const purchaseUnit = getPrimaryPurchaseUnit(orderData);
  const captures = purchaseUnit?.payments?.captures;
  return Array.isArray(captures) ? captures[0] : null;
}

function validateCompletedPayPalOrder(orderData, purchase, expectedOrderId = '') {
  if (!orderData || typeof orderData !== 'object') {
    return { error: 'Missing PayPal order data.' };
  }

  const safeExpectedOrderId = String(expectedOrderId || '').trim();
  if (safeExpectedOrderId && orderData.id !== safeExpectedOrderId) {
    return { error: 'Captured PayPal order ID does not match checkout order.' };
  }

  if (orderData.status !== 'COMPLETED') {
    return { error: 'Payment was not completed.' };
  }

  const purchaseUnit = getPrimaryPurchaseUnit(orderData);
  const capture = getPrimaryCapture(orderData);
  if (!purchaseUnit || !capture) {
    return { error: 'Missing PayPal capture details.' };
  }

  if (capture.status && capture.status !== 'COMPLETED') {
    return { error: 'PayPal capture was not completed.' };
  }

  const expectedAmount = formatPayPalAmount(purchase.amount);
  const capturedAmount = String(capture.amount?.value || '').trim();
  const capturedCurrency = String(capture.amount?.currency_code || '').trim().toUpperCase();
  const customId = String(purchaseUnit.custom_id || '').trim();
  const expectedCustomId = getPayPalPurchaseCustomId(purchase);

  if (capturedCurrency !== PAYPAL_CURRENCY) {
    return { error: 'Captured PayPal currency does not match checkout currency.' };
  }

  if (capturedAmount !== expectedAmount) {
    return { error: 'Captured PayPal amount does not match checkout amount.' };
  }

  if (customId !== expectedCustomId) {
    return { error: 'Captured PayPal product does not match checkout product.' };
  }

  return {
    orderID: orderData.id,
    amount: capturedAmount,
    currency: capturedCurrency,
    customId,
  };
}

module.exports = {
  PAYPAL_CURRENCY,
  formatPayPalAmount,
  getPayPalPurchaseCustomId,
  isValidPayPalOrderId,
  resolvePayPalPurchaseFromBody,
  validateCompletedPayPalOrder,
};
```

- [ ] **Step 4: Use helper in create order**

In `site/api/create-paypal-order.js`, add:

```js
const {
  PAYPAL_CURRENCY,
  formatPayPalAmount,
  getPayPalPurchaseCustomId,
} = require('./lib/paypal-order-validation.js');
```

Replace:

```js
const amountValue = (purchase.amount / 100).toFixed(2);
```

with:

```js
const amountValue = formatPayPalAmount(purchase.amount);
const customId = getPayPalPurchaseCustomId(purchase);
```

Replace the PayPal purchase unit amount/custom ID block with:

```js
amount: {
  currency_code: PAYPAL_CURRENCY,
  value: amountValue,
},
custom_id: customId,
description,
```

- [ ] **Step 5: Run checkout tests**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C site add api/lib/paypal-order-validation.js api/create-paypal-order.js tests/checkout.test.js
git -C site commit -m "test: cover paypal order validation"
```

---

## Task 3: Harden PayPal Capture

**Files:**
- Modify: `site/api/capture-paypal-order.js`
- Modify: `site/tests/checkout.test.js`

- [ ] **Step 1: Write failing capture endpoint tests**

Add these tests to `site/tests/checkout.test.js` after the validation tests:

```js
test('PayPal capture handler rejects completed orders with mismatched amounts', async () => {
  process.env.PAYPAL_CLIENT_ID = 'paypal_client_test';
  process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test';
  const previousFetch = global.fetch;
  const fetchCalls = [];

  global.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });

    if (String(url).includes('/v1/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'access_token_test' }),
      };
    }

    if (String(url).includes('/v2/checkout/orders/ORDER123/capture')) {
      return {
        ok: true,
        json: async () => ({
          id: 'ORDER123',
          status: 'COMPLETED',
          purchase_units: [
            {
              custom_id: 'blueprint',
              payments: {
                captures: [
                  {
                    status: 'COMPLETED',
                    amount: { value: '34.99', currency_code: 'AUD' },
                  },
                ],
              },
            },
          ],
        }),
      };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://rohanstutoring.com' },
      body: {
        orderID: 'ORDER123',
        slug: 'blueprint',
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    await capturePayPalOrderHandler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      error: 'Captured PayPal amount does not match checkout amount.',
    });
    assert.equal(fetchCalls.length, 2);
  } finally {
    global.fetch = previousFetch;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  }
});

test('PayPal capture handler accepts only validated completed checkout orders', async () => {
  process.env.PAYPAL_CLIENT_ID = 'paypal_client_test';
  process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test';
  const previousFetch = global.fetch;

  global.fetch = async (url) => {
    if (String(url).includes('/v1/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'access_token_test' }),
      };
    }

    if (String(url).includes('/v2/checkout/orders/ORDER123/capture')) {
      return {
        ok: true,
        json: async () => ({
          id: 'ORDER123',
          status: 'COMPLETED',
          purchase_units: [
            {
              custom_id: 'blueprint',
              payments: {
                captures: [
                  {
                    status: 'COMPLETED',
                    amount: { value: '599.00', currency_code: 'AUD' },
                  },
                ],
              },
            },
          ],
        }),
      };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://rohanstutoring.com' },
      body: {
        orderID: 'ORDER123',
        slug: 'blueprint',
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    await capturePayPalOrderHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: 'succeeded',
      orderID: 'ORDER123',
      metadata: {
        base_slug: 'blueprint',
        upsell_slug: '',
      },
    });
  } finally {
    global.fetch = previousFetch;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: FAIL because `capture-paypal-order.js` still returns success for mismatched captures and does not return metadata.

- [ ] **Step 3: Update capture handler**

In `site/api/capture-paypal-order.js`, change imports to:

```js
const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  isValidPayPalOrderId,
  resolvePayPalPurchaseFromBody,
  validateCompletedPayPalOrder,
} = require('./lib/paypal-order-validation.js');
```

Replace lines that read `baseSlug`, `upsellSlug`, `customerName`, and `email` directly from the body with:

```js
if (!isValidPayPalOrderId(orderID)) {
  return res.status(400).json({ error: 'Invalid PayPal order ID.' });
}

const resolved = resolvePayPalPurchaseFromBody(body);
if (resolved.error) {
  return res.status(400).json({ error: resolved.error });
}

const { purchase, customer } = resolved;
```

After `const captureData = await captureResponse.json();`, replace the current status-only validation with:

```js
const validation = validateCompletedPayPalOrder(captureData, purchase, orderID);
if (validation.error) {
  console.error('PayPal capture validation failed:', validation.error);
  return res.status(400).json({ error: validation.error });
}
```

Replace the log object with:

```js
console.log('PayPal order captured:', {
  orderID: validation.orderID,
  status: 'COMPLETED',
  amount: validation.amount,
  currency: validation.currency,
  baseSlug: purchase.baseSlug,
  upsellSlug: purchase.upsellSlug || null,
  customerName: customer.customerName,
  email: customer.email,
  fulfillmentRequired: true,
});
```

Replace the response body with:

```js
return res.status(200).json({
  status: 'succeeded',
  orderID: validation.orderID,
  metadata: {
    base_slug: purchase.baseSlug,
    upsell_slug: purchase.upsellSlug || '',
  },
});
```

- [ ] **Step 4: Run capture tests**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C site add api/capture-paypal-order.js tests/checkout.test.js
git -C site commit -m "fix: validate paypal capture details"
```

---

## Task 4: Verify PayPal Success Server-Side

**Files:**
- Create: `site/api/paypal-order-status.js`
- Modify: `site/js/checkout.js`
- Modify: `site/tests/checkout.test.js`

- [ ] **Step 1: Write failing server status tests**

At the top of `site/tests/checkout.test.js`, add:

```js
const paypalOrderStatusHandler = require('../api/paypal-order-status.js');
```

Add:

```js
test('PayPal order status handler rejects invalid order IDs before PayPal calls', async () => {
  const previousFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  try {
    const req = {
      method: 'GET',
      headers: { origin: 'https://rohanstutoring.com' },
      query: {
        paypal_order: '../bad',
        product: 'blueprint',
      },
    };
    const res = createJsonResponseRecorder();

    await paypalOrderStatusHandler(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid PayPal order ID.' });
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = previousFetch;
  }
});

test('PayPal order status handler verifies completed order with PayPal before returning success', async () => {
  process.env.PAYPAL_CLIENT_ID = 'paypal_client_test';
  process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test';
  const previousFetch = global.fetch;

  global.fetch = async (url) => {
    if (String(url).includes('/v1/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'access_token_test' }),
      };
    }

    if (String(url).includes('/v2/checkout/orders/ORDER123')) {
      return {
        ok: true,
        json: async () => ({
          id: 'ORDER123',
          status: 'COMPLETED',
          purchase_units: [
            {
              custom_id: 'blueprint',
              payments: {
                captures: [
                  {
                    status: 'COMPLETED',
                    amount: { value: '599.00', currency_code: 'AUD' },
                  },
                ],
              },
            },
          ],
        }),
      };
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const req = {
      method: 'GET',
      headers: { origin: 'https://rohanstutoring.com' },
      query: {
        paypal_order: 'ORDER123',
        product: 'blueprint',
      },
    };
    const res = createJsonResponseRecorder();

    await paypalOrderStatusHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: 'succeeded',
      orderID: 'ORDER123',
      metadata: {
        base_slug: 'blueprint',
        upsell_slug: '',
      },
    });
  } finally {
    global.fetch = previousFetch;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: FAIL because `api/paypal-order-status.js` does not exist.

- [ ] **Step 3: Create status endpoint**

Create `site/api/paypal-order-status.js`:

```js
const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  isValidPayPalOrderId,
  validateCompletedPayPalOrder,
} = require('./lib/paypal-order-validation.js');

const { isAllowedOrigin, resolveCheckoutPurchase } = createPaymentIntentHandler;

async function paypalOrderStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query || {};
  const orderID = String(query.paypal_order || '').trim();
  if (!isValidPayPalOrderId(orderID)) {
    return res.status(400).json({ error: 'Invalid PayPal order ID.' });
  }

  const productSlug = String(query.package || query.product || '').trim();
  const upsellSlug = String(query.upsell || '').trim();
  const purchase = resolveCheckoutPurchase({
    slug: productSlug,
    upsellSlug,
  });

  if (purchase.error) {
    return res.status(400).json({ error: purchase.error });
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const orderResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));
      console.error('PayPal order status failed:', errorData);
      return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
    }

    const orderData = await orderResponse.json();
    const validation = validateCompletedPayPalOrder(orderData, purchase, orderID);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    return res.status(200).json({
      status: 'succeeded',
      orderID: validation.orderID,
      metadata: {
        base_slug: purchase.baseSlug,
        upsell_slug: purchase.upsellSlug || '',
      },
    });
  } catch (err) {
    console.error('PayPal order status error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
  }
}

paypalOrderStatusHandler.isAllowedOrigin = isAllowedOrigin;

module.exports = paypalOrderStatusHandler;
```

- [ ] **Step 4: Add client helper test**

In the `checkout.js` import destructuring at the top of `site/tests/checkout.test.js`, add:

```js
  fetchPayPalOrderStatus,
```

Add:

```js
test('fetchPayPalOrderStatus verifies PayPal success through the API endpoint', async () => {
  const previousFetch = global.fetch;

  global.fetch = async (url) => {
    assert.equal(
      String(url),
      '/api/paypal-order-status?paypal_order=ORDER123&product=private-mentoring&package=mentoring-pack&upsell=essay-collection'
    );

    return {
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        status: 'succeeded',
        orderID: 'ORDER123',
        metadata: {
          base_slug: 'mentoring-pack',
          upsell_slug: 'essay-collection',
        },
      }),
    };
  };

  try {
    const payload = await fetchPayPalOrderStatus({
      orderID: 'ORDER123',
      productSlug: 'private-mentoring',
      packageSlug: 'mentoring-pack',
      upsellSlug: 'essay-collection',
    });

    assert.deepEqual(payload, {
      status: 'succeeded',
      orderID: 'ORDER123',
      metadata: {
        base_slug: 'mentoring-pack',
        upsell_slug: 'essay-collection',
      },
    });
  } finally {
    global.fetch = previousFetch;
  }
});
```

- [ ] **Step 5: Add client helper and export it**

In `site/js/checkout.js`, add near `fetchPaymentIntentStatus`:

```js
async function fetchPayPalOrderStatus({
  orderID = '',
  productSlug = '',
  packageSlug = '',
  upsellSlug = '',
} = {}) {
  const params = new URLSearchParams();
  params.set('paypal_order', String(orderID || '').trim());
  if (productSlug) params.set('product', String(productSlug).trim());
  if (packageSlug) params.set('package', String(packageSlug).trim());
  if (upsellSlug) params.set('upsell', String(upsellSlug).trim());

  const response = await global.fetch(`/api/paypal-order-status?${params.toString()}`);
  const result = await parseApiResponse(response);
  if (!result.ok) {
    throw new Error(result.data.error || 'We could not verify this PayPal payment.');
  }

  return result.data;
}
```

Add `fetchPayPalOrderStatus` to the `exported` object.

- [ ] **Step 6: Require server verification before PayPal success render**

In `initSuccessPage()`, replace the current `if (paypalOrderId) { ... return; }` block with:

```js
if (paypalOrderId) {
  renderState(SUCCESS_STATES.verifying, 'verifying');

  try {
    const packageSlug = params.get('package') || '';
    const upsellSlug = params.get('upsell') || '';
    const statusPayload = await fetchPayPalOrderStatus({
      orderID: paypalOrderId,
      productSlug,
      packageSlug,
      upsellSlug,
    });
    const metadata = statusPayload.metadata || {};
    const successProductSlug = metadata.base_slug || packageSlug || productSlug;
    const successMessageProductSlug = PRODUCTS[successProductSlug] ? successProductSlug : productSlug;
    const verifiedUpsellSlug = metadata.upsell_slug || upsellSlug || '';
    const state = getSuccessState(statusPayload.status, successMessageProductSlug);

    renderState(state, statusPayload.status);
    if (statusPayload.status === 'succeeded') {
      renderSuccessAction(successMessageProductSlug, {
        paymentIntentId: paypalOrderId,
        productSlug: successMessageProductSlug,
        upsellSlug: verifiedUpsellSlug,
      });
      if (typeof window.gtag === 'function') {
        const items = buildPurchaseItems(successProductSlug, verifiedUpsellSlug, productSlug);
        window.gtag('event', 'purchase', {
          transaction_id: paypalOrderId,
          currency: 'AUD',
          value: items.reduce((t, i) => t + (Number(i.price) || 0), 0) || undefined,
          items,
        });
      }
      if (typeof window.posthog !== 'undefined') {
        const items = buildPurchaseItems(successProductSlug, verifiedUpsellSlug, productSlug);
        window.posthog.capture('checkout_completed', {
          transaction_id: paypalOrderId,
          currency: 'AUD',
          value: items.reduce((t, i) => t + (Number(i.price) || 0), 0) || undefined,
          product: successMessageProductSlug,
          upsell_slug: verifiedUpsellSlug || null,
          payment_method: 'paypal',
        });
      }
    }
  } catch (error) {
    renderState(SUCCESS_STATES.failed, 'failed');
  }
  return;
}
```

- [ ] **Step 7: Run checkout tests**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git -C site add api/paypal-order-status.js js/checkout.js tests/checkout.test.js
git -C site commit -m "fix: verify paypal success server side"
```

---

## Task 5: Add Redirect-Independent PayPal Fulfillment Signal

**Files:**
- Create: `site/api/paypal-webhook.js`
- Modify: `site/tests/checkout.test.js`
- Create: `site/docs/ops/paypal-fulfillment.md`

- [ ] **Step 1: Write failing webhook tests**

At the top of `site/tests/checkout.test.js`, add:

```js
const paypalWebhookHandler = require('../api/paypal-webhook.js');
```

Add:

```js
test('PayPal webhook rejects requests before verification when webhook ID is missing', async () => {
  const req = {
    method: 'POST',
    headers: {},
    body: {},
  };
  const res = createJsonResponseRecorder();

  await paypalWebhookHandler(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'PayPal webhook is not configured.' });
});

test('PayPal webhook verifies signature and acknowledges capture completed events', async () => {
  process.env.PAYPAL_CLIENT_ID = 'paypal_client_test';
  process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test';
  process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_test';
  const previousFetch = global.fetch;
  const calls = [];

  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/v1/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'access_token_test' }),
      };
    }

    if (String(url).includes('/v1/notifications/verify-webhook-signature')) {
      return {
        ok: true,
        json: async () => ({ verification_status: 'SUCCESS' }),
      };
    }

    return {
      ok: false,
      json: async () => ({}),
    };
  };

  try {
    const req = {
      method: 'POST',
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-transmission-id': 'transmission_id_test',
        'paypal-transmission-sig': 'signature_test',
        'paypal-transmission-time': '2026-05-04T00:00:00Z',
      },
      body: {
        id: 'WH-123',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE123',
          amount: { value: '599.00', currency_code: 'AUD' },
          supplementary_data: {
            related_ids: {
              order_id: 'ORDER123',
            },
          },
        },
      },
    };
    const res = createJsonResponseRecorder();

    await paypalWebhookHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { received: true });
    assert.equal(
      calls.some((call) => call.url.includes('/v1/notifications/verify-webhook-signature')),
      true
    );
  } finally {
    global.fetch = previousFetch;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_WEBHOOK_ID;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: FAIL because `api/paypal-webhook.js` does not exist.

- [ ] **Step 3: Create webhook endpoint**

Create `site/api/paypal-webhook.js`:

```js
const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');

function getHeader(headers, name) {
  const lowerName = String(name).toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === lowerName);
  return entry ? String(entry[1] || '') : '';
}

async function verifyPayPalWebhook(req, eventBody) {
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!webhookId) {
    return { error: 'PayPal webhook is not configured.' };
  }

  const accessToken = await getPayPalAccessToken();
  const verificationResponse = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: getHeader(req.headers, 'paypal-auth-algo'),
      cert_url: getHeader(req.headers, 'paypal-cert-url'),
      transmission_id: getHeader(req.headers, 'paypal-transmission-id'),
      transmission_sig: getHeader(req.headers, 'paypal-transmission-sig'),
      transmission_time: getHeader(req.headers, 'paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: eventBody,
    }),
  });

  if (!verificationResponse.ok) {
    return { error: 'PayPal webhook verification failed.' };
  }

  const verification = await verificationResponse.json();
  if (verification.verification_status !== 'SUCCESS') {
    return { error: 'PayPal webhook signature was not verified.' };
  }

  return { ok: true };
}

async function paypalWebhookHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventBody = req.body && typeof req.body === 'object' ? req.body : null;
  if (!eventBody) {
    return res.status(400).json({ error: 'Missing or invalid JSON body' });
  }

  try {
    const verification = await verifyPayPalWebhook(req, eventBody);
    if (verification.error) {
      const statusCode = verification.error === 'PayPal webhook is not configured.' ? 500 : 400;
      return res.status(statusCode).json({ error: verification.error });
    }

    if (eventBody.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = eventBody.resource || {};
      const relatedIds = resource.supplementary_data?.related_ids || {};
      console.log('PayPal capture completed webhook:', {
        eventId: eventBody.id,
        captureId: resource.id,
        orderID: relatedIds.order_id || null,
        amount: resource.amount?.value || null,
        currency: resource.amount?.currency_code || null,
        fulfillmentRequired: true,
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayPal webhook error:', err.message);
    return res.status(500).json({ error: 'PayPal webhook processing failed.' });
  }
}

paypalWebhookHandler.verifyPayPalWebhook = verifyPayPalWebhook;

module.exports = paypalWebhookHandler;
```

- [ ] **Step 4: Document operations**

Create `site/docs/ops/paypal-fulfillment.md`:

```md
# PayPal Fulfillment

## Required Vercel Environment Variables

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- Optional for sandbox testing only: `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`

Production should use live PayPal credentials with the default `https://api-m.paypal.com` API base.

## Required PayPal Webhook

Create a PayPal app webhook for:

- `PAYMENT.CAPTURE.COMPLETED`

Webhook URL:

```txt
https://rohanstutoring.com/api/paypal-webhook
```

Copy the webhook ID into Vercel as `PAYPAL_WEBHOOK_ID`.

## Manual Fulfillment Check

PayPal purchases should be treated as paid only when either:

- `/api/capture-paypal-order` validates and returns `status: "succeeded"`, or
- PayPal sends a verified `PAYMENT.CAPTURE.COMPLETED` webhook.

The durable source of truth is PayPal's merchant dashboard. Use the PayPal order ID to find the transaction if a customer reaches out and the browser redirect did not complete.

## Pre-Live Smoke Test

1. Confirm production env vars exist:

```bash
cd site
vercel env ls
```

2. Confirm PayPal button loads on `/checkout?product=blueprint`.
3. Complete one PayPal sandbox or live low-value test order, depending on the active credentials.
4. Confirm `/checkout/success?product=blueprint&paypal_order=<ORDER_ID>` verifies server-side before showing success.
5. Confirm a PayPal `PAYMENT.CAPTURE.COMPLETED` webhook delivery appears in PayPal developer dashboard.
```

- [ ] **Step 5: Run checkout tests**

Run:

```bash
cd site
node --test tests/checkout.test.js
```

Expected: PASS.

- [ ] **Step 6: Add production env reminder**

Run:

```bash
cd site
vercel env ls
```

Expected: `PAYPAL_WEBHOOK_ID` is missing until added in Vercel. Do not deploy PayPal fulfillment as complete until it is configured.

- [ ] **Step 7: Commit**

```bash
git -C site add api/paypal-webhook.js tests/checkout.test.js docs/ops/paypal-fulfillment.md
git -C site commit -m "feat: verify paypal webhooks"
```

---

## Task 6: End-to-End Verification

**Files:**
- No code changes expected unless verification finds a regression.

- [ ] **Step 1: Run full unit suite**

```bash
cd site
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Start local preview**

```bash
cd site
python3 -m http.server 8000
```

Expected: local server runs on `http://127.0.0.1:8000`.

- [ ] **Step 3: Browser-check checkout**

Open:

```txt
http://127.0.0.1:8000/checkout?product=blueprint
```

Expected:

- Card checkout still renders.
- PayPal tab appears when `/api/public-config` returns `paypalClientId`.
- No CSP errors appear for PayPal SDK assets.
- Switching between Card and PayPal does not lose entered customer details.

- [ ] **Step 4: Browser-check forged success URL**

Open:

```txt
http://127.0.0.1:8000/checkout/success?product=blueprint&paypal_order=FAKEORDER123
```

Expected:

- Page shows verification first.
- Page does not render a paid success state.
- Page ends in the failed state.

- [ ] **Step 5: Deploy preview**

```bash
cd site
vercel deploy
```

Expected: preview deploy succeeds.

- [ ] **Step 6: Check preview checkout**

Open the preview checkout URL printed by Vercel:

```txt
<preview-url>/checkout?product=blueprint
```

Expected:

- CSP allows PayPal SDK.
- PayPal button renders.
- Card path still renders.

- [ ] **Step 7: Production deployment gate**

Before `vercel deploy --prod`, confirm:

```bash
cd site
vercel env ls
```

Expected:

- `PAYPAL_CLIENT_ID` exists in Production.
- `PAYPAL_CLIENT_SECRET` exists in Production.
- `PAYPAL_WEBHOOK_ID` exists in Production.
- `PAYPAL_API_BASE` is absent for live credentials, or set to `https://api-m.sandbox.paypal.com` only for sandbox credentials.

- [ ] **Step 8: Commit verification notes**

If manual verification is completed, append a short dated note to `site/docs/launch-verification-2026-04-24.md` or create a new dated verification doc if preferred.

Commit only if a doc was changed:

```bash
git -C site add docs
git -C site commit -m "docs: record paypal checkout verification"
```

---

## Self-Review

- Finding 1 coverage: Task 1 updates CSP and adds regression tests.
- Finding 2 coverage: Tasks 2 and 3 add shared validation and enforce amount/currency/product checks in capture.
- Finding 3 coverage: Task 4 adds server-side PayPal status verification before success UI renders.
- Finding 4 coverage: Task 5 adds a verified PayPal webhook and operations doc so fulfillment is not dependent on browser redirect alone.
- Existing Stripe risk: Stripe files remain untouched except for imports reused from `create-payment-intent.js`; Stripe tests should remain green.
- Architecture risk: No new framework, build step, package, or client-side secret is introduced.
