const test = require('node:test');
const assert = require('node:assert/strict');
const headers = require('../api/_lib/_supabase-headers.js');

test('Supabase secret keys use only the API key header', () => {
  assert.deepEqual(headers('sb_secret_test_key'), { apikey: 'sb_secret_test_key' });
});

test('legacy Supabase service role keys also use bearer authentication', () => {
  assert.deepEqual(headers('legacy.jwt.key'), { apikey: 'legacy.jwt.key', Authorization: 'Bearer legacy.jwt.key' });
});
