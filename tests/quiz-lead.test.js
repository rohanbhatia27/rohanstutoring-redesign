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

test('syncQuizLead tags each current quiz outcome with its configured Kit tag', async () => {
  const calls = [];
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.KIT_TAG_ID_QUIZ_START_HERE = '19492824';
  process.env.KIT_TAG_ID_QUIZ_BLUEPRINT = '19492825';
  process.env.KIT_TAG_ID_QUIZ_COMPREHENSIVE = '19492826';
  process.env.KIT_TAG_ID_QUIZ_MASTERY = '19492827';

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          subscriber: {
            id: 777,
            email_address: 'jane@example.com',
          },
        }),
      };
    }

    if (/\/v4\/tags\/1949282[4-7]\/subscribers\/777$/.test(url)) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          subscriber: {
            id: 777,
            email_address: 'jane@example.com',
          },
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  for (const outcome of ['START_HERE', 'BLUEPRINT', 'COMPREHENSIVE', 'MASTERY_CALL']) {
    await kit.syncQuizLead({
      firstName: 'Jane',
      email: 'jane@example.com',
      outcome,
    });
  }

  const tagUrls = calls
    .map((call) => call.url)
    .filter((url) => url.includes('/v4/tags/'));

  assert.equal(tagUrls.length, 4);
  assert.match(tagUrls[0], /\/v4\/tags\/19492824\/subscribers\/777$/);
  assert.match(tagUrls[1], /\/v4\/tags\/19492825\/subscribers\/777$/);
  assert.match(tagUrls[2], /\/v4\/tags\/19492826\/subscribers\/777$/);
  assert.match(tagUrls[3], /\/v4\/tags\/19492827\/subscribers\/777$/);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_TAG_ID_QUIZ_START_HERE;
  delete process.env.KIT_TAG_ID_QUIZ_BLUEPRINT;
  delete process.env.KIT_TAG_ID_QUIZ_COMPREHENSIVE;
  delete process.env.KIT_TAG_ID_QUIZ_MASTERY;
});

test('syncQuizLead still saves a lead when the outcome tag is not configured', async () => {
  const calls = [];
  const warnings = [];
  const originalWarn = console.warn;
  process.env.KIT_API_KEY = 'kit_test_123';
  delete process.env.KIT_TAG_ID_QUIZ_BLUEPRINT;
  console.warn = (message) => warnings.push(message);

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url.endsWith('/v4/subscribers')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          subscriber: {
            id: 888,
            email_address: 'jane@example.com',
          },
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  try {
    const subscriber = await kit.syncQuizLead({
      firstName: 'Jane',
      email: 'jane@example.com',
      outcome: 'BLUEPRINT',
    });

    assert.equal(subscriber.id, 888);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v4\/subscribers$/);
    assert.deepEqual(JSON.parse(calls[0].options.body).fields, {
      quiz_outcome: 'BLUEPRINT',
    });
    assert.deepEqual(warnings, ['[kit] Missing KIT_TAG_ID_QUIZ_BLUEPRINT; quiz lead saved without outcome tag.']);
  } finally {
    console.warn = originalWarn;
    kit.__resetForTests();
    delete process.env.KIT_API_KEY;
  }
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
