'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const Module = require('node:module');
const crypto = require('node:crypto');

const effects = { tokens: [], reports: 0, insights: 0, emails: [] };
const originalLoad = Module._load;
let handler;
try {
  Module._load = function (name, ...args) {
    if (name === 'resend') return { Resend: class {
      constructor() { this.emails = { send: async (email) => { effects.emails.push(email); return {}; } }; }
    } };
    if (name === './_lib/_insights.js') return {
      generateWeeklyInsights: async () => { effects.insights++; return { headline: 'Test', insights: [] }; },
      compactDashboard: (data) => data,
    };
    return originalLoad.call(this, name, ...args);
  };
  handler = require('../api/analytics.js');
} finally {
  Module._load = originalLoad;
}
const auth = require('../api/_lib/_ga4-auth.js');
const stateCookieName = '__Host-rg_ga4_state';
const envKeys = ['CRON_SECRET', 'GA4_REFRESH_TOKEN', 'GA4_PROPERTY_ID', 'RESEND_API_KEY',
  'DEEPSEEK_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'TOKEN_ENCRYPTION_KEY'];
let savedEnv;
let originalFetch;
let originalNow;
let tokenResponse;

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body = '') { this.body = body; },
  };
}
async function request(action, query = {}, headers = {}) {
  const res = response();
  await handler({ query: { action, ...query }, headers }, res);
  return res;
}
function cookies(res) {
  const value = res.getHeader('Set-Cookie');
  return value ? [].concat(value) : [];
}
function assertStateCleared(res) {
  assert.ok(cookies(res).some((cookie) => cookie.startsWith(`${stateCookieName}=;`) && cookie.includes('Max-Age=0')),
    'callback must consume the browser state cookie');
}
async function connect() {
  const res = await request('connect');
  assert.equal(res.statusCode, 302);
  const state = new URL(res.getHeader('Location')).searchParams.get('state');
  const cookie = cookies(res).find((value) => value.startsWith(`${stateCookieName}=`));
  assert.ok(cookie, 'connect must bind the OAuth state to the initiating browser');
  return { res, state, cookie, header: cookie.split(';')[0] };
}

beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) process.env[key] = `test-${key}`;
  process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
  effects.tokens = []; effects.reports = 0; effects.insights = 0; effects.emails = [];
  originalFetch = global.fetch;
  originalNow = Date.now;
  tokenResponse = { access_token: 'test-access', refresh_token: 'test-refresh' };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token', 'unexpected network effect');
    effects.tokens.push(new URLSearchParams(options.body));
    return { ok: true, json: async () => tokenResponse };
  };
  handler.__setRunBatchReports(async (_property, _token, requests) => {
    effects.reports++;
    return requests.map(() => ({}));
  });
});
afterEach(() => {
  global.fetch = originalFetch;
  Date.now = originalNow;
  handler.__resetForTests();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

for (const action of ['digest', 'weekly-insights']) {
  for (const [label, secret, authorization] of [
    ['missing configured secret', undefined, 'Bearer undefined'],
    ['empty configured secret', '', 'Bearer '],
    ['missing bearer', 'cron-secret', undefined],
    ['incorrect bearer', 'cron-secret', 'Bearer wrong'],
    ['non-exact bearer', 'cron-secret', 'Bearer cron-secret '],
  ]) {
    test(`${action} rejects forged cron header with ${label} before any effects`, async () => {
      if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
      const res = await request(action, {}, { 'x-vercel-cron': '1', authorization });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(JSON.parse(res.body), { error: 'unauthorized' });
      assert.deepEqual(effects, { tokens: [], reports: 0, insights: 0, emails: [] });
    });
  }
  for (const cronHeader of [undefined, 'forged']) {
    test(`${action} accepts exact configured bearer ${cronHeader ? 'with' : 'without'} cron header`, async () => {
      const res = await request(action, {}, {
        'x-vercel-cron': cronHeader,
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      });
      assert.equal(res.statusCode, 200);
      assert.equal(effects.tokens.length, 1);
      assert.equal(effects.tokens[0].get('grant_type'), 'refresh_token');
      assert.equal(effects.reports, 2);
      assert.equal(effects.insights, action === 'weekly-insights' ? 1 : 0);
      assert.equal(effects.emails.length, 1);
    });
  }
}

test('connect creates fresh cryptographic state in an encrypted, short-lived secure browser cookie', async () => {
  const first = await connect();
  const second = await connect();
  assert.match(first.state, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.state, second.state);
  assert.ok(!first.cookie.includes(first.state), 'state must be encrypted in the cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=600']) {
    assert.ok(first.cookie.split('; ').includes(attribute), attribute);
  }
  assert.equal(effects.tokens.length, 0);
});

for (const scenario of ['missing state', 'missing cookie', 'mismatch', 'other browser', 'tampered', 'extra payload segment', 'expired', 'malformed encoding', 'array state']) {
  test(`callback rejects ${scenario} before exchanging a code and clears state`, async () => {
    const initial = await connect();
    let state = initial.state;
    let cookie = initial.header;
    if (scenario === 'missing state') state = undefined;
    if (scenario === 'missing cookie') cookie = '';
    if (scenario === 'mismatch') state = 'different-state';
    if (scenario === 'other browser') cookie = (await connect()).header;
    if (scenario === 'tampered') {
      const [name, payload] = cookie.split('=');
      const [iv, encrypted, tag] = payload.split('.');
      const bytes = Buffer.from(encrypted, 'base64url');
      bytes[0] ^= 1;
      cookie = `${name}=${iv}.${bytes.toString('base64url')}.${tag}`;
    }
    if (scenario === 'extra payload segment') cookie += '.unexpected';
    if (scenario === 'expired') Date.now = () => originalNow() + 601000;
    if (scenario === 'malformed encoding') cookie = `${stateCookieName}=%E0%A4%A`;
    if (scenario === 'array state') state = [state, state];
    const res = await request('callback', { state, code: 'test-code' }, { cookie });
    assert.equal(res.statusCode, 400);
    assert.equal(effects.tokens.length, 0);
    assertStateCleared(res);
  });
}

test('callback with no state at all rejects an unsolicited code', async () => {
  const res = await request('callback', { code: 'unsolicited' });
  assert.equal(res.statusCode, 400);
  assert.equal(effects.tokens.length, 0);
  assertStateCleared(res);
});

test('valid callback exchanges code and preserves both state clearing and refresh-token cookies', async () => {
  const initial = await connect();
  const res = await request('callback', { state: initial.state, code: 'test-code' }, { cookie: initial.header });
  assert.equal(res.statusCode, 302);
  assert.equal(res.getHeader('Location'), '/analytics-dashboard.html?connected=1');
  assert.equal(effects.tokens.length, 1);
  assert.equal(effects.tokens[0].get('code'), 'test-code');
  assertStateCleared(res);
  const refresh = cookies(res).find((cookie) => cookie.startsWith('rg_ga4_rt='));
  assert.ok(refresh);
  assert.equal(auth.readRefreshToken({ headers: { cookie: refresh.split(';')[0] } }), 'test-refresh');
  // Once the browser applies the deletion, replaying the callback has no state cookie.
  const replay = await request('callback', { state: initial.state, code: 'test-code' }, { cookie: refresh.split(';')[0] });
  assert.equal(replay.statusCode, 400);
  assert.equal(effects.tokens.length, 1);
});

for (const scenario of ['provider error', 'missing code', 'missing refresh token', 'exchange failure']) {
  test(`callback clears state on ${scenario}`, async () => {
    const initial = await connect();
    const query = { state: initial.state, code: 'test-code' };
    if (scenario === 'provider error') query.error = 'access_denied';
    if (scenario === 'missing code') delete query.code;
    if (scenario === 'missing refresh token') tokenResponse = { access_token: 'test-access' };
    if (scenario === 'exchange failure') global.fetch = async () => { throw new Error('mock exchange failure'); };
    const res = await request('callback', query, { cookie: initial.header });
    assert.equal(res.statusCode, scenario === 'exchange failure' ? 500 : 400);
    assertStateCleared(res);
    assert.ok(!cookies(res).some((cookie) => cookie.startsWith('rg_ga4_rt=')));
  });
}

test('malformed refresh-token cookie encoding fails closed at the helper and handler boundaries', async () => {
  const headers = { cookie: 'rg_ga4_rt=%E0%A4%A' };
  assert.equal(auth.readRefreshToken({ headers }), null);
  const res = await request('reveal-token', {}, headers);
  assert.equal(res.statusCode, 401);
  assert.equal(effects.tokens.length, 0);
});

test('encrypted but invalid state payload fails closed', async () => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update('invalid-json'), cipher.final()]);
  const cookie = `${stateCookieName}=${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
  const res = await request('callback', { state: 'test', code: 'test-code' }, { cookie });
  assert.equal(res.statusCode, 400);
  assert.equal(effects.tokens.length, 0);
  assertStateCleared(res);
});
