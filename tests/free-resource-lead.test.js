const test = require('node:test');
const assert = require('node:assert/strict');

const freeResourceLeadHandler = require('../api/leads.js');
const freeResource = require('../api/_lib/_free-resource.js');
const kit = require('../api/_lib/_kit.js');
const store = require('../api/_lib/_resource-sync-store.js');
const sendResourceSyncAlert = require('../api/_lib/_resource-sync-alert.js');

function mockLedger(calls) {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  store.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => [{ id: 'lead-1' }] };
  });
}

function resetLedger() {
  store.__resetForTests();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

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

// Captures every Resend send so tests can assert subject/link/recipient.
function mockResend(sentEmails) {
  freeResource.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));
}

// Kit v4 mock that records calls and always succeeds.
function mockKitApiOk(calls) {
  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ subscriber: { id: 777, email_address: 'jane@example.com' } }),
    };
  });
}

test('sendDeliveryEmail emails the tracker link with the resource subject', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  const result = await freeResource.sendDeliveryEmail({
    resourceKey: 's1-tracker',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, 'hello@rohanstutoring.com');
  assert.equal(sent[0].to, 'jane@example.com');
  assert.equal(sent[0].subject, 'Your free S1 Question Tracker is inside');
  assert.match(sent[0].html, /spreadsheets\/d\/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/);
  assert.match(sent[0].text, /spreadsheets\/d\/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('sendDeliveryEmail emails the S2 Slam System link', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  await freeResource.sendDeliveryEmail({
    resourceKey: 's2-slam-system',
    firstName: 'Krshna',
    email: 'krshna@example.com',
  });

  assert.equal(sent[0].subject, 'Your free S2 Slam System is inside');
  assert.match(sent[0].html, /www\.rohanstutoring\.com\/assets\/free-resources\/s2-slam-system\.pdf/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('sendDeliveryEmail throws when RESEND_API_KEY is missing', async () => {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    () => freeResource.sendDeliveryEmail({ resourceKey: 's1-tracker', email: 'jane@example.com' }),
    /RESEND_API_KEY/
  );
});

test('syncKitForResource enrolls the resource nurture sequence after form sync', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];
  mockKitApiOk(calls);

  const result = await freeResource.syncKitForResource({
    resourceKey: 's1-mock',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  const formCall = calls.find((c) => c.url.endsWith('/v4/forms/8717603/subscribers'));
  const sequenceCall = calls.find((c) => c.url.endsWith('/v4/sequences/2718570/subscribers'));

  assert.deepEqual(result, { synced: true });
  assert.ok(formCall, 'expected Kit form sync');
  assert.ok(sequenceCall, 'expected Kit nurture sequence enrollment');

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('syncKitForResource reports each failed Kit step for retry', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  kit.__setFetch(async () => {
    throw new Error('Kit network failure');
  });

  const result = await freeResource.syncKitForResource({
    resourceKey: 's1-mock',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.synced, false);
  assert.deepEqual(result.failedSteps, ['form', 'sequence']);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('sendDeliveryEmail rejects a Resend error result', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  freeResource.__setResendFactory(() => ({ emails: { send: async () => ({ data: null, error: { message: 'Sending blocked' } }) } }));
  await assert.rejects(
    () => freeResource.sendDeliveryEmail({ resourceKey: 'game-plan', email: 'jane@example.com' }),
    /Sending blocked/
  );
  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('handler records and alerts a failed Kit sync after delivering the PDF', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  const sent = [];
  const ledgerCalls = [];
  mockLedger(ledgerCalls);
  mockResend(sent);
  process.env.ADMIN_ALERT_EMAIL = 'owner@example.com';
  let alertSent = false;
  sendResourceSyncAlert.__setResendFactory(() => ({ emails: { send: async () => { alertSent = true; return { data: { id: 'alert-1' } }; } } }));
  kit.__setFetch(async () => {
    throw new Error('Kit down');
  });

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 's1-tracker', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'delivered_pending_sync');
  assert.equal(res.body.resource.name, 'S1 Question Tracker');
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(ledgerCalls.at(-1).options.body).outcome, 'sync_failed');
  assert.equal(alertSent, true);

  kit.__resetForTests();
  freeResource.__resetForTests();
  sendResourceSyncAlert.__resetForTests();
  resetLedger();
  delete process.env.ADMIN_ALERT_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
});

test('handler falls back on-page when the delivery email fails', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL = 'https://example.com/tracker-backup';
  const ledgerCalls = [];
  mockLedger(ledgerCalls);
  freeResource.__setResendFactory(() => ({
    emails: {
      send: async () => {
        throw new Error('Resend down');
      },
    },
  }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 's1-tracker', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, 'fallback');
  assert.equal(res.body.fallback.kind, 'download');
  assert.equal(res.body.fallback.url, 'https://example.com/tracker-backup');
  assert.equal(JSON.parse(ledgerCalls.at(-1).options.body).outcome, 'delivery_failed');

  freeResource.__resetForTests();
  resetLedger();
  delete process.env.RESEND_API_KEY;
  delete process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL;
});

test('handler does not email when the durable ledger cannot save the lead', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);
  const req = { method: 'POST', headers: { origin: 'https://www.rohanstutoring.com' }, body: { resourceKey: 'game-plan', email: 'jane@example.com' } };
  const res = createJsonResponseRecorder();
  await freeResourceLeadHandler(req, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, 'fallback');
  assert.equal(sent.length, 0);
  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('handler rejects an unknown resource key', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 'not-a-real-resource', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 400);
});

test('sendDeliveryEmail emails the March 2027 Game Plan PDF link', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  await freeResource.sendDeliveryEmail({
    resourceKey: 'game-plan',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(sent[0].subject, 'Your March 2027 Game Plan');
  assert.equal(sent[0].from, '"Rohan\'s GAMSAT" <hello@rohanstutoring.com>');
  assert.match(sent[0].html, /assets\/email\/rohans-gamsat-logo\.png/);
  assert.match(sent[0].html, /www\.rohanstutoring\.com\/assets\/free-resources\/march-2027-game-plan\.pdf/);
  assert.match(sent[0].html, /Hi Jane,/);
  assert.match(sent[0].html, /quiz\?utm_source=email&utm_medium=delivery&utm_campaign=march27_gameplan/);
  assert.match(sent[0].text, /march-2027-game-plan\.pdf/);
  assert.doesNotMatch(sent[0].html, /\u2014/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('Game Plan email escapes HTML typed into the first name field', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  await freeResource.sendDeliveryEmail({
    resourceKey: 'game-plan',
    firstName: '<a href="https://evil.example">Click</a>',
    email: 'jane@example.com',
  });

  assert.doesNotMatch(sent[0].html, /<a href="https:\/\/evil\.example">/);
  assert.match(sent[0].html, /&lt;a href=/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('syncKitForResource upserts the Game Plan lead and tags lm_march27_gameplan', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];
  mockKitApiOk(calls);

  const result = await freeResource.syncKitForResource({
    resourceKey: 'game-plan',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.deepEqual(result, { synced: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v4\/subscribers$/);
  const upsertBody = JSON.parse(calls[0].options.body);
  assert.equal(upsertBody.email_address, 'jane@example.com');
  assert.equal(upsertBody.first_name, 'Jane');
  assert.match(calls[1].url, /\/v4\/tags\/24104655\/subscribers\/777$/);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('a delayed retry never reactivates an inactive Kit subscriber', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];
  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ subscribers: [{ id: 777, email_address: 'jane@example.com', state: 'cancelled' }] }) };
  });
  const result = await freeResource.syncKitForResource(
    { resourceKey: 'game-plan', email: 'jane@example.com' },
    { preserveInactive: true }
  );
  assert.equal(result.reason, 'inactive_subscriber');
  assert.equal(result.permanent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'GET');
  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('Game Plan fallback links straight to the hosted PDF when email delivery fails', () => {
  const payload = freeResource.buildFallbackPayload({ resourceKey: 'game-plan' });

  assert.equal(payload.fallback.kind, 'download');
  assert.equal(payload.fallback.url, 'https://www.rohanstutoring.com/assets/free-resources/march-2027-game-plan.pdf');
});
