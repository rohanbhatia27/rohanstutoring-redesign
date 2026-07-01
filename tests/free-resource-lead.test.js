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
  assert.match(sent[0].html, /download\.filekitcdn\.com\/d\/2hU8i25SXZz1XsLtQta7Yr\/9LJePVqF4moaNxMtw6K9uB/);

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
