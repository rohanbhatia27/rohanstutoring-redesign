const test = require('node:test');
const assert = require('node:assert/strict');

const freeResourceLeadHandler = require('../api/free-resource-lead.js');
const freeResource = require('../api/_lib/_free-resource.js');

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

test('submitKitResourceLead posts tracker leads to the matching Kit form endpoint', async () => {
  const calls = [];

  freeResource.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return { status: 302 };
  });

  await freeResource.submitKitResourceLead({
    resourceKey: 's1-tracker',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://app.kit.com/forms/8683298/subscriptions');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.match(calls[0].options.body, /email_address=jane%40example\.com/);
  assert.match(calls[0].options.body, /fields%5Bfirst_name%5D=Jane/);

  freeResource.__resetForTests();
});

test('free resource lead handler returns success when Kit accepts the signup', async () => {
  freeResource.__setFetch(async () => ({ status: 302 }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: {
      resourceKey: 's1-mock',
      firstName: 'Jane',
      email: 'jane@example.com',
    },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'kit');
  assert.equal(res.body.resource.name, 'S1 Mini Mock');

  freeResource.__resetForTests();
});

test('free resource lead handler returns a backup link and sends a fallback email when Kit fails', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL = 'https://example.com/tracker-backup';

  freeResource.__setFetch(async () => {
    throw new Error('Kit timeout');
  });
  freeResource.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: {
      resourceKey: 's1-tracker',
      firstName: 'Jane',
      email: 'jane@example.com',
    },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'fallback');
  assert.equal(res.body.fallback.kind, 'download');
  assert.equal(res.body.fallback.url, 'https://example.com/tracker-backup');
  assert.equal(res.body.fallback.emailSent, true);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'jane@example.com');
  assert.match(sentEmails[0].subject, /S1 Question Tracker/);
  assert.match(sentEmails[0].html, /tracker-backup/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL;
});

test('free resource lead handler falls back to a support mailto path when no backup link is configured', async () => {
  freeResource.__setFetch(async () => {
    throw new Error('Kit timeout');
  });

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: {
      resourceKey: 's1-mock',
      firstName: 'Jane',
      email: 'jane@example.com',
    },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'fallback');
  assert.equal(res.body.fallback.kind, 'contact');
  assert.match(res.body.fallback.url, /^mailto:hello@rohanstutoring\.com/);
  assert.equal(res.body.fallback.emailSent, false);

  freeResource.__resetForTests();
});
