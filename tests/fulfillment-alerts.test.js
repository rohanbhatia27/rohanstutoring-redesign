const test = require('node:test');
const assert = require('node:assert/strict');

const sendFulfillmentAlert = require('../api/_lib/_fulfillment-alerts.js');
const fulfillPaymentIntent = require('../api/_lib/_fulfill-payment-intent.js');
const fulfillPayPalOrder = require('../api/_lib/_paypal-fulfillment.js');
const googleDrive = require('../api/_lib/_google-drive.js');
const kit = require('../api/_lib/_kit.js');

const BASE_ALERT_ARGS = {
  baseSlug: 'blueprint',
  upsellSlug: '',
  customerEmail: 'jane@example.com',
  provider: 'stripe',
  paymentId: 'pi_test_123',
  failedStep: 'drive',
  errorMessage: 'Drive API timeout',
};

// ---- sendFulfillmentAlert unit tests ----

test('sendFulfillmentAlert sends to ADMIN_ALERT_EMAIL with all required fields', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_ALERT_EMAIL = 'rohan@example.com';

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'alert_email_1' };
      },
    },
  }));

  await sendFulfillmentAlert(BASE_ALERT_ARGS);

  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'rohan@example.com');
  assert.match(sentEmails[0].subject, /FULFILLMENT ALERT/);
  assert.match(sentEmails[0].subject, /drive/);
  assert.match(sentEmails[0].subject, /blueprint/);
  assert.match(sentEmails[0].subject, /stripe/);
  assert.match(sentEmails[0].html, /jane@example\.com/);
  assert.match(sentEmails[0].html, /pi_test_123/);
  assert.match(sentEmails[0].html, /Drive API timeout/);
  assert.match(sentEmails[0].text, /blueprint/);
  assert.match(sentEmails[0].text, /jane@example\.com/);

  sendFulfillmentAlert.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_ALERT_EMAIL;
});

test('sendFulfillmentAlert includes upsell slug when present', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_ALERT_EMAIL = 'rohan@example.com';

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'alert_email_2' };
      },
    },
  }));

  await sendFulfillmentAlert({ ...BASE_ALERT_ARGS, upsellSlug: 'private-mentoring' });

  assert.match(sentEmails[0].html, /private-mentoring/);
  assert.match(sentEmails[0].text, /private-mentoring/);
  assert.match(sentEmails[0].subject, /private-mentoring/);

  sendFulfillmentAlert.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_ALERT_EMAIL;
});

test('sendFulfillmentAlert skips silently when RESEND_API_KEY is missing', async () => {
  const sentEmails = [];
  delete process.env.RESEND_API_KEY;
  process.env.ADMIN_ALERT_EMAIL = 'rohan@example.com';

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'alert_email_3' };
      },
    },
  }));

  await sendFulfillmentAlert(BASE_ALERT_ARGS);

  assert.equal(sentEmails.length, 0);

  sendFulfillmentAlert.__resetForTests();
  delete process.env.ADMIN_ALERT_EMAIL;
});

test('sendFulfillmentAlert skips silently when ADMIN_ALERT_EMAIL is missing', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_key';
  delete process.env.ADMIN_ALERT_EMAIL;

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'alert_email_4' };
      },
    },
  }));

  await sendFulfillmentAlert(BASE_ALERT_ARGS);

  assert.equal(sentEmails.length, 0);

  sendFulfillmentAlert.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('sendFulfillmentAlert does not throw when Resend itself fails', async () => {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_ALERT_EMAIL = 'rohan@example.com';

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async () => {
        throw new Error('Resend service unavailable');
      },
    },
  }));

  await assert.doesNotReject(() => sendFulfillmentAlert(BASE_ALERT_ARGS));

  sendFulfillmentAlert.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_ALERT_EMAIL;
});

test('sendFulfillmentAlert escapes HTML in error message', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.ADMIN_ALERT_EMAIL = 'rohan@example.com';

  sendFulfillmentAlert.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'alert_email_5' };
      },
    },
  }));

  await sendFulfillmentAlert({ ...BASE_ALERT_ARGS, errorMessage: '<script>alert(1)</script>' });

  assert.doesNotMatch(sentEmails[0].html, /<script>/);
  assert.match(sentEmails[0].html, /&lt;script&gt;/);

  sendFulfillmentAlert.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_ALERT_EMAIL;
});

