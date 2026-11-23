const test = require('node:test');
const assert = require('node:assert/strict');

const deliveryStore = require('../api/_lib/_email-delivery-store.js');
test.beforeEach(() => {
  const rows = new Map();
  deliveryStore.__setRequest(async (method, data) => {
    if (method === 'reserve' && !rows.has(data.delivery_key)) rows.set(data.delivery_key, { ...data, status: 'pending', created_at: new Date().toISOString() });
    if (method === 'get') return rows.get(data.delivery_key);
    if (method === 'complete') Object.assign(rows.get(data.delivery_key), { status: 'sent', message_id: data.messageId });
  });
});
test.afterEach(() => deliveryStore.__resetForTests());
const { EventEmitter } = require('node:events');

const fulfillPaymentIntent = require('../api/_lib/_fulfill-payment-intent.js');
const googleDrive = require('../api/_lib/_google-drive.js');
const kit = require('../api/_lib/_kit.js');
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

test('fulfillment helper refuses a PaymentIntent that is not paid', async () => {
  let updated = false;
  await assert.rejects(
    fulfillPaymentIntent.fulfillPaymentIntent({
      paymentIntent: { id: 'pi_unpaid', status: 'requires_payment_method', metadata: { base_slug: 'blueprint' } },
      stripeClient: { paymentIntents: {
        retrieve: async () => ({ id: 'pi_unpaid', status: 'requires_payment_method', metadata: { base_slug: 'blueprint' } }),
        update: async () => { updated = true; },
      } },
    }),
    /has not succeeded/
  );
  assert.equal(updated, false);
});

test('fulfillment helper records fulfillment on the PaymentIntent metadata', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_123',
    status: 'succeeded',
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
  assert.ok(updates.length >= 1);
  assert.equal(updates[0].id, 'pi_123');
  assert.equal(updates[0].payload.metadata.fulfillment_status, 'manual_fulfillment_pending');
  assert.equal(updates[0].payload.metadata.manual_fulfillment_required, 'true');
  assert.equal(updates[0].payload.metadata.fulfillment_requested_at, '2026-04-19T12:00:00.000Z');
  assert.equal(updates[0].payload.metadata.fulfillment_source, 'stripe-webhook');
  assert.equal(updates[0].payload.metadata.fulfillment_delivery_type, 'digital-access');
  assert.equal(updates[0].payload.metadata.fulfillment_label, 'Send Google Drive access');
  assert.equal(updates[0].payload.metadata.base_slug, 'blueprint');
  assert.equal(updates[0].payload.metadata.fulfillment_product_slugs, 'blueprint');
});

