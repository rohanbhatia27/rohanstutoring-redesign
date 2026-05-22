const test = require('node:test');
const assert = require('node:assert/strict');
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

test('fulfillment helper records fulfillment on the PaymentIntent metadata', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_123',
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
  assert.equal(updates.length, 1);
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
  const paymentIntent = {
    id: 'pi_essay123',
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
  assert.equal(updates.length, 1);
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
  delete process.env.ESSAY_UPLOAD_TOKEN_SECRET;
});

test('fulfillment helper records combined purchase metadata without breaking base fulfillment', async () => {
  const updates = [];
  const paymentIntent = {
    id: 'pi_456',
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
  assert.equal(updates.length, 1);
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
          metadata: {
            product_slug: 'blueprint',
            fulfillment_status: status,
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
          metadata: {
            product_slug: 'blueprint',
          },
        },
        stripeClient: {
          paymentIntents: {
            retrieve: async () => ({
              id: 'pi_789',
              metadata: {
                product_slug: 'blueprint',
                base_slug: 'blueprint',
                fulfillment_status: status,
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

test('fulfillment helper chooses the comprehensive welcome email template', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
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
  assert.match(sentEmails[0].html, /Tuesday 26 May at 6pm AEST/);
  fulfillPaymentIntent.__resetForTests();
});

test('fulfillment helper uses the S2-specific start time for s2-comprehensive', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
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

  assert.match(sentEmails[0].html, /Wednesday 27 May at 7pm AEST/);
  fulfillPaymentIntent.__resetForTests();
});

test('fulfillment helper uses Checkout Session customer details for instalment fulfillment', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
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
        return { id: 'email_123' };
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
        return { id: 'email_123' };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
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
        return { id: 'email_123' };
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
        return { id: 'email_123' };
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

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&sendNotificationEmail=true')) {
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

  assert.equal(updates.length, 2);
  assert.equal(updates[1].payload.metadata.drive_share_status, 'shared');
  assert.equal(updates[1].payload.metadata.drive_share_folder_id, 'folder_123');
  assert.equal(updates[1].payload.metadata.drive_share_permission_id, 'perm_123');

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK;
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

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&sendNotificationEmail=true')) {
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
