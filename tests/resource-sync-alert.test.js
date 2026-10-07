const test = require('node:test');
const assert = require('node:assert/strict');
const alert = require('../api/_lib/_resource-sync-alert.js');

test('sends a failed Kit sync alert to the configured admin address', async () => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.ADMIN_ALERT_EMAIL = 'owner@example.com';
  let sent;
  alert.__setResendFactory(() => ({ emails: { send: async (payload) => { sent = payload; return { data: { id: 'alert-1' }, error: null }; } } }));
  assert.equal(await alert({ kind: 'Kit sync failed', resourceKey: 'game-plan', email: 'jane@example.com', detail: 'tag failed' }), true);
  assert.equal(sent.to, 'owner@example.com');
  assert.match(sent.text, /jane@example\.com/);
  assert.match(sent.subject, /Kit sync failed/);
  alert.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_ALERT_EMAIL;
});
