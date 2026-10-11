const test = require('node:test');
const assert = require('node:assert/strict');

const kit = require('../api/_lib/_kit.js');
const adminHandler = require('../api/admin.js');

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function mockKit(tagMembers) {
  const calls = [];
  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    const listMatch = url.match(/\/v4\/tags\/(\d+)\/subscribers\?/);
    if (listMatch && options.method === 'GET') {
      const ids = tagMembers[listMatch[1]] || [];
      return jsonResponse({
        subscribers: ids.map((id) => ({ id })),
        pagination: { has_next_page: false, end_cursor: null },
      });
    }
    return jsonResponse({ subscriber: { id: 1 } });
  });
  return calls;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('syncCohortTag tags only recent purchasers missing the cohort tag', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = mockKit({ 900: [1, 2], 100: [2, 3], 200: [4] });

  const result = await kit.syncCohortTag({
    cohortTagId: '900',
    sourceTagIds: ['100', '200'],
    taggedAfter: '2026-09-01T00:00:00Z',
  });

  assert.deepEqual(result.tagged.sort(), [3, 4]);
  assert.equal(result.alreadyTagged, 2);

  const sourceList = calls.find((c) => c.url.includes('/tags/100/subscribers?'));
  assert.match(sourceList.url, /tagged_after=2026-09-01T00%3A00%3A00Z/);

  const tagWrites = calls.filter((c) => c.options.method === 'POST').map((c) => c.url);
  assert.deepEqual(tagWrites.sort(), [
    'https://api.kit.com/v4/tags/900/subscribers/3',
    'https://api.kit.com/v4/tags/900/subscribers/4',
  ]);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('syncCohortTag follows pagination cursors', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];
  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/tags/100/subscribers?') && !url.includes('after=abc')) {
      return jsonResponse({ subscribers: [{ id: 5 }], pagination: { has_next_page: true, end_cursor: 'abc' } });
    }
    if (url.includes('/tags/100/subscribers?')) {
      return jsonResponse({ subscribers: [{ id: 6 }], pagination: { has_next_page: false } });
    }
    if (options.method === 'GET') {
      return jsonResponse({ subscribers: [], pagination: { has_next_page: false } });
    }
    return jsonResponse({ subscriber: { id: 1 } });
  });

  const result = await kit.syncCohortTag({ cohortTagId: '900', sourceTagIds: ['100'] });
  assert.deepEqual(result.tagged.sort(), [5, 6]);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('cohortTagSync admin action rejects requests without the cron secret', async () => {
  process.env.CRON_SECRET = 'cron_secret';
  process.env.FULFILLMENT_RETRY_TOKEN = 'retry_token';
  const res = mockRes();

  await adminHandler({ method: 'GET', query: { action: 'cohortTagSync' }, headers: {} }, res);
  assert.equal(res.statusCode, 401);

  delete process.env.CRON_SECRET;
  delete process.env.FULFILLMENT_RETRY_TOKEN;
});

test('cohortTagSync admin action runs the sync for Vercel cron', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  process.env.CRON_SECRET = 'cron_secret';
  process.env.KIT_TAG_ID_COHORT_CURRENT = '900';
  process.env.KIT_TAG_ID_PURCHASED_COMPREHENSIVE = '100';
  process.env.KIT_TAG_ID_PURCHASED_MASTERY = '200';
  process.env.KIT_COHORT_TAGGED_AFTER = '2026-09-01T00:00:00Z';
  mockKit({ 900: [1], 100: [1, 2], 200: [] });
  const res = mockRes();

  await adminHandler({
    method: 'GET',
    query: { action: 'cohortTagSync' },
    headers: { authorization: 'Bearer cron_secret' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.tagged, [2]);

  kit.__resetForTests();
  for (const key of ['KIT_API_KEY', 'CRON_SECRET', 'KIT_TAG_ID_COHORT_CURRENT', 'KIT_TAG_ID_PURCHASED_COMPREHENSIVE', 'KIT_TAG_ID_PURCHASED_MASTERY', 'KIT_COHORT_TAGGED_AFTER']) {
    delete process.env[key];
  }
});

test('cohortTagSync skips cleanly when no cohort tag is configured', async () => {
  process.env.CRON_SECRET = 'cron_secret';
  const res = mockRes();

  await adminHandler({
    method: 'GET',
    query: { action: 'cohortTagSync' },
    headers: { authorization: 'Bearer cron_secret' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.skipped, true);

  delete process.env.CRON_SECRET;
});
