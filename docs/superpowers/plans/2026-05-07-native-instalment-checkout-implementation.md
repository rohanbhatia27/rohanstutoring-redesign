# Native Instalment Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native `Pay in full / Pay in 4 monthly payments` selector for `comprehensive` and `mastery`, while keeping the current one-off card flow intact and routing instalments into Stripe Checkout subscription sessions.

**Architecture:** Keep the existing Stripe Elements + PaymentIntent path for one-off payments. Add a second checkout mode that swaps the card form for an instalment summary card and calls a new server route that creates a Stripe Checkout Session in `subscription` mode with server-side Stripe price IDs and first-invoice-only add-on handling.

**Tech Stack:** Static HTML, vanilla JS, CSS, Node/Vercel serverless API routes, Stripe Billing + Checkout Sessions, node:test

---

### Task 1: Add failing tests for eligible instalment-mode UI state

**Files:**
- Modify: `site/tests/checkout.test.js`
- Test: `site/tests/checkout.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests near the checkout UI unit coverage for new helpers and state:

```js
test('getPaymentModeOptions returns instalment mode for comprehensive and mastery only', () => {
  assert.deepEqual(getPaymentModeOptions('comprehensive'), ['full', 'instalments']);
  assert.deepEqual(getPaymentModeOptions('mastery'), ['full', 'instalments']);
  assert.deepEqual(getPaymentModeOptions('advanced'), ['full']);
});

test('getInstalmentPlanSummary returns first payment and future monthly copy for comprehensive', () => {
  const selection = getInitialSelection('comprehensive', PRODUCTS.comprehensive);
  const summary = getInstalmentPlanSummary(selection);

  assert.equal(summary.dueToday, 449);
  assert.equal(summary.futurePaymentAmount, 449);
  assert.match(summary.futurePaymentCopy, /3 monthly payments/);
});

test('getInstalmentPlanSummary adds the comprehensive mentoring bump to the first instalment only', () => {
  const selection = getInitialSelection('comprehensive', PRODUCTS.comprehensive);
  selection.paymentMode = 'instalments';
  selection.upsellSelected = true;
  updateSelectionPrice(selection);

  const summary = getInstalmentPlanSummary(selection);

  assert.equal(summary.dueToday, 548);
  assert.equal(summary.futurePaymentAmount, 449);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL with missing helper exports such as `getPaymentModeOptions` or `getInstalmentPlanSummary`.

- [ ] **Step 3: Write minimal implementation**

Implement the smallest new config + helpers in `site/js/checkout.js`:

```js
const INSTALMENT_PLANS = {
  comprehensive: {
    count: 4,
    firstPayment: 449,
    recurringPayment: 449,
    priceEnvKey: 'STRIPE_PRICE_COMPREHENSIVE_INSTALMENT',
  },
  mastery: {
    count: 4,
    firstPayment: 649,
    recurringPayment: 649,
    priceEnvKey: 'STRIPE_PRICE_MASTERY_INSTALMENT',
  },
};

function getPaymentModeOptions(productSlug) {
  return INSTALMENT_PLANS[productSlug] ? ['full', 'instalments'] : ['full'];
}

function getInstalmentPlanSummary(selection) {
  const plan = INSTALMENT_PLANS[selection.pageSlug];
  const upsellToday = selection.pageSlug === 'comprehensive' && selection.upsellSelected && selection.upsell
    ? selection.upsell.price
    : 0;

  return {
    dueToday: plan.firstPayment + upsellToday,
    futurePaymentAmount: plan.recurringPayment,
    futurePaymentCount: plan.count - 1,
    futurePaymentCopy: `Then ${plan.count - 1} monthly payments of $${fmtPrice(plan.recurringPayment)}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: new tests PASS, others may still fail for unimplemented UI/API paths.

- [ ] **Step 5: Commit**

```bash
git -C site add js/checkout.js tests/checkout.test.js
git -C site commit -m "test: add instalment mode checkout state coverage"
```

### Task 2: Add failing tests for instalment summary markup and CTA mode switching

**Files:**
- Modify: `site/tests/checkout.test.js`
- Modify: `site/checkout/index.html`
- Modify: `site/css/checkout.css`
- Modify: `site/js/checkout.js`

- [ ] **Step 1: Write the failing tests**

Add markup-focused tests:

```js
test('buildPaymentModeMarkup renders full and instalment options for eligible products', () => {
  const markup = buildPaymentModeMarkup('comprehensive', getInitialSelection('comprehensive', PRODUCTS.comprehensive));

  assert.match(markup, /Pay in full/);
  assert.match(markup, /Pay in 4 monthly payments/);
  assert.match(markup, /payment-mode-toggle/);
});

test('buildInstalmentSummaryMarkup explains due today and future payments', () => {
  const selection = getInitialSelection('mastery', PRODUCTS.mastery);
  selection.paymentMode = 'instalments';

  const markup = buildInstalmentSummaryMarkup(selection);

  assert.match(markup, /Due today/);
  assert.match(markup, /Then 3 monthly payments/);
  assert.match(markup, /Stripe will email you to update your card/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL because the new markup builders do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add the markup helpers and HTML slots:

```html
<div id="payment-mode-slot" hidden></div>
<div id="instalment-summary-slot" hidden></div>
```

```js
function buildPaymentModeMarkup(productSlug, selection) {
  if (getPaymentModeOptions(productSlug).length < 2) return '';
  return `...`;
}

function buildInstalmentSummaryMarkup(selection) {
  const summary = getInstalmentPlanSummary(selection);
  return `...`;
}
```

Update CTA label logic:

```js
function getPrimaryButtonLabel(selection) {
  if (selection.paymentMode === 'instalments') {
    return 'Continue to secure instalment checkout';
  }
  return getPayButtonLabel(selection.price);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: new markup tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C site add checkout/index.html css/checkout.css js/checkout.js tests/checkout.test.js
git -C site commit -m "feat: add checkout payment mode selector UI"
```

### Task 3: Add failing tests for instalment session API validation

**Files:**
- Create: `site/api/create-instalment-session.js`
- Modify: `site/tests/checkout.test.js`

- [ ] **Step 1: Write the failing tests**

Add server-side tests:

```js
const createInstalmentSessionHandler = require('../api/create-instalment-session.js');

test('instalment session handler rejects unsupported product slugs', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://rohanstutoring.com' },
    body: {
      slug: 'advanced',
      paymentMode: 'instalments',
      customerName: 'Jane Smith',
      email: 'jane@example.com',
    },
  };
  const res = createJsonResponseRecorder();

  await createInstalmentSessionHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /not available/i);
});

