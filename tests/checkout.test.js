const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EMAIL_PATTERN,
  PRODUCTS,
  fmtPrice,
  getProductFromSearch,
  getInitialSelection,
  getOrderBumpConfig,
  updateSelectionPrice,
  getPaymentModeOptions,
  getInstalmentPlanSummary,
  buildPaymentModeMarkup,
  buildInstalmentSummaryMarkup,
  renderSummaryMarkup,
  buildOrderBumpMarkup,
  buildCheckoutAssuranceMarkup,
  buildInstalmentLinkMarkup,
  getPrimaryButtonLabel,
  getPayButtonLabel,
  getPayButtonPendingLabel,
  getSuccessMessage,
  getSuccessActionMarkup,
  buildSuccessUrl,
  getSuccessState,
  isProductAvailable,
  buildPurchaseItems,
  buildEssayUploadUrl,
  getApiServerErrorMessage,
  getCheckoutSubmissionErrorMessage,
  parseApiResponse,
  fetchCheckoutConfig,
  fetchPaymentIntentStatus,
  fetchPayPalOrderStatus,
  getSuccessPageTitle,
  getCustomerPayload,
  buildCheckoutPayload,
  initCheckoutPage,
  initSuccessPage,
} = require('../js/checkout.js');
const createPaymentIntentHandler = require('../api/create-payment-intent.js');
const createInstalmentSessionHandler = require('../api/create-instalment-session.js');
const createPayPalOrderHandler = require('../api/create-paypal-order.js');
const capturePayPalOrderHandler = require('../api/capture-paypal-order.js');
const paypalOrderStatusHandler = require('../api/paypal-order-status.js');
const paypalWebhookHandler = require('../api/paypal-webhook.js');
const paypalValidation = require('../api/_lib/_paypal-order-validation.js');
const paymentIntentStatusHandler = require('../api/payment-intent-status.js');
const publicConfigHandler = require('../api/public-config.js');
const stripeWebhookHandler = require('../api/stripe-webhook.js');

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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function createCheckoutSubmitTestEnv(productSearch = '?product=comprehensive') {
  const payBtn = { disabled: true, hidden: false };
  const payBtnLabel = { textContent: '' };
  const paymentModeSlot = {
    hidden: true,
    innerHTML: '',
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
  const cardError = {
    hidden: true,
    textContent: '',
    focus() {},
    scrollIntoView() {},
  };
  const fullInput = { value: 'full', checked: true };
  const instalmentInput = { value: 'instalments', checked: false };
  const optionFactory = (input) => ({
    classList: { toggle() {} },
    querySelector(selector) {
      return selector === '.payment-mode-option__input' ? input : null;
    },
  });
  const form = {
    submitHandler: null,
    addEventListener(type, handler) {
      if (type === 'submit') this.submitHandler = handler;
    },
  };
  const elements = {
    '#checkout-grid': { hidden: true },
    '#checkout-not-found': { hidden: true, innerHTML: '' },
    '#checkout-summary': {
      innerHTML: '',
      querySelector() {
        return null;
      },
    },
    '#payment-mode-slot': paymentModeSlot,
    '#pay-btn': payBtn,
    '#pay-btn-label': payBtnLabel,
    '#card-error': cardError,
    '#checkout-upsell-slot': { hidden: true, innerHTML: '' },
    '#instalment-summary-slot': { hidden: true, innerHTML: '' },
    '#card-element-wrap': { hidden: false },
    '#card-element': { hidden: false },
    '#checkout-form': form,
    '#instalment-link': { hidden: true, href: '', innerHTML: '' },
    '#first-name': { value: 'Jane' },
    '#last-name': { value: 'Smith' },
    '#email': {
      value: 'jane@example.com',
      checkValidity() {
        return true;
      },
    },
    '#billing-address': { value: '123 Test Street' },
    '#terms-accepted': { checked: true },
    '#gmail-note': { hidden: true },
    '#essay-banner': { hidden: true },
    '#paypal-button-container': { hidden: true, dataset: {} },
    '#payment-method-toggle': { hidden: true },
    '#tab-card': { addEventListener() {}, classList: { add() {}, remove() {} } },
    '#tab-paypal': { addEventListener() {}, classList: { add() {}, remove() {} } },
  };

  return {
    payBtn,
    payBtnLabel,
    paymentModeSlot,
    fullInput,
    instalmentInput,
    form,
    windowObject: {
      location: {
        search: productSearch,
        href: '',
      },
    },
    documentObject: {
      title: '',
      querySelector(selector) {
        return elements[selector] || null;
      },
      querySelectorAll(selector) {
        if (selector === '.payment-mode-option') {
          return [optionFactory(fullInput), optionFactory(instalmentInput)];
        }
        if (selector === '.payment-mode-option__input') {
          return [fullInput, instalmentInput];
        }
        return [];
      },
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

test('getProductFromSearch resolves s1-comprehensive and s2-comprehensive', () => {
  assert.equal(getProductFromSearch('?product=s1-comprehensive').name, PRODUCTS['s1-comprehensive'].name);
  assert.equal(getProductFromSearch('?product=s2-comprehensive').name, PRODUCTS['s2-comprehensive'].name);
});

test('create-payment-intent accepts s1-comprehensive and s2-comprehensive', async () => {
  const slugs = ['s1-comprehensive', 's2-comprehensive'];

  for (const slug of slugs) {
    const req = {
      method: 'POST',
      headers: { origin: 'https://rohanstutoring.com' },
      body: {
        slug,
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    createPaymentIntentHandler.__setStripeFactory(() => ({
      paymentIntents: {
        create: async (payload) => ({ id: 'pi_test', client_secret: 'pi_test_secret', metadata: payload.metadata }),
      },
      promotionCodes: { list: async () => ({ data: [] }) },
    }));

    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    await createPaymentIntentHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clientSecret, 'pi_test_secret');
  }
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
    couponCode: null,
    couponDiscount: null,
    couponAmount: 0,
  });
});

test('getOrderBumpConfig returns the configured order bump per product', () => {
  assert.deepEqual(getOrderBumpConfig('blueprint'), {
    slug: 'essay-pack-10',
    title: 'Add 10 essay reviews',
    description: 'Get clear feedback on ideas, structure, and expression across 10 full essays.',
    price: 249,
    badge: 'Save $100',
  });

  assert.deepEqual(getOrderBumpConfig('comprehensive'), {
    slug: 'mentoring-single',
    title: 'Add one 1:1 strategy class',
    description: 'Private strategy session with a top tutor before classes begin',
    price: 99,
    priceWas: 119,
    badge: 'Enrolment-only offer',
    lockRuntimePrice: true,
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

test('comprehensive checkout summary uses the May 2026 course title without cohort tagline', () => {
  const markup = renderSummaryMarkup(PRODUCTS.comprehensive, getInitialSelection('comprehensive', PRODUCTS.comprehensive));

  assert.match(markup, /GAMSAT S1 &amp; S2 Comprehensive Course \(May 2026 Start\)/);
  assert.doesNotMatch(markup, /24 live classes · 50\+ hrs content · September cohort/);
});

test('checkout page uses local payment provider logo assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '../checkout/index.html'), 'utf8');
  const logoFiles = [
    '../assets/payment/visa-desktop.png',
    '../assets/payment/mastercard-desktop.png',
    '../assets/payment/amex-desktop.png',
  ];

  for (const logoFile of logoFiles) {
    assert.match(html, new RegExp(logoFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(fs.existsSync(path.join(__dirname, '../checkout', logoFile)), true);
  }

  assert.doesNotMatch(html, /stripe\.svg/);
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

test('buildOrderBumpMarkup renders the comprehensive enrolment-only discount with strikethrough pricing', () => {
  const markup = buildOrderBumpMarkup(
    getOrderBumpConfig('comprehensive'),
    getInitialSelection('comprehensive', PRODUCTS.comprehensive)
  );

  assert.match(markup, /Enrolment-only offer/);
  assert.match(markup, /\$119/);
  assert.match(markup, /\+\$99/);
});

test('buildCheckoutAssuranceMarkup renders compact trust proof for the payment step', () => {
  const markup = buildCheckoutAssuranceMarkup();

  assert.match(markup, /checkout-assurance/);
  assert.match(markup, /Encrypted card payment/);
  assert.match(markup, /Refund guarantee honoured/);
  assert.match(markup, /Receipt sent automatically/);
});

test('buildInstalmentLinkMarkup renders instalment plans as a deliberate checkout option', () => {
  const markup = buildInstalmentLinkMarkup(PRODUCTS.comprehensive);

  assert.match(markup, /checkout-instalment-link__eyebrow/);
  assert.match(markup, /Pay in 4 instalments/);
  assert.match(markup, /\$449 × 4 instalments/);
  assert.match(markup, /Opens secure Stripe instalment checkout/);
});

test('getPaymentModeOptions returns instalment mode for comprehensive and mastery only', () => {
  assert.deepEqual(getPaymentModeOptions('comprehensive'), ['full', 'instalments']);
  assert.deepEqual(getPaymentModeOptions('mastery'), ['full', 'instalments']);
  assert.deepEqual(getPaymentModeOptions('blueprint'), ['full', 'afterpay']);
  assert.deepEqual(getPaymentModeOptions('advanced'), ['full']);
});

test('buildPaymentModeMarkup renders Afterpay as a Blueprint payment option', () => {
  const markup = buildPaymentModeMarkup(
    'blueprint',
    getInitialSelection('blueprint', PRODUCTS.blueprint)
  );

  assert.match(markup, /Pay in 4 with Afterpay/);
  assert.match(markup, /value="afterpay"/);
  assert.match(markup, /Redirects to Afterpay to finish checkout/);
});

test('getInstalmentPlanSummary returns first payment and future monthly copy for comprehensive', () => {
  const selection = getInitialSelection('comprehensive', PRODUCTS.comprehensive);
  selection.paymentMode = 'instalments';

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

test('buildPaymentModeMarkup renders full and instalment options for eligible products', () => {
  const markup = buildPaymentModeMarkup(
    'comprehensive',
    getInitialSelection('comprehensive', PRODUCTS.comprehensive)
  );

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

test('initCheckoutPage keeps the pay button disabled until checkout is ready', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const previousStripe = global.Stripe;
  const configRequest = createDeferred();
  const payBtn = { disabled: true, hidden: false };
  const payBtnLabel = { textContent: '' };
  const paymentModeSlot = {
    hidden: true,
    innerHTML: '',
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
  const fullInput = { value: 'full', checked: true };
  const instalmentInput = { value: 'instalments', checked: false };
  const optionFactory = (input) => ({
    classList: { toggle() {} },
    querySelector(selector) {
      return selector === '.payment-mode-option__input' ? input : null;
    },
  });
  const elements = {
    '#checkout-grid': { hidden: true },
    '#checkout-not-found': { hidden: true, innerHTML: '' },
    '#checkout-summary': {
      innerHTML: '',
      querySelector() {
        return null;
      },
    },
    '#payment-mode-slot': paymentModeSlot,
    '#pay-btn': payBtn,
    '#pay-btn-label': payBtnLabel,
    '#card-error': {
      hidden: true,
      textContent: '',
      focus() {},
      scrollIntoView() {},
    },
    '#checkout-upsell-slot': { hidden: true, innerHTML: '' },
    '#instalment-summary-slot': { hidden: true, innerHTML: '' },
    '#card-element-wrap': { hidden: false },
    '#card-element': { hidden: false },
    '#checkout-form': { addEventListener() {} },
    '#instalment-link': { hidden: true, href: '', innerHTML: '' },
  };

  global.window = {
    location: {
      search: '?product=comprehensive',
    },
  };
  global.document = {
    title: '',
    querySelector(selector) {
      return elements[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.payment-mode-option') {
        return [optionFactory(fullInput), optionFactory(instalmentInput)];
      }
      if (selector === '.payment-mode-option__input') {
        return [fullInput, instalmentInput];
      }
      return [];
    },
  };
  global.fetch = async () => configRequest.promise;
  global.Stripe = () => ({
    elements() {
      return {
        create() {
          return {
            mount() {},
            on() {},
          };
        },
      };
    },
  });

  try {
    const initPromise = initCheckoutPage();

    paymentModeSlot.listeners.change({
      target: {
        closest(selector) {
          return selector === '.payment-mode-option__input' ? instalmentInput : null;
        },
      },
    });

    assert.equal(payBtn.disabled, true);
    assert.equal(payBtnLabel.textContent, 'Loading secure payment...');

    configRequest.resolve({
      ok: true,
      text: async () => JSON.stringify({
        stripePublishableKey: 'pk_test_123',
      }),
    });

    await initPromise;

    assert.equal(payBtn.disabled, false);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
    global.Stripe = previousStripe;
  }
});

test('initCheckoutPage routes instalment submissions to the hosted checkout session URL', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const previousStripe = global.Stripe;
  const env = createCheckoutSubmitTestEnv();
  const fetchCalls = [];
  let confirmCardPaymentCalled = false;

  global.window = env.windowObject;
  global.document = env.documentObject;
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (url === '/api/public-config') {
      return {
        ok: true,
        text: async () => JSON.stringify({ stripePublishableKey: 'pk_test_123' }),
      };
    }

    if (url === '/api/create-instalment-session') {
      return {
        ok: true,
        text: async () => JSON.stringify({ url: 'https://checkout.stripe.test/session_123' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  global.Stripe = () => ({
    elements() {
      return {
        create() {
          return {
            mount() {},
            on() {},
          };
        },
      };
    },
    async confirmCardPayment() {
      confirmCardPaymentCalled = true;
      return {};
    },
  });

  try {
    await initCheckoutPage();

    env.paymentModeSlot.listeners.change({
      target: {
        closest(selector) {
          return selector === '.payment-mode-option__input' ? env.instalmentInput : null;
        },
      },
    });

    await env.form.submitHandler({
      preventDefault() {},
    });

    assert.equal(fetchCalls.some((call) => call.url === '/api/create-instalment-session'), true);
    assert.equal(confirmCardPaymentCalled, false);
    assert.equal(env.windowObject.location.href, 'https://checkout.stripe.test/session_123');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
    global.Stripe = previousStripe;
  }
});

test('initCheckoutPage routes Blueprint Afterpay submissions to the hosted Afterpay session URL', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const previousStripe = global.Stripe;
  const env = createCheckoutSubmitTestEnv('?product=blueprint');
  const afterpayInput = { value: 'afterpay', checked: false };
  const fetchCalls = [];
  let confirmCardPaymentCalled = false;

  global.window = env.windowObject;
  global.document = {
    ...env.documentObject,
    querySelectorAll(selector) {
      if (selector === '.payment-mode-option') {
        const optionFactory = (input) => ({
          classList: { toggle() {} },
          querySelector(childSelector) {
            return childSelector === '.payment-mode-option__input' ? input : null;
          },
        });
        return [optionFactory(env.fullInput), optionFactory(afterpayInput)];
      }
      if (selector === '.payment-mode-option__input') {
        return [env.fullInput, afterpayInput];
      }
      return [];
    },
  };
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (url === '/api/public-config') {
      return {
        ok: true,
        text: async () => JSON.stringify({ stripePublishableKey: 'pk_test_123' }),
      };
    }

    if (url === '/api/create-instalment-session') {
      return {
        ok: true,
        text: async () => JSON.stringify({ url: 'https://checkout.stripe.test/afterpay_123' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  global.Stripe = () => ({
    elements() {
      return {
        create() {
          return {
            mount() {},
            on() {},
          };
        },
      };
    },
    async confirmCardPayment() {
      confirmCardPaymentCalled = true;
      return {};
    },
  });

  try {
    await initCheckoutPage();

    env.paymentModeSlot.listeners.change({
      target: {
        closest(selector) {
          return selector === '.payment-mode-option__input' ? afterpayInput : null;
        },
      },
    });

    await env.form.submitHandler({
      preventDefault() {},
    });

    assert.equal(fetchCalls.some((call) => call.url === '/api/create-instalment-session'), true);
    assert.equal(confirmCardPaymentCalled, false);
    assert.equal(env.windowObject.location.href, 'https://checkout.stripe.test/afterpay_123');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
    global.Stripe = previousStripe;
  }
});

test('instalment session handler creates a one-time Blueprint Afterpay Checkout Session', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  let sessionPayload = null;
  createInstalmentSessionHandler.__setStripeFactory(() => ({
    checkout: {
      sessions: {
        create: async (payload) => {
          sessionPayload = payload;
          return { url: 'https://checkout.stripe.test/afterpay_123' };
        },
      },
    },
  }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://rohanstutoring.com' },
    body: {
      slug: 'blueprint',
      paymentMode: 'afterpay',
      email: 'jane@example.com',
      customerName: 'Jane Smith',
      origin: 'https://rohanstutoring.com',
    },
  };
  const res = createJsonResponseRecorder();

  await createInstalmentSessionHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { url: 'https://checkout.stripe.test/afterpay_123' });
  assert.equal(sessionPayload.mode, 'payment');
  assert.deepEqual(sessionPayload.payment_method_types, ['afterpay_clearpay']);
  assert.equal(sessionPayload.line_items[0].price_data.unit_amount, 59900);
  assert.equal(sessionPayload.payment_intent_data.metadata.payment_mode, 'afterpay');
  assert.equal(sessionPayload.payment_intent_data.metadata.product_slug, 'blueprint');
  assert.match(sessionPayload.success_url, /session_id=\{CHECKOUT_SESSION_ID\}/);

  createInstalmentSessionHandler.__resetForTests();
});

test('payment intent status handler returns hosted checkout session metadata when session_id is provided', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  paymentIntentStatusHandler.__setStripeFactory(() => ({
    checkout: {
      sessions: {
        retrieve: async (sessionId) => {
          assert.equal(sessionId, 'cs_test_123');
          return {
            payment_status: 'paid',
            payment_intent: {
              id: 'pi_test_123',
              status: 'succeeded',
              metadata: {
                base_slug: 'blueprint',
                product_slug: 'blueprint',
                payment_mode: 'afterpay',
              },
            },
          };
        },
      },
    },
    paymentIntents: {
      retrieve: async () => {
        throw new Error('should not fetch payment intent directly for session lookups');
      },
    },
  }));

  try {
    const req = {
      method: 'GET',
      headers: { origin: 'https://rohanstutoring.com' },
      query: { session_id: 'cs_test_123' },
    };
    const res = createJsonResponseRecorder();

    await paymentIntentStatusHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'succeeded');
    assert.equal(res.body.paymentIntentId, 'pi_test_123');
    assert.deepEqual(res.body.metadata, {
      base_slug: 'blueprint',
      product_slug: 'blueprint',
      upsell_slug: '',
      payment_mode: 'afterpay',
    });
  } finally {
    paymentIntentStatusHandler.__resetForTests();
  }
});

test('initCheckoutPage keeps full-pay submissions on the payment-intent card flow', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const previousStripe = global.Stripe;
  const env = createCheckoutSubmitTestEnv('?product=advanced');
  const fetchCalls = [];
  const confirmedPayments = [];

  global.window = env.windowObject;
  global.document = env.documentObject;
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (url === '/api/public-config') {
      return {
        ok: true,
        text: async () => JSON.stringify({ stripePublishableKey: 'pk_test_123' }),
      };
    }

    if (url === '/api/create-payment-intent') {
      return {
        ok: true,
        text: async () => JSON.stringify({ clientSecret: 'pi_secret_123' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  global.Stripe = () => ({
    elements() {
      return {
        create() {
          return {
            mount() {},
            on() {},
          };
        },
      };
    },
    async confirmCardPayment(clientSecret, payload) {
      confirmedPayments.push({ clientSecret, payload });
      return {
        paymentIntent: {
          id: 'pi_123',
          status: 'succeeded',
        },
      };
    },
  });

  try {
    await initCheckoutPage();

    await env.form.submitHandler({
      preventDefault() {},
    });

    assert.equal(fetchCalls.some((call) => call.url === '/api/create-payment-intent'), true);
    assert.equal(confirmedPayments.length, 1);
    assert.equal(confirmedPayments[0].clientSecret, 'pi_secret_123');
    assert.match(env.windowObject.location.href, /\/checkout\/success\?product=advanced&payment_intent=pi_123/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
    global.Stripe = previousStripe;
  }
});

test('initCheckoutPage blocks checkout submission until terms are accepted', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const previousStripe = global.Stripe;
  const env = createCheckoutSubmitTestEnv('?product=advanced');
  const fetchCalls = [];
  const confirmedPayments = [];

  global.window = env.windowObject;
  global.document = env.documentObject;
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (url === '/api/public-config') {
      return {
        ok: true,
        text: async () => JSON.stringify({ stripePublishableKey: 'pk_test_123' }),
      };
    }

    if (url === '/api/create-payment-intent') {
      return {
        ok: true,
        text: async () => JSON.stringify({ clientSecret: 'pi_secret_123' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
  global.Stripe = () => ({
    elements() {
      return {
        create() {
          return {
            mount() {},
            on() {},
          };
        },
      };
    },
    async confirmCardPayment(clientSecret, payload) {
      confirmedPayments.push({ clientSecret, payload });
      return {
        paymentIntent: {
          id: 'pi_123',
          status: 'succeeded',
        },
      };
    },
  });

  try {
    await initCheckoutPage();
    env.documentObject.querySelector('#terms-accepted').checked = false;

    await env.form.submitHandler({
      preventDefault() {},
    });

    assert.equal(fetchCalls.some((call) => call.url === '/api/create-payment-intent'), false);
    assert.equal(confirmedPayments.length, 0);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
    global.Stripe = previousStripe;
  }
});

test('checkout page requires explicit terms acceptance before purchase', () => {
  const html = fs.readFileSync(path.join(__dirname, '../checkout/index.html'), 'utf8');

  assert.match(html, /id="terms-accepted"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /required/);
  assert.match(html, /Terms &amp; Conditions/);
});

test('stripe webhook only treats tagged subscription events as instalment lifecycle events', () => {
  assert.equal(
    stripeWebhookHandler.__isInstalmentWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: {
            payment_mode: 'instalments',
          },
        },
      },
    }),
    true
  );
  assert.equal(
    stripeWebhookHandler.__isInstalmentWebhookEvent({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_123',
          subscription_details: {
            metadata: {
              payment_mode: 'instalments',
              product_slug: 'comprehensive',
            },
          },
        },
      },
    }),
    true
  );
  assert.equal(
    stripeWebhookHandler.__isInstalmentWebhookEvent({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_456',
          subscription_details: {
            metadata: {
              payment_mode: 'full',
              product_slug: 'comprehensive',
            },
          },
        },
      },
    }),
    false
  );
  assert.equal(
    stripeWebhookHandler.__isInstalmentWebhookEvent({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          metadata: {
            payment_mode: 'instalments',
          },
        },
      },
    }),
    false
  );
});

for (const eventType of ['invoice.paid', 'invoice.payment_failed']) {
  test(`stripe webhook acknowledges tagged ${eventType} instalment invoice events without fulfilling them`, async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    let fulfilled = false;
    stripeWebhookHandler.__setStripeFactory(() => ({
      webhooks: {
        constructEvent() {
          return {
            type: eventType,
            data: {
              object: {
                id: 'in_test_123',
                subscription_details: {
                  metadata: {
                    payment_mode: 'instalments',
                    product_slug: 'comprehensive',
                  },
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
    stripeWebhookHandler.__setFulfillPaymentIntent(async () => {
      fulfilled = true;
      return { alreadyFulfilled: false };
    });

    const req = {
      method: 'POST',
      headers: {
        'stripe-signature': 't=123,v1=abc',
      },
      body: Buffer.from('{"id":"evt_123","object":"event"}'),
    };
    const res = createJsonResponseRecorder();

    await stripeWebhookHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { received: true });
    assert.equal(fulfilled, false);
    stripeWebhookHandler.__resetForTests();
  });
}

test('stripe webhook acknowledges checkout.session.completed for instalment checkouts', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  let fulfilled = false;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        return {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              metadata: {
                product_slug: 'comprehensive',
                payment_mode: 'instalments',
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
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => {
    fulfilled = true;
    return { alreadyFulfilled: false };
  });

  const req = {
    method: 'POST',
    headers: {
      'stripe-signature': 't=123,v1=abc',
    },
    body: Buffer.from('{"id":"evt_123","object":"event"}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(fulfilled, false);
  stripeWebhookHandler.__resetForTests();
});

test('stripe webhook still fulfills payment_intent.succeeded events', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  let fulfilled = false;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_123',
              metadata: {
                payment_mode: 'full',
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
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => {
    fulfilled = true;
    return { alreadyFulfilled: false };
  });

  const req = {
    method: 'POST',
    headers: {
      'stripe-signature': 't=123,v1=abc',
    },
    body: Buffer.from('{"id":"evt_123","object":"event"}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(fulfilled, true);
  stripeWebhookHandler.__resetForTests();
});

test('checkout stylesheet preserves hidden state for conditional checkout panels', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/checkout.css'), 'utf8');

  assert.match(css, /\.checkout-essay-banner\[hidden\]/);
  assert.match(css, /\.checkout-instalment-link\[hidden\]/);
  assert.match(css, /display:\s*none\s*!important/);
});

test('getPayButtonLabel reflects current amount', () => {
  assert.equal(getPayButtonLabel(347), 'Pay $347 AUD →');
  assert.equal(getPayButtonLabel(34.99), 'Pay $34.99 AUD →');
});

test('getPrimaryButtonLabel switches CTA copy for instalment mode', () => {
  const selection = getInitialSelection('mastery', PRODUCTS.mastery);
  selection.paymentMode = 'instalments';

  assert.equal(getPrimaryButtonLabel(selection), 'Continue to secure instalment checkout');
  assert.equal(
    getPrimaryButtonLabel(getInitialSelection('advanced', PRODUCTS.advanced)),
    'Pay $299 AUD →'
  );
});

test('getPayButtonPendingLabel keeps disabled checkout buttons explanatory', () => {
  assert.equal(getPayButtonPendingLabel(), 'Loading secure payment...');
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

test('buildPurchaseItems keeps the comprehensive order bump at the bundled discount price', () => {
  assert.deepEqual(buildPurchaseItems('comprehensive', 'mentoring-single'), [
    {
      item_id: 'comprehensive',
      item_name: 'GAMSAT S1 & S2 Comprehensive Course (May 2026 Start)',
      price: 1549,
      quantity: 1,
    },
    {
      item_id: 'mentoring-single',
      item_name: 'Add one 1:1 strategy class',
      price: 99,
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

test('getCheckoutSubmissionErrorMessage hides raw instalment setup errors from customers', () => {
  const message = getCheckoutSubmissionErrorMessage(
    'Missing STRIPE_PRICE_COMPREHENSIVE_INSTALMENT environment variable',
    'instalments'
  );

  assert.equal(
    message,
    'Instalments are temporarily unavailable. Please choose pay in full or contact us for help.'
  );
});

test('getCheckoutSubmissionErrorMessage preserves standard payment errors outside instalments', () => {
  const message = getCheckoutSubmissionErrorMessage(
    'Payment setup failed. Please try again.',
    'full'
  );

  assert.equal(message, 'Payment setup failed. Please try again.');
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
  selection.price = 1648;

  const payload = buildCheckoutPayload(selection, {
    billingDetails: {
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  });

  assert.deepEqual(payload, {
    slug: 'comprehensive',
    paymentMode: 'full',
    primaryProduct: {
      pageSlug: 'comprehensive',
      slug: 'comprehensive',
      price: 1549,
    },
    totalAmount: 1648,
    customerName: 'Jane Smith',
    email: 'jane@example.com',
    upsell: {
      slug: 'mentoring-single',
      price: 99,
      title: 'Add one 1:1 strategy class',
    },
    upsellSlug: 'mentoring-single',
    upsellPrice: 99,
    upsellSelected: true,
    couponCode: null,
  });
});

test('buildCheckoutPayload includes paymentMode for instalment submissions', () => {
  const selection = getInitialSelection('comprehensive', PRODUCTS.comprehensive);
  selection.paymentMode = 'instalments';

  const payload = buildCheckoutPayload(selection, {
    billingDetails: {
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  });

  assert.equal(payload.paymentMode, 'instalments');
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

  assert.deepEqual(
    createPaymentIntentHandler.resolveCheckoutPurchase({
      slug: 'comprehensive',
      upsellSlug: 'mentoring-single',
    }),
    {
      amount: 164800,
      baseAmount: 154900,
      baseSlug: 'comprehensive',
      upsellAmount: 9900,
      upsellSlug: 'mentoring-single',
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

test('instalment session handler rejects invalid payment modes', async () => {
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
  assert.match(res.body.error, /payment mode/i);
});

test('instalment session handler rejects whitespace-only Stripe secret keys', async () => {
  process.env.STRIPE_SECRET_KEY = '   ';
  process.env.STRIPE_PRICE_COMPREHENSIVE_INSTALMENT = 'price_comp_123';

  let stripeFactoryCalled = false;
  createInstalmentSessionHandler.__setStripeFactory(() => {
    stripeFactoryCalled = true;
    return {
      checkout: {
        sessions: {
          create: async () => {
            throw new Error('should not be called');
          },
        },
      },
    };
  });

  try {
    const req = {
      method: 'POST',
      headers: { origin: 'https://rohanstutoring.com' },
      body: {
        slug: 'comprehensive',
        paymentMode: 'instalments',
        customerName: 'Jane Smith',
        email: 'jane@example.com',
        origin: 'https://rohanstutoring.com',
      },
    };
    const res = createJsonResponseRecorder();

    await createInstalmentSessionHandler(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error, 'Missing STRIPE_SECRET_KEY environment variable');
    assert.equal(stripeFactoryCalled, false);
  } finally {
    createInstalmentSessionHandler.__resetForTests();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_COMPREHENSIVE_INSTALMENT;
  }
});

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

  try {
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
    assert.equal(createdSessions.length, 1);
    assert.equal(createdSessions[0].mode, 'subscription');
    assert.equal(createdSessions[0].success_url, 'https://rohanstutoring.com/checkout/success?product=comprehensive&session_id={CHECKOUT_SESSION_ID}');
    assert.equal(createdSessions[0].cancel_url, 'https://rohanstutoring.com/checkout/?product=comprehensive');
    assert.equal(createdSessions[0].customer_email, 'jane@example.com');
    assert.equal(createdSessions[0].line_items.length, 1);
    assert.equal(createdSessions[0].line_items[0].price, 'price_comp_123');
    assert.equal(createdSessions[0].line_items[0].quantity, 1);
    assert.deepEqual(createdSessions[0].metadata, {
      product_slug: 'comprehensive',
      base_slug: 'comprehensive',
      payment_mode: 'instalments',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Smith',
      upsell_slug: 'mentoring-single',
    });
    assert.deepEqual(createdSessions[0].subscription_data.metadata, {
      product_slug: 'comprehensive',
      base_slug: 'comprehensive',
      payment_mode: 'instalments',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Smith',
      upsell_slug: 'mentoring-single',
    });
    assert.equal(createdSessions[0].subscription_data.add_invoice_items.length, 1);
    assert.equal(createdSessions[0].subscription_data.add_invoice_items[0].price_data.unit_amount, 9900);
    assert.equal(res.body.url, 'https://checkout.stripe.test/session_123');
  } finally {
    createInstalmentSessionHandler.__resetForTests();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_COMPREHENSIVE_INSTALMENT;
  }
});

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

test('PayPal validation rejects captures without completed status', () => {
  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase({
    slug: 'blueprint',
  });

  const missingCaptureStatus = paypalValidation.validateCompletedPayPalOrder(
    {
      id: 'ORDER123',
      status: 'COMPLETED',
      purchase_units: [
        {
          custom_id: 'blueprint',
          payments: {
            captures: [
              {
                amount: { value: '599.00', currency_code: 'AUD' },
              },
            ],
          },
        },
      ],
    },
    purchase,
    'ORDER123'
  );

  assert.equal(missingCaptureStatus.error, 'PayPal capture was not completed.');
});

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

test('initSuccessPage shows PayPal verification before failing an unverified order', async () => {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousFetch = global.fetch;
  const elements = {
    '#success-message': { textContent: '' },
    '#success-heading': { textContent: '' },
    '#success-icon': { textContent: '' },
    '#success-action': { innerHTML: '', hidden: true },
  };

  global.window = {
    location: {
      search: '?product=blueprint&paypal_order=ORDER123',
    },
  };
  global.document = {
    title: '',
    querySelector: (selector) => elements[selector] || null,
  };
  global.fetch = async () => ({
    ok: false,
    text: async () => JSON.stringify({ error: 'Payment was not completed.' }),
  });

  try {
    const renderPromise = initSuccessPage();

    assert.equal(elements['#success-heading'].textContent, 'Checking payment');
    assert.equal(global.document.title, "Checking Payment | Rohan's GAMSAT");

    await renderPromise;

    assert.equal(elements['#success-heading'].textContent, 'Payment not confirmed');
    assert.equal(global.document.title, "Payment Not Confirmed | Rohan's GAMSAT");
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.fetch = previousFetch;
  }
});

test('PayPal webhook rejects requests before verification when webhook ID is missing', async () => {
  const previousWebhookId = process.env.PAYPAL_WEBHOOK_ID;
  const req = {
    method: 'POST',
    headers: {},
    body: {},
  };
  const res = createJsonResponseRecorder();

  delete process.env.PAYPAL_WEBHOOK_ID;

  try {
    await paypalWebhookHandler(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'PayPal webhook is not configured.' });
  } finally {
    if (previousWebhookId === undefined) {
      delete process.env.PAYPAL_WEBHOOK_ID;
    } else {
      process.env.PAYPAL_WEBHOOK_ID = previousWebhookId;
    }
  }
});

test('PayPal webhook verifies signature, fetches the order, and fulfills capture completed events', async () => {
  process.env.PAYPAL_CLIENT_ID = 'paypal_client_test';
  process.env.PAYPAL_CLIENT_SECRET = 'paypal_secret_test';
  process.env.PAYPAL_WEBHOOK_ID = 'webhook_id_test';
  const previousFetch = global.fetch;
  const calls = [];
  const fulfilledOrders = [];

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
          payer: {
            email_address: 'jane@example.com',
            name: {
              given_name: 'Jane',
              surname: 'Smith',
            },
          },
        }),
      };
    }

    return {
      ok: false,
      json: async () => ({}),
    };
  };

  paypalWebhookHandler.__setFulfillPayPalOrder(async (payload) => {
    fulfilledOrders.push(payload);
    return { fulfilled: true };
  });

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
    assert.equal(calls.some((call) => call.url.includes('/v2/checkout/orders/ORDER123')), true);
    assert.equal(fulfilledOrders.length, 1);
    assert.equal(fulfilledOrders[0].orderID, 'ORDER123');
    assert.equal(fulfilledOrders[0].purchase.baseSlug, 'blueprint');
    assert.equal(fulfilledOrders[0].customer.email, 'jane@example.com');
  } finally {
    global.fetch = previousFetch;
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_WEBHOOK_ID;
    paypalWebhookHandler.__resetForTests();
  }
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
    assert.equal(createPayloads[0].amount, 164800);
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
      paymentIntentId: '',
      metadata: {
        base_slug: 'essay-marking',
        product_slug: 'essay-marking',
        upsell_slug: 'essay-collection',
        payment_mode: '',
      },
    });
  } finally {
    paymentIntentStatusHandler.__resetForTests();
    delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
  }
});

test('payment intent handler sends Stripe idempotency keys for retries in the same minute', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';

  const createCalls = [];
  const previousNow = Date.now;
  Date.now = () => new Date('2026-05-13T12:34:56.000Z').valueOf();

  createPaymentIntentHandler.__setStripeFactory(() => ({
    paymentIntents: {
      create: async (payload, options) => {
        createCalls.push({ payload, options });
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
    assert.equal(createCalls.length, 1);
    assert.equal(createCalls[0].options.idempotencyKey, 'pi-jane@example.com-comprehensive-mentoring-single-29644594');
  } finally {
    Date.now = previousNow;
    createPaymentIntentHandler.__resetForTests();
    delete process.env.STRIPE_SECRET_KEY;
  }
});

test('public config handler origin allow-list matches checkout endpoint', () => {
  assert.equal(publicConfigHandler.isAllowedOrigin('https://rohanstutoring.com'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://preview-build.vercel.app'), false);
  assert.equal(publicConfigHandler.isAllowedOrigin('http://127.0.0.1:3000'), true);
  assert.equal(publicConfigHandler.isAllowedOrigin('https://evil.example.com'), false);
});

test('public config handler allows same-site browser requests without an origin header', async () => {
  const previousStripeKey = process.env.STRIPE_PUBLISHABLE_KEY;
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';

  const req = {
    method: 'GET',
    headers: {},
  };
  const res = createJsonResponseRecorder();

  await publicConfigHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stripePublishableKey, 'pk_test_123');

  if (previousStripeKey === undefined) {
    delete process.env.STRIPE_PUBLISHABLE_KEY;
  } else {
    process.env.STRIPE_PUBLISHABLE_KEY = previousStripeKey;
  }
});