test('fulfillment helper preserves essay upload instructions for manual recovery', async () => {
  process.env.ESSAY_UPLOAD_TOKEN_SECRET = 'upload_secret_for_tests';
  const updates = [];
  const alerts = [];
  fulfillPaymentIntent.__setAlertFn(async (args) => {
    alerts.push(args);
  });
  const paymentIntent = {
    id: 'pi_essay123',
    status: 'succeeded',
    metadata: {
      base_slug: 'essay-marking',
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
  assert.ok(updates.length >= 1);
  assert.equal(
    updates[0].payload.metadata.essay_upload_url,
    'https://tally.so/r/zxQdMR?payment_intent=pi_essay123&product=essay-marking&upload_token=4bf2dcdd522ca15ad48c9c7e6a08533f89e2ceaa2c8be2fa65b64e3568c860b6&source=stripe_webhook'
  );
  assert.equal(
    updates[0].payload.metadata.essay_upload_token,
    '4bf2dcdd522ca15ad48c9c7e6a08533f89e2ceaa2c8be2fa65b64e3568c860b6'
  );
  assert.equal(updates[0].payload.metadata.essay_upload_required, 'true');
  assert.equal(
    updates[0].payload.metadata.essay_upload_instructions,
    'Upload via essay_upload_url or email essays@rohanstutoring.com with this PaymentIntent ID.'
  );
  assert.equal(alerts.filter((alert) => alert.failedStep === 'drive').length, 0);
  fulfillPaymentIntent.__resetForTests();
  delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
});

test('fulfillment retry keeps essay upload fulfillment without retrying Drive sharing', async () => {
  process.env.ESSAY_UPLOAD_TOKEN_SECRET = 'upload_secret_for_tests';
  const updates = [];
  const alerts = [];

  fulfillPaymentIntent.__setAlertFn(async (args) => {
    alerts.push(args);
  });

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_3Tv5xeH5JsZI731G0EwGKlau',
      status: 'succeeded',
      metadata: {
        base_slug: 'essay-marking',
        customer_email: 'jane@example.com',
        fulfillment_status: 'manual_fulfillment_pending',
        drive_share_status: 'missing_folder_mapping',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
    forceAutomation: true,
  });

  assert.equal(result.alreadyFulfilled, false);
  assert.equal(alerts.filter((alert) => alert.failedStep === 'drive').length, 0);
  const finalMetadata = updates[updates.length - 1].payload.metadata;
  assert.equal(finalMetadata.essay_upload_required, 'true');
  assert.match(finalMetadata.essay_upload_url, /payment_intent=pi_3Tv5xeH5JsZI731G0EwGKlau/);

  fulfillPaymentIntent.__resetForTests();
  delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
});

test('fulfillment helper records combined purchase metadata without breaking base fulfillment', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_456',
    status: 'succeeded',
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
  assert.ok(updates.length >= 1);
  assert.equal(updates[0].payload.metadata.fulfillment_delivery_type, 'cohort-onboarding+booking-link');
  assert.equal(
    updates[0].payload.metadata.fulfillment_label,
    'Send cohort onboarding email + Send mentoring booking link'
  );
  assert.equal(updates[0].payload.metadata.fulfillment_product_slugs, 'comprehensive,private-mentoring');
});