test('instalment session handler rejects invalid modes', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://rohanstutoring.com' },
    body: {
      slug: 'comprehensive',
      paymentMode: 'full',
      customerName: 'Jane Smith',
      email: 'jane@example.com',
    },
  };
  const res = createJsonResponseRecorder();

  await createInstalmentSessionHandler(req, res);

  assert.equal(res.statusCode, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL because `site/api/create-instalment-session.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create the new route with validation-only behavior first:

```js
const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const ELIGIBLE_INSTALMENT_PRODUCTS = new Set(['comprehensive', 'mastery']);

function validateInstalmentRequest(body) {
  const slug = String(body.slug || '').trim();
  const paymentMode = String(body.paymentMode || '').trim();

  if (paymentMode !== 'instalments') return { error: 'Invalid payment mode.' };
  if (!ELIGIBLE_INSTALMENT_PRODUCTS.has(slug)) return { error: 'Instalments are not available for this product.' };

  return { slug };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: validation tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C site add api/create-instalment-session.js tests/checkout.test.js
git -C site commit -m "test: add instalment session validation coverage"
```

### Task 4: Add failing tests for Stripe Checkout Session creation payload

**Files:**
- Modify: `site/tests/checkout.test.js`
- Modify: `site/api/create-instalment-session.js`
- Modify: `site/api/public-config.js`

- [ ] **Step 1: Write the failing tests**

Add a positive-path API test:

```js
test('instalment session handler creates a subscription checkout session with first-invoice add-on only', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_PRICE_COMPREHENSIVE_INSTALMENT = 'price_comp_123';
  const createdSessions = [];

  createInstalmentSessionHandler.__setStripeFactory(() => ({
    checkout: {
      sessions: {
        create: async (payload) => {
          createdSessions.push(payload);
          return { url: 'https://checkout.stripe.test/session_123' };
        },
      },
    },
  }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://rohanstutoring.com' },
    body: {
      slug: 'comprehensive',
      paymentMode: 'instalments',
      upsellSlug: 'mentoring-single',
      customerName: 'Jane Smith',
      email: 'jane@example.com',
      origin: 'https://rohanstutoring.com',
    },
  };
  const res = createJsonResponseRecorder();

  await createInstalmentSessionHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdSessions[0].mode, 'subscription');
  assert.equal(createdSessions[0].line_items[0].price, 'price_comp_123');
  assert.equal(createdSessions[0].line_items[1].price_data.unit_amount, 9900);
  assert.equal(res.body.url, 'https://checkout.stripe.test/session_123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL because the route only validates and does not create sessions yet.

- [ ] **Step 3: Write minimal implementation**

Expand the route:

```js
const PRICE_ENV_KEYS = {
  comprehensive: 'STRIPE_PRICE_COMPREHENSIVE_INSTALMENT',
  mastery: 'STRIPE_PRICE_MASTERY_INSTALMENT',
};

function buildInstalmentSessionPayload({ slug, customer, upsellSlug, origin }) {
  const lineItems = [{ price: process.env[PRICE_ENV_KEYS[slug]], quantity: 1 }];

  if (slug === 'comprehensive' && upsellSlug === 'mentoring-single') {
    lineItems.push({
      price_data: {
        currency: 'aud',
        product_data: { name: 'Add one 1:1 strategy class' },
        unit_amount: 9900,
      },
      quantity: 1,
    });
  }

  return {
    mode: 'subscription',
    success_url: `${origin}/checkout/success?product=${slug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/?product=${slug}`,
    line_items: lineItems,
    customer_email: customer.email,
    subscription_data: { metadata: { product_slug: slug, payment_mode: 'instalments' } },
    metadata: { product_slug: slug, upsell_slug: upsellSlug || '' },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: session creation test PASS.

- [ ] **Step 5: Commit**

```bash
git -C site add api/create-instalment-session.js api/public-config.js tests/checkout.test.js
git -C site commit -m "feat: add Stripe Checkout session flow for instalments"
```

### Task 5: Wire the frontend submit path for instalment mode

**Files:**
- Modify: `site/js/checkout.js`
- Modify: `site/checkout/index.html`
- Modify: `site/css/checkout.css`
- Test: `site/tests/checkout.test.js`

- [ ] **Step 1: Write the failing tests**

Add tests for checkout payload branching:

```js
test('buildCheckoutPayload includes paymentMode for instalment submissions', () => {
  const selection = getInitialSelection('mastery', PRODUCTS.mastery);
  selection.paymentMode = 'instalments';

  const payload = buildCheckoutPayload(selection, {
    billingDetails: { name: 'Jane Smith', email: 'jane@example.com' },
  });

  assert.equal(payload.paymentMode, 'instalments');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL because payloads and submit logic do not include payment mode yet.

- [ ] **Step 3: Write minimal implementation**

Update selection initialization and submit branching:

```js
const selection = {
  ...,
  paymentMode: 'full',
};
```

```js
if (selection.paymentMode === 'instalments') {
  const response = await fetch('/api/create-instalment-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCheckoutPayload(selection, validation)),
  });
  const resultPayload = await parseApiResponse(response);
  if (!resultPayload.ok || !resultPayload.data.url) throw new Error(...);
  window.location.href = resultPayload.data.url;
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: payload test PASS and existing checkout tests remain green.

- [ ] **Step 5: Commit**

```bash
git -C site add checkout/index.html css/checkout.css js/checkout.js tests/checkout.test.js
git -C site commit -m "feat: route instalment checkout through Stripe session creation"
```

### Task 6: Extend webhook handling for instalment billing events

**Files:**
- Modify: `site/api/stripe-webhook.js`
- Modify: `site/tests/checkout.test.js`

- [ ] **Step 1: Write the failing tests**

Add a webhook test for accepted instalment events:

```js
test('stripe webhook acknowledges checkout session completed for instalment checkouts', async () => {
  let fulfilled = false;
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => {
    fulfilled = true;
  });
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent: () => ({
        type: 'checkout.session.completed',
        data: { object: { metadata: { payment_mode: 'instalments' } } },
      }),
    },
  }));

  const req = { method: 'POST', headers: { 'stripe-signature': 'sig' }, rawBody: Buffer.from('body') };
  process.env.STRIPE_SECRET_KEY = 'sk_test';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(fulfilled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: FAIL if webhook path rejects or mishandles the new event shape.

- [ ] **Step 3: Write minimal implementation**

Update the webhook handler to accept and no-op safely on instalment-specific session/invoice events for launch:

```js
if (event.type === 'payment_intent.succeeded') {
  await fulfillPaymentIntentImpl({ paymentIntent: event.data.object, stripeClient });
}

if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
  return res.status(200).json({ received: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: webhook tests PASS without regressing one-off fulfillment.

- [ ] **Step 5: Commit**

```bash
git -C site add api/stripe-webhook.js tests/checkout.test.js
git -C site commit -m "feat: accept instalment Stripe webhook events"
```

### Task 7: Full verification and browser pass

**Files:**
- Test: `site/tests/checkout.test.js`
- Verify: `site/checkout/index.html`
- Verify: `site/courses/comprehensive.html`
- Verify: `site/courses/mastery.html`

- [ ] **Step 1: Run the full checkout test suite**

Run:

```bash
node --test site/tests/checkout.test.js
```

Expected: PASS with all checkout and API tests green.

- [ ] **Step 2: Run browser verification for comprehensive**

Run:

```bash
agent-browser open 'http://127.0.0.1:3000/checkout/?product=comprehensive'
agent-browser snapshot -i
```

Expected:

- payment selector visible
- instalment copy visible when selected
- mentoring add-on still available

- [ ] **Step 3: Run browser verification for mastery**

Run:

```bash
agent-browser open 'http://127.0.0.1:3000/checkout/?product=mastery'
agent-browser snapshot -i
```

Expected:

- payment selector visible
- instalment CTA text visible
- no comprehensive-specific add-on pricing leaks

- [ ] **Step 4: Run browser verification for an ineligible product**

Run:

```bash
agent-browser open 'http://127.0.0.1:3000/checkout/?product=advanced'
agent-browser snapshot -i
```

Expected:

- no instalment selector
- standard one-off checkout still visible

- [ ] **Step 5: Commit**

```bash
git -C site add api/create-instalment-session.js api/stripe-webhook.js checkout/index.html css/checkout.css js/checkout.js tests/checkout.test.js
git -C site commit -m "feat: launch native instalment selection for premium courses"
```
