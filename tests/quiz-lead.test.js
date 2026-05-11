const test = require('node:test');
const assert = require('node:assert/strict');

const kit = require('../api/_lib/_kit.js');
const quizLeadHandler = require('../api/quiz-lead.js');

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

test('syncQuizLead upserts the subscriber and tags START_HERE outcomes', async () => {
  const calls = [];
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_QUIZ_START_HERE = '19492824';

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          subscriber: {
            id: 555,
            email_address: 'jane@example.com',
          },
        }),
      };
    }

    if (url.endsWith('/v4/tags/19492824/subscribers/555')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          subscriber: {
            id: 555,
            email_address: 'jane@example.com',
          },
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const subscriber = await kit.syncQuizLead({
    firstName: 'Jane',
    email: 'jane@example.com',
    outcome: 'START_HERE',
  });

  assert.equal(subscriber.id, 555);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v4\/subscribers$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email_address: 'jane@example.com',
    state: 'active',
    first_name: 'Jane',
    fields: {
      quiz_outcome: 'START_HERE',
    },
  });
  assert.match(calls[1].url, /\/v4\/tags\/19492824\/subscribers\/555$/);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_QUIZ_START_HERE;
});

test('quiz lead handler validates the payload and returns success for valid leads', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_QUIZ_START_HERE = '19492824';

  kit.__setFetch(async (url) => {
    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ subscriber: { id: 123 } }),
      };
    }

    if (url.endsWith('/v4/tags/19492824/subscribers/123')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ subscriber: { id: 123 } }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: {
      firstName: 'Jane',
      email: 'jane@example.com',
      outcome: 'START_HERE',
    },
  };
  const res = createJsonResponseRecorder();

  await quizLeadHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_QUIZ_START_HERE;
});

test('quiz lead handler rejects invalid email addresses', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: {
      firstName: 'Jane',
      email: 'not-an-email',
      outcome: 'START_HERE',
    },
  };
  const res = createJsonResponseRecorder();

  await quizLeadHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Please enter a valid email address.' });
});