test('fulfillment helper skips duplicate webhook deliveries once fulfillment is final', async (t) => {
  for (const status of ['fulfilled', 'manual_fulfillment_pending']) {
    await t.test(`skips duplicate ${status} status`, async () => {
      let updateCalled = false;

      const result = await fulfillPaymentIntent.fulfillPaymentIntent({
        paymentIntent: {
          id: 'pi_123',
          status: 'succeeded',
          metadata: {
            product_slug: 'blueprint',
            fulfillment_status: status,
            drive_share_status: 'shared',
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
  }
});

test('fulfillment helper skips stale webhook replays when Stripe already shows final fulfillment', async (t) => {
  for (const status of ['fulfilled', 'manual_fulfillment_pending']) {
    await t.test(`skips stale replay for ${status} status`, async () => {
      let updateCalled = false;

      const result = await fulfillPaymentIntent.fulfillPaymentIntent({
        paymentIntent: {
          id: 'pi_789',
          status: 'succeeded',
          metadata: {
            product_slug: 'blueprint',
          },
        },
        stripeClient: {
          paymentIntents: {
            retrieve: async () => ({
              id: 'pi_789',
              status: 'succeeded',
              metadata: {
                product_slug: 'blueprint',
                base_slug: 'blueprint',
                fulfillment_status: status,
                drive_share_status: 'shared',
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
  }
});

test('fulfillment helper retries Blueprint-family Drive sharing when fulfillment is pending but Drive is not shared', async () => {
  const updates = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&sendNotificationEmail=false')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_blueprint', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_pending_drive',
      status: 'succeeded',
      metadata: {
        product_slug: 'blueprint',
        base_slug: 'blueprint',
        fulfillment_status: 'manual_fulfillment_pending',
        customer_email: 'jane@example.com',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
  });

  assert.equal(result.alreadyFulfilled, false);
  const finalMetadata = updates[updates.length - 1].payload.metadata;
  assert.equal(finalMetadata.drive_share_status, 'shared');
  assert.equal(finalMetadata.drive_share_folder_env, 'GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT');
  assert.equal(finalMetadata.drive_share_permission_id, 'perm_blueprint');

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('fulfillment helper chooses the comprehensive welcome email template', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
      status: 'succeeded',
      metadata: {
        base_slug: 'comprehensive',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => ({}),
      },
    },
  });

  assert.equal(sentEmails[0].from, 'hello@rohanstutoring.com');
  assert.equal(sentEmails[0].subject, "Welcome to the Comprehensive Course 👋 Let's get started.");
  assert.match(sentEmails[0].html, /latest live-class schedule/);
  assert.doesNotMatch(sentEmails[0].html, /June cohort starts/i);
  fulfillPaymentIntent.__resetForTests();
});

test('fulfillment helper uses the S2-specific start time for s2-comprehensive', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
      status: 'succeeded',
      metadata: {
        base_slug: 's2-comprehensive',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => ({}),
      },
    },
  });

  assert.match(sentEmails[0].html, /latest live-class schedule/);
  assert.doesNotMatch(sentEmails[0].html, /June cohort starts/i);
  fulfillPaymentIntent.__resetForTests();
});

test('fulfillment helper uses Checkout Session customer details for instalment fulfillment', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  const result = await fulfillPaymentIntent.fulfillInstalmentCheckout({
    session: {
      id: 'cs_test_123',
      metadata: {
        product_slug: 'comprehensive',
        payment_mode: 'instalments',
      },
      customer_details: {
        email: 'jane@example.com',
        name: 'Jane Smith',
      },
    },
  });

  assert.equal(result.plan.productSlug, 'comprehensive');
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'jane@example.com');
  assert.match(sentEmails[0].html, /Hey Jane,/);

  fulfillPaymentIntent.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('fulfillment helper tags instalment buyers in Kit', async () => {
  const sentEmails = [];
  const calls = [];
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_PURCHASED_COMPREHENSIVE = '19492825';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    if (url.endsWith('/v4/tags/19492825/subscribers/789')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await fulfillPaymentIntent.fulfillInstalmentCheckout({
    session: {
      id: 'cs_test_456',
      metadata: {
        product_slug: 'comprehensive',
        payment_mode: 'instalments',
      },
      customer_details: {
        email: 'jane@example.com',
        name: 'Jane Smith',
      },
    },
  });

  assert.equal(result.plan.productSlug, 'comprehensive');
  assert.equal(sentEmails.length, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v4\/subscribers$/);
  assert.match(calls[1].url, /\/v4\/tags\/19492825\/subscribers\/789$/);

  fulfillPaymentIntent.__resetForTests();
  kit.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_COMPREHENSIVE;
});

test('fulfillment helper does not reuse the comprehensive template for mastery', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
      status: 'succeeded',
      metadata: {
        base_slug: 'mastery',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => ({}),
      },
    },
  });

  assert.doesNotMatch(sentEmails[0].subject, /Welcome to the Comprehensive Course/);
  fulfillPaymentIntent.__resetForTests();
});

test('fulfillment helper tags mastery buyers in Kit for full-price and instalment checkouts', async () => {
  const sentEmails = [];
  const calls = [];
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_PURCHASED_MASTERY = '19492827';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    if (url.endsWith('/v4/tags/19492827/subscribers/789')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_mastery_full',
      status: 'succeeded',
      metadata: {
        base_slug: 'mastery',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => ({}),
      },
    },
  });

  await fulfillPaymentIntent.fulfillInstalmentCheckout({
    session: {
      id: 'cs_mastery_instalment',
      metadata: {
        product_slug: 'mastery',
        payment_mode: 'instalments',
      },
      customer_details: {
        email: 'jane@example.com',
        name: 'Jane Smith',
      },
    },
  });

  assert.equal(sentEmails.length, 2);
  assert.equal(calls.length, 4);
  assert.match(calls[1].url, /\/v4\/tags\/19492827\/subscribers\/789$/);
  assert.match(calls[3].url, /\/v4\/tags\/19492827\/subscribers\/789$/);

  fulfillPaymentIntent.__resetForTests();
  kit.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_MASTERY;
});

test('fulfillment helper tags supported product buyers in Kit', async () => {
  const sentEmails = [];
  const calls = [];
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT = '19492824';
  process.env.KIT_TAG_ID_PURCHASED_COMPREHENSIVE = '19492825';
  process.env.KIT_TAG_ID_PURCHASED_MASTERY = '19492827';
  process.env.KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK = '19492826';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { data: { id: 'email_123' }, error: null };
      },
    },
  }));

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    if (/\/v4\/tags\/1949282[4-7]\/subscribers\/789$/.test(url)) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  for (const baseSlug of ['blueprint', 'comprehensive', 'mastery', 'starter-pack']) {
    await fulfillPaymentIntent.fulfillPaymentIntent({
      paymentIntent: {
        id: `pi_kit_${baseSlug}`,
        status: 'succeeded',
        metadata: {
          base_slug: baseSlug,
          customer_email: 'jane@example.com',
          customer_name: 'Jane Smith',
        },
      },
      stripeClient: {
        paymentIntents: {
          update: async () => ({}),
        },
      },
    });
  }

  assert.equal(sentEmails.length, 4);
  assert.equal(calls.length, 8);
  assert.match(calls[0].url, /\/v4\/subscribers$/);
  assert.match(calls[1].url, /\/v4\/tags\/19492824\/subscribers\/789$/);
  assert.match(calls[3].url, /\/v4\/tags\/19492825\/subscribers\/789$/);
  assert.match(calls[5].url, /\/v4\/tags\/19492827\/subscribers\/789$/);
  assert.match(calls[7].url, /\/v4\/tags\/19492826\/subscribers\/789$/);

  fulfillPaymentIntent.__resetForTests();
  kit.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT;
  delete process.env.KIT_TAG_ID_PURCHASED_COMPREHENSIVE;
  delete process.env.KIT_TAG_ID_PURCHASED_MASTERY;
  delete process.env.KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK;
});

