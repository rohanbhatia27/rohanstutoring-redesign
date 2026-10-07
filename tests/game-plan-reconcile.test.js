const test = require('node:test');
const assert = require('node:assert/strict');
const reconcile = require('../api/_lib/_game-plan-reconcile.js');
const kit = require('../api/_lib/_kit.js');
const store = require('../api/_lib/_resource-sync-store.js');

test('reconciles paged Resend sends against the Kit tag and only tags missing leads', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.KIT_API_KEY = 'kit_test';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_test';
  const kitWrites = [];
  const ledgerWrites = [];
  reconcile.__setFetch(async (url) => {
    if (url.includes('api.resend.com')) {
      const after = new URL(url).searchParams.get('after');
      return { ok: true, json: async () => ({ data: after ? [
        { id: 'old', subject: 'Your March 2027 Game Plan', to: ['old@example.com'], created_at: '2026-09-29T00:00:00Z', last_event: 'delivered' },
      ] : [
        { id: 'a', subject: 'Your March 2027 Game Plan', to: ['already@example.com'], created_at: '2026-10-01T00:00:00Z', last_event: 'delivered' },
        { id: 'b', subject: 'Your March 2027 Game Plan', to: ['missing@example.com'], created_at: '2026-10-01T01:00:00Z', last_event: 'delivered' },
        { id: 'c', subject: 'Other email', to: ['other@example.com'], created_at: '2026-10-01T01:00:00Z', last_event: 'delivered' },
      ], has_more: !after }) };
    }
    if (url.includes('/v4/subscribers?')) return { ok: true, json: async () => ({ subscribers: [] }) };
    return { ok: true, json: async () => ({ subscribers: [{ email_address: 'already@example.com' }], pagination: { has_next_page: false } }) };
  });
  kit.__setFetch(async (url, options) => {
    kitWrites.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ subscriber: { id: 123 } }) };
  });
  store.__setFetch(async (url, options) => {
    ledgerWrites.push({ url, options });
    return { ok: true, json: async () => [{ id: 'row-1' }] };
  });

  const result = await reconcile();
  assert.equal(result.sentCount, 2);
  assert.equal(result.taggedCount, 1);
  assert.equal(result.missingCount, 1);
  assert.equal(kitWrites.length, 2);
  assert.match(kitWrites[1].url, /\/tags\/24104655\/subscribers\/123/);
  assert.equal(JSON.parse(ledgerWrites[0].options.body).customer_email, 'missing@example.com');

  reconcile.__resetForTests();
  kit.__resetForTests();
  store.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});