// ---- Wiring: fulfillPaymentIntent triggers alerts ----

test('fulfillPaymentIntent sends alert when Google Drive sharing fails', async () => {
  const alerts = [];
  process.env.RESEND_API_KEY = 're_test_key';

  fulfillPaymentIntent.__setAlertFn(async (args) => { alerts.push(args); });

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      throw new Error('Drive token fetch failed');
    }
    throw new Error('Unexpected fetch');
  });

  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  process.env.GOOGLE_REFRESH_TOKEN = 'gtoken';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_abc';

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_drive_fail',
      metadata: { base_slug: 'blueprint', customer_email: 'jane@example.com' },
    },
    stripeClient: {
      paymentIntents: { update: async () => ({}) },
    },
  });

  assert.ok(alerts.length >= 1, 'Expected at least one alert');
  const driveAlert = alerts.find((a) => a.failedStep === 'drive');
  assert.ok(driveAlert, 'Expected a drive alert');
  assert.equal(driveAlert.baseSlug, 'blueprint');
  assert.equal(driveAlert.customerEmail, 'jane@example.com');
  assert.equal(driveAlert.provider, 'stripe');
  assert.equal(driveAlert.paymentId, 'pi_drive_fail');
  assert.ok(driveAlert.errorMessage, 'Expected non-empty error message');

  fulfillPaymentIntent.__resetForTests();
  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('fulfillPaymentIntent sends alert when confirmation email fails', async () => {
  const alerts = [];

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async () => {
        throw new Error('Resend API down');
      },
    },
  }));
  fulfillPaymentIntent.__setAlertFn(async (args) => { alerts.push(args); });
  process.env.RESEND_API_KEY = 're_test_key';

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_email_fail',
      metadata: { base_slug: 'blueprint', customer_email: 'jane@example.com' },
    },
    stripeClient: {
      paymentIntents: { update: async () => ({}) },
    },
  });

  const emailAlert = alerts.find((a) => a.failedStep === 'email');
  assert.ok(emailAlert, 'Expected an email alert');
  assert.equal(emailAlert.paymentId, 'pi_email_fail');
  assert.equal(emailAlert.provider, 'stripe');
  assert.match(emailAlert.errorMessage, /Resend API down/);

  fulfillPaymentIntent.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('fulfillPaymentIntent sends alert when Kit tagging fails', async () => {
  const alerts = [];

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: { send: async () => ({ id: 'ok' }) },
  }));
  fulfillPaymentIntent.__setAlertFn(async (args) => { alerts.push(args); });
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.KIT_API_KEY = 'kit_key';
  process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT = '99999';

  kit.__setFetch(async (url) => {
    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 42, email_address: 'jane@example.com' } }),
      };
    }
    throw new Error('Kit tag endpoint error');
  });

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_kit_fail',
      metadata: { base_slug: 'blueprint', customer_email: 'jane@example.com' },
    },
    stripeClient: {
      paymentIntents: { update: async () => ({}) },
    },
  });

  const kitAlert = alerts.find((a) => a.failedStep === 'kit');
  assert.ok(kitAlert, 'Expected a kit alert');
  assert.equal(kitAlert.paymentId, 'pi_kit_fail');
  assert.equal(kitAlert.provider, 'stripe');

  fulfillPaymentIntent.__resetForTests();
  kit.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT;
});

test('fulfillPaymentIntent sends alert for unknown product slug', async () => {
  const alerts = [];

  fulfillPaymentIntent.__setAlertFn(async (args) => { alerts.push(args); });

  await assert.rejects(
    () =>
      fulfillPaymentIntent.fulfillPaymentIntent({
        paymentIntent: {
          id: 'pi_unknown_product',
          metadata: { base_slug: 'nonexistent-product', customer_email: 'jane@example.com' },
        },
        stripeClient: {
          paymentIntents: { update: async () => ({}) },
        },
      }),
    /Unsupported fulfillment product slug/
  );

  const productAlert = alerts.find((a) => a.failedStep === 'unknown_product');
  assert.ok(productAlert, 'Expected an unknown_product alert');
  assert.equal(productAlert.paymentId, 'pi_unknown_product');
  assert.equal(productAlert.customerEmail, 'jane@example.com');

  fulfillPaymentIntent.__resetForTests();
});