test('fulfillment helper shares starter-pack Drive access and records share metadata', async () => {
  const updates = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK = 'folder_123';

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&sendNotificationEmail=false')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_123', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_drive123',
      status: 'succeeded',
      metadata: {
        base_slug: 'starter-pack',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
  });

  assert.ok(updates.length >= 2);
  assert.equal(updates[1].payload.metadata.drive_share_status, 'shared');
  assert.equal(updates[1].payload.metadata.drive_share_folder_id, 'folder_123');
  assert.equal(updates[1].payload.metadata.drive_share_permission_id, 'perm_123');

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK;
});

test('fulfillment helper shares Blueprint Drive access for Blueprint, Comprehensive, and Mastery enrolments', async () => {
  const updatesByPayment = new Map();
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&sendNotificationEmail=false')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_blueprint', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  for (const baseSlug of ['blueprint', 'comprehensive', 'mastery']) {
    await fulfillPaymentIntent.fulfillPaymentIntent({
      paymentIntent: {
        id: `pi_drive_${baseSlug}`,
        status: 'succeeded',
        metadata: {
          base_slug: baseSlug,
          customer_email: `${baseSlug}@example.com`,
          customer_name: 'Jane Smith',
        },
      },
      stripeClient: {
        paymentIntents: {
          update: async (id, payload) => {
            if (!updatesByPayment.has(id)) updatesByPayment.set(id, []);
            updatesByPayment.get(id).push(payload);
            return { id, metadata: payload.metadata };
          },
        },
      },
    });
  }

  for (const baseSlug of ['blueprint', 'comprehensive', 'mastery']) {
    const updates = updatesByPayment.get(`pi_drive_${baseSlug}`);
    const finalMetadata = updates[updates.length - 1].metadata;
    assert.equal(finalMetadata.drive_share_status, 'shared');
    assert.equal(finalMetadata.drive_share_folder_id, 'folder_blueprint');
    assert.equal(finalMetadata.drive_share_folder_env, 'GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT');
    assert.equal(finalMetadata.drive_share_permission_id, 'perm_blueprint');
  }

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('fulfillment helper records OAuth/Drive failures in metadata for manual recovery', async () => {
  const updates = [];
  const alerts = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  fulfillPaymentIntent.__setAlertFn(async (args) => {
    alerts.push(args);
  });

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_scope' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_drive_oauth_fail',
      status: 'succeeded',
      metadata: {
        base_slug: 'blueprint',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
    now: () => '2026-05-22T02:00:00.000Z',
  });

  const finalMetadata = updates[updates.length - 1].payload.metadata;
  assert.equal(finalMetadata.drive_share_status, 'failed');
  assert.match(finalMetadata.drive_share_error, /Drive scope/);
  assert.equal(finalMetadata.drive_share_failed_at, '2026-05-22T02:00:00.000Z');
  assert.equal(alerts[0].failedStep, 'drive');

  fulfillPaymentIntent.__resetForTests();
  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('fulfillment helper preserves Drive metadata when Kit tagging also succeeds', async () => {
  const updates = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK = 'folder_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK = '19492826';

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&sendNotificationEmail=false')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_123', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected Drive fetch URL: ${url}`);
  });

  kit.__setFetch(async (url) => {
    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    if (url.endsWith('/v4/tags/19492826/subscribers/789')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ subscriber: { id: 789, email_address: 'jane@example.com' } }),
      };
    }

    throw new Error(`Unexpected Kit fetch URL: ${url}`);
  });

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_drive_kit_123',
      status: 'succeeded',
      metadata: {
        base_slug: 'starter-pack',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async (id, payload) => {
          updates.push({ id, payload });
          return { id, metadata: payload.metadata };
        },
      },
    },
    now: () => '2026-05-22T01:00:00.000Z',
  });

  const finalMetadata = updates[updates.length - 1].payload.metadata;
  assert.equal(finalMetadata.drive_share_status, 'shared');
  assert.equal(finalMetadata.drive_share_folder_id, 'folder_123');
  assert.equal(finalMetadata.drive_share_permission_id, 'perm_123');
  assert.equal(finalMetadata.kit_purchase_tag_status, 'tagged');
  assert.equal(finalMetadata.kit_purchase_tagged_at, '2026-05-22T01:00:00.000Z');

  googleDrive.__resetForTests();
  kit.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK;
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

test('stripe webhook accepts an untouched Buffer payload for signature verification', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  const seenPayloads = [];
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent(payload) {
        seenPayloads.push(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              metadata: {
                product_slug: 'blueprint',
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
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => ({ alreadyFulfilled: false }));

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
  assert.deepEqual(seenPayloads, ['{"id":"evt_123","object":"event"}']);
  stripeWebhookHandler.__resetForTests();
});

test('stripe webhook reads production request streams before touching body helpers', async (t) => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  t.after(() => {
    stripeWebhookHandler.__resetForTests();
  });

  const seenPayloads = [];
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent(payload) {
        seenPayloads.push(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              metadata: {
                product_slug: 'blueprint',
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
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => ({ alreadyFulfilled: false }));

  let bodyGetterAccessed = false;
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = {
    'stripe-signature': 't=123,v1=abc',
  };
  Object.defineProperty(req, 'body', {
    get() {
      bodyGetterAccessed = true;
      throw new Error('body helper should not be accessed before raw stream');
    },
  });

  process.nextTick(() => {
    req.emit('data', Buffer.from('{"id":"evt_123","object":"event"}'));
    req.emit('end');
  });

  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(bodyGetterAccessed, false);
  assert.deepEqual(seenPayloads, ['{"id":"evt_123","object":"event"}']);
});

test('stripe webhook rejects parsed object bodies because signature verification requires raw bytes', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  let constructEventCalled = false;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        constructEventCalled = true;
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              metadata: {},
            },
          },
        };
      },
    },
    paymentIntents: {
      update: async () => undefined,
    },
  }));

  const req = {
    method: 'POST',
    headers: {
      'stripe-signature': 't=123,v1=abc',
    },
    body: {
      id: 'evt_123',
      object: 'event',
    },
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid Stripe webhook.' });
  assert.equal(constructEventCalled, false);
  stripeWebhookHandler.__resetForTests();
});

test('stripe webhook skips fulfillment for subscription-linked payment intents', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  let fulfillCalled = false;

  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_sub_renewal',
              invoice: 'in_abc123',
              metadata: {},
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
    fulfillCalled = true;
    return { alreadyFulfilled: false };
  });

  const req = {
    method: 'POST',
    headers: { 'stripe-signature': 't=123,v1=abc' },
    body: Buffer.from('{"id":"evt_sub_renewal"}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { received: true });
  assert.equal(fulfillCalled, false);
  stripeWebhookHandler.__resetForTests();
});

test('syncPurchaseTag applies the Customer tag to products with no product-specific purchase tag', async () => {
  // essay-marking has no purchaseTagEnv, but buyers must still get the master
  // Customer tag so the abandoned-checkout suppression rule pulls them out.
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_CUSTOMER = '20075421';

  const calls = [];
  kit.__setFetch(async (url) => {
    calls.push(url);
    if (url.endsWith('/v4/subscribers')) {
      return { ok: true, status: 200, json: async () => ({ subscriber: { id: 789 } }) };
    }
    if (url.endsWith('/v4/tags/20075421/subscribers/789')) {
      return { ok: true, status: 201, json: async () => ({ subscriber: { id: 789 } }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await kit.syncPurchaseTag({
    baseSlug: 'essay-marking',
    email: 'jane@example.com',
    customerName: 'Jane Smith',
  });

  assert.equal(result.skipped, false);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/v4\/subscribers$/);
  assert.match(calls[1], /\/v4\/tags\/20075421\/subscribers\/789$/);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_CUSTOMER;
});

test('syncPurchaseTag surfaces Customer tag failures for supported product buyers', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT = '19492824';
  process.env.KIT_TAG_ID_CUSTOMER = '20075421';

  kit.__setFetch(async (url) => {
    if (url.endsWith('/v4/subscribers')) {
      return { ok: true, status: 200, json: async () => ({ subscriber: { id: 789 } }) };
    }
    if (url.endsWith('/v4/tags/19492824/subscribers/789')) {
      return { ok: true, status: 201, json: async () => ({ subscriber: { id: 789 } }) };
    }
    if (url.endsWith('/v4/tags/20075421/subscribers/789')) {
      return { ok: false, status: 500, json: async () => ({ errors: ['Customer tag failed'] }) };
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  await assert.rejects(
    () => kit.syncPurchaseTag({
      baseSlug: 'blueprint',
      email: 'jane@example.com',
      customerName: 'Jane Smith',
    }),
    /Customer tag failed/
  );

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_PURCHASED_BLUEPRINT;
  delete process.env.KIT_TAG_ID_CUSTOMER;
});

test('replayed legacy instalment checkout never changes its existing subscription', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_example';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
  let touched = false, fulfilled = false;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_old', subscription: 'sub_existing', metadata: { payment_mode: 'instalments', base_slug: 'comprehensive' } } } }) },
    subscriptions: { retrieve: async () => { touched = true; throw new Error('Unexpected subscription access'); } },
  }));
  stripeWebhookHandler.__setFulfillInstalmentCheckout(async () => { fulfilled = true; });
  stripeWebhookHandler.__setSendGa4Purchase(async () => {});
  const res = createJsonResponseRecorder();
  try {
    await stripeWebhookHandler({ method: 'POST', headers: { 'stripe-signature': 'sig' }, rawBody: Buffer.from('{}') }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(touched, false);
    assert.equal(fulfilled, true);
  } finally {
    stripeWebhookHandler.__resetForTests();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('instalment webhook configures schedule before fulfilment', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_example';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_example';
  const order = [];
  const start = 1767225600;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_test', subscription: 'sub_test', metadata: { payment_mode: 'instalments', base_slug: 'comprehensive', instalment_schedule_version: '1' } } } }) },
    subscriptions: { retrieve: async () => ({ start_date: start, items: { data: [{ price: { id: 'price_actual', recurring: { interval: 'month' } }, quantity: 1 }] } }) },
    subscriptionSchedules: {
      create: async () => ({ id: 'schedule', current_phase: { start_date: start } }),
      update: async () => { order.push('schedule'); return { end_behavior: 'cancel', phases: [{ start_date: start, end_date: 1777593600, items: [{ price: 'price_actual', quantity: 1 }] }] }; },
    },
  }));
  stripeWebhookHandler.__setFulfillInstalmentCheckout(async () => { order.push('fulfill'); });
  stripeWebhookHandler.__setSendGa4Purchase(async () => {});
  const res = createJsonResponseRecorder();
  try {
    await stripeWebhookHandler({ method: 'POST', headers: { 'stripe-signature': 'sig' }, rawBody: Buffer.from('{}') }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(order, ['schedule', 'fulfill']);
  } finally {
    stripeWebhookHandler.__resetForTests();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('fulfilment records and confirms the second add-on when it is purchased alone', async () => {
  const updates = [], emails = [];
  process.env.RESEND_API_KEY = 're_test_key';
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async options => { emails.push(options); return { data: { id: 'email_1' }, error: null }; } } }));
  try {
    await fulfillPaymentIntent({ paymentIntent: { id: 'pi_second', status: 'succeeded', metadata: { base_slug: 'blueprint', upsell_slug_2: 'essay-pack-10', customer_email: 'student@example.com' } }, stripeClient: { paymentIntents: { update: async (_, payload) => { updates.push(payload.metadata); } } } });
    assert.match(updates[0].fulfillment_product_slugs, /essay-pack-10/);
    assert.match(emails[0].text, /Essay Marking Pack \(10 credits\)/i);
    assert.match(emails[0].text, /essays@rohanstutoring\.com/);
  } finally { fulfillPaymentIntent.__resetForTests(); delete process.env.RESEND_API_KEY; }
});

test('a timed-out essay email is retried with its attachment and is not sent again after acceptance', async () => {
  process.env.RESEND_API_KEY = 're_test';
  let attempts = 0, state = { id: 'pi_essay_retry', status: 'succeeded', metadata: { base_slug: 'essay-collection', customer_email: 'student@example.com' } };
  const keys = [], messages = [];
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async (message, options) => {
    attempts++; keys.push(options.idempotencyKey); messages.push(message);
    if (attempts === 1) throw new Error('timeout');
    return { data: { id: 'msg_success' }, error: null };
  } } }));
  const stripeClient = { paymentIntents: { retrieve: async () => state, update: async (_, payload) => { state = { ...state, metadata: payload.metadata }; } } };
  try {
    await fulfillPaymentIntent({ paymentIntent: state, stripeClient });
    assert.equal(state.metadata.confirmation_email_status, 'failed');
    await fulfillPaymentIntent({ paymentIntent: state, stripeClient });
    assert.equal(state.metadata.confirmation_email_status, 'sent');
    await fulfillPaymentIntent({ paymentIntent: state, stripeClient });
    assert.equal(attempts, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(messages[1].attachments[0].filename, 'The Expert Essay Collection.pdf');
  } finally { fulfillPaymentIntent.__resetForTests(); delete process.env.RESEND_API_KEY; }
});

test('instalment fulfilment records the purchased add-ons and quantity on the subscription', async () => {
  process.env.RESEND_API_KEY = 'test';
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async () => ({ data: { id: 'msg' }, error: null }) } }));
  let saved;
  await assert.rejects(() => fulfillPaymentIntent.fulfillInstalmentCheckout({ session: { id: 'cs_123', subscription: 'sub_123', metadata: { base_slug: 'comprehensive', upsell_slug: 'mentoring-single', upsell_quantity: '3', customer_email: 'student@example.com' } }, stripeClient: { subscriptions: { update: async (id, value) => { saved = { id, ...value.metadata }; } } } }), /Google Drive folder|GOOGLE_DRIVE_FOLDER/);
  assert.equal(saved.id, 'sub_123');
  assert.match(saved.fulfillment_product_slugs, /private-mentoring/);
  assert.equal(saved.upsell_quantity, '3');
  fulfillPaymentIntent.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('multiple mentoring sessions appear in the fulfilment instructions and confirmation', async () => {
  process.env.RESEND_API_KEY = 'test';
  let recorded, message;
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async payload => { message = payload; return { data: { id: 'msg' }, error: null }; } } }));
  try {
    await fulfillPaymentIntent({ paymentIntent: { id: 'pi_quantity', status: 'succeeded', metadata: { base_slug: 'blueprint', upsell_slug: 'mentoring-single', upsell_quantity: '3', customer_email: 'student@example.com' } }, stripeClient: { paymentIntents: { update: async (_, payload) => { recorded ||= payload.metadata; } } } });
    assert.match(recorded.fulfillment_label, /3/);
    assert.match(message.text, /× 3/);
  } finally { fulfillPaymentIntent.__resetForTests(); delete process.env.RESEND_API_KEY; }
});

test('fulfilment matches the checkout order for each Blueprint add-on combination', async () => {
  const { resolveCheckoutPurchase } = require('../api/_lib/products.js');
  const cases = [
    { args: {}, slugs: ['blueprint'], names: ["Rohan's Blueprint"], amount: 59900 },
    { args: { upsellSlug: 'mentoring-single' }, slugs: ['blueprint', 'private-mentoring'], names: ['Private Mentoring Session'], amount: 69800 },
    { args: { upsellSlug2: 'essay-pack-10' }, slugs: ['blueprint', 'essay-pack-10'], names: ['Essay Marking Pack'], amount: 84800 },
    { args: { upsellSlug: 'mentoring-single', upsellSlug2: 'essay-pack-10' }, slugs: ['blueprint', 'private-mentoring', 'essay-pack-10'], names: ['Private Mentoring Session', 'Essay Marking Pack'], amount: 94700 },
    { args: { upsellSlug: 'mentoring-single', upsellQuantity: 3 }, slugs: ['blueprint', 'private-mentoring'], names: ['× 3'], amount: 89600 },
  ];
  process.env.RESEND_API_KEY = 'test';
  let message;
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async payload => { message = payload; return { data: { id: 'msg' }, error: null }; } } }));
  try {
    for (const [i, c] of cases.entries()) {
      const purchase = resolveCheckoutPurchase({ slug: 'blueprint', ...c.args });
      assert.equal(purchase.amount, c.amount);
      let metadata;
      await fulfillPaymentIntent({ paymentIntent: { id: `pi_matrix_${i}`, status: 'succeeded', amount: purchase.amount, metadata: { base_slug: purchase.baseSlug, upsell_slug: purchase.upsellSlug || '', upsell_slug_2: purchase.upsellSlug2 || '', upsell_quantity: String(purchase.upsellQuantity || 1), customer_email: 'student@example.com' } }, stripeClient: { paymentIntents: { update: async (_, payload) => { metadata ||= payload.metadata; } } } });
      assert.deepEqual(metadata.fulfillment_product_slugs.split(','), c.slugs);
      for (const name of c.names) assert.ok(message.text.includes(name), name);
    }
  } finally { fulfillPaymentIntent.__resetForTests(); delete process.env.RESEND_API_KEY; }
});

test('a missing add-on PDF retries independently of a successful welcome email', async () => {
  process.env.RESEND_API_KEY = 'test';
  let state = { id: 'pi_pdf_addon', status: 'succeeded', metadata: { base_slug: 'advanced', upsell_slug: 'essay-collection', customer_email: 'student@example.com' } }, welcomes = 0, pdfAttempts = 0;
  fulfillPaymentIntent.__setResendFactory(() => ({ emails: { send: async payload => {
    if (!payload.attachments) { welcomes++; return { data: { id: 'welcome' }, error: null }; }
    pdfAttempts++; if (pdfAttempts === 1) throw new Error('timeout');
    return { data: { id: 'pdf' }, error: null };
  } } }));
  const stripeClient = { paymentIntents: { retrieve: async () => state, update: async (_, payload) => { state = { ...state, metadata: payload.metadata }; } } };
  try {
    await fulfillPaymentIntent({ paymentIntent: state, stripeClient });
    assert.equal(state.metadata.confirmation_email_status, 'sent');
    assert.equal(state.metadata.essay_pdf_email_status, 'failed');
    await fulfillPaymentIntent({ paymentIntent: state, stripeClient });
    assert.equal(state.metadata.essay_pdf_email_status, 'sent');
    assert.equal(welcomes, 1);
    assert.equal(pdfAttempts, 2);
  } finally { fulfillPaymentIntent.__resetForTests(); delete process.env.RESEND_API_KEY; }
});
