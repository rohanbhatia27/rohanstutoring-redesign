const test = require('node:test');
const assert = require('node:assert/strict');

const freeResourceLeadHandler = require('../api/leads.js');
const freeResource = require('../api/_lib/_free-resource.js');
const kit = require('../api/_lib/_kit.js');

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

test('syncKitForResource swallows Kit failures and never throws', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  kit.__setFetch(async () => {
    throw new Error('Kit network failure');
  });

  const result = await freeResource.syncKitForResource({
    resourceKey: 's1-mock',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.synced, true);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('handler returns delivered even when Kit sync fails', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  const sent = [];
  mockResend(sent);
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
  assert.equal(res.body.status, 'delivered');
  assert.equal(res.body.resource.name, 'S1 Question Tracker');
  assert.equal(sent.length, 1);

  kit.__resetForTests();
  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
});

test('handler falls back on-page when the delivery email fails', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL = 'https://example.com/tracker-backup';
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

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL;
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