test('fulfillPaymentIntent alert does not block success flow when alert itself fails', async () => {
  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async () => {
        throw new Error('Resend API down');
      },
    },
  }));
  fulfillPaymentIntent.__setAlertFn(async () => {
    throw new Error('Alert service also down');
  });
  process.env.RESEND_API_KEY = 're_test_key';

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_alert_fail',
      metadata: { base_slug: 'blueprint', customer_email: 'jane@example.com' },
    },
    stripeClient: {
      paymentIntents: { update: async () => ({}) },
    },
  });

  assert.equal(result.alreadyFulfilled, false);

  fulfillPaymentIntent.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

// ---- Wiring: fulfillPayPalOrder triggers alerts ----

test('fulfillPayPalOrder sends alert when Google Drive sharing fails', async () => {
  const alerts = [];

  fulfillPayPalOrder.__setAlertFn(async (args) => { alerts.push(args); });

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      throw new Error('PayPal Drive token error');
    }
    throw new Error('Unexpected fetch');
  });

  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
  process.env.GOOGLE_REFRESH_TOKEN = 'gtoken';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_xyz';

  await fulfillPayPalOrder({
    purchase: { baseSlug: 'blueprint', upsellSlug: '' },
    customer: { email: 'paypal@example.com', customerName: 'PP User' },
    orderID: 'ORDER_paypal_123',
  });

  const driveAlert = alerts.find((a) => a.failedStep === 'drive');
  assert.ok(driveAlert, 'Expected a drive alert for PayPal');
  assert.equal(driveAlert.provider, 'paypal');
  assert.equal(driveAlert.paymentId, 'ORDER_paypal_123');
  assert.equal(driveAlert.customerEmail, 'paypal@example.com');

  fulfillPayPalOrder.__resetForTests();
  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('fulfillPayPalOrder sends alert when confirmation email fails', async () => {
  const alerts = [];

  fulfillPayPalOrder.__setAlertFn(async (args) => { alerts.push(args); });
  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async () => {
        throw new Error('PayPal email send error');
      },
    },
  }));
  process.env.RESEND_API_KEY = 're_test_key';

  await fulfillPayPalOrder({
    purchase: { baseSlug: 'blueprint', upsellSlug: '' },
    customer: { email: 'paypal@example.com', customerName: 'PP User' },
    orderID: 'ORDER_paypal_456',
  });

  const emailAlert = alerts.find((a) => a.failedStep === 'email');
  assert.ok(emailAlert, 'Expected an email alert for PayPal');
  assert.equal(emailAlert.provider, 'paypal');
  assert.equal(emailAlert.paymentId, 'ORDER_paypal_456');

  fulfillPayPalOrder.__resetForTests();
  fulfillPaymentIntent.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('fulfillPayPalOrder sends alert when Kit tagging fails', async () => {
  const alerts = [];

  fulfillPayPalOrder.__setAlertFn(async (args) => { alerts.push(args); });
  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: { send: async () => ({ id: 'ok' }) },
  }));
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.KIT_API_KEY = 'kit_key';
  process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT = '99999';

  kit.__setFetch(async (url) => {
    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 42, email_address: 'paypal@example.com' } }),
      };
    }
    throw new Error('Kit PayPal tag error');
  });

  await fulfillPayPalOrder({
    purchase: { baseSlug: 'blueprint', upsellSlug: '' },
    customer: { email: 'paypal@example.com', customerName: 'PP User' },
    orderID: 'ORDER_paypal_789',
  });

  const kitAlert = alerts.find((a) => a.failedStep === 'kit');
  assert.ok(kitAlert, 'Expected a kit alert for PayPal');
  assert.equal(kitAlert.provider, 'paypal');
  assert.equal(kitAlert.paymentId, 'ORDER_paypal_789');

  fulfillPayPalOrder.__resetForTests();
  fulfillPaymentIntent.__resetForTests();
  kit.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT;
});
