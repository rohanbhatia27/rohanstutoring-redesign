const test = require('node:test');
const assert = require('node:assert/strict');

const kit = require('../api/_lib/_kit.js');

test('addSubscriberToSequence upserts then enrolls via the v4 sequence endpoint', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ subscriber: { id: 777, email_address: 'jane@example.com' } }),
    };
  });

  await kit.addSubscriberToSequence({
    sequenceId: '2723708',
    email: 'jane@example.com',
    firstName: 'Jane',
  });

  const upsertCall = calls.find((c) => c.url.endsWith('/v4/subscribers'));
  const seqCall = calls.find((c) => /\/v4\/sequences\/\d+\/subscribers$/.test(c.url));

  assert.ok(upsertCall, 'expected a subscriber upsert call');
  assert.equal(JSON.parse(upsertCall.options.body).first_name, 'Jane');

  assert.ok(seqCall, 'expected a sequence-subscribe call');
  assert.equal(seqCall.url, 'https://api.kit.com/v4/sequences/2723708/subscribers');
  assert.equal(seqCall.options.method, 'POST');
  assert.equal(seqCall.options.headers['X-Kit-Api-Key'], 'kit_test_123');
  assert.deepEqual(JSON.parse(seqCall.options.body), { email_address: 'jane@example.com' });

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('addSubscriberToSequence throws when the sequence id is missing', async () => {
  await assert.rejects(
    () => kit.addSubscriberToSequence({ sequenceId: '', email: 'jane@example.com' }),
    /Missing Kit sequence id/
  );
});
