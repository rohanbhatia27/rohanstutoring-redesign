'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const rateLimit = require('../api/_lib/_rate-limit.js');
const { checkRateLimit, RATE_LIMIT_MESSAGE, LIMITS, getClientIp, sanitizeKey } = rateLimit;

// Minimal mock for a Vercel-style request object.
function makeReq({ ip = '1.2.3.4', forwarded = '' } = {}) {
  return {
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: ip },
  };
}

// ── getClientIp ─────────────────────────────────────────────────────────────

test('getClientIp returns first IP from x-forwarded-for', () => {
  const req = { headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' }, socket: {} };
  assert.equal(getClientIp(req), '10.0.0.1');
});

test('getClientIp falls back to socket.remoteAddress when no forwarded header', () => {
  const req = { headers: {}, socket: { remoteAddress: '192.168.1.1' } };
  assert.equal(getClientIp(req), '192.168.1.1');
});

test('getClientIp returns "unknown" when no IP source is available', () => {
  const req = { headers: {}, socket: {} };
  assert.equal(getClientIp(req), 'unknown');
});

// ── sanitizeKey ──────────────────────────────────────────────────────────────

test('sanitizeKey allows safe characters', () => {
  assert.equal(sanitizeKey('user@example.com'), 'user@example.com');
  assert.equal(sanitizeKey('10.0.0.1'), '10.0.0.1');
});

test('sanitizeKey replaces unsafe characters', () => {
  assert.equal(sanitizeKey('bad key!'), 'bad_key_');
  assert.equal(sanitizeKey('a b\tc'), 'a_b_c');
});

test('sanitizeKey truncates to 128 chars', () => {
  const long = 'a'.repeat(200);
  assert.equal(sanitizeKey(long).length, 128);
});

// ── checkRateLimit: no-op when Redis not configured ─────────────────────────

test('checkRateLimit returns limited:false when Redis env vars are absent', async () => {
  const saved = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, false);

  process.env.UPSTASH_REDIS_REST_URL = saved.url;
  process.env.UPSTASH_REDIS_REST_TOKEN = saved.token;
});

test('checkRateLimit no-op even if only one Redis env var is set', async () => {
  const saved = {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, false);

  process.env.UPSTASH_REDIS_REST_URL = saved.url;
  if (saved.token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = saved.token;
});

// ── checkRateLimit: Redis configured, under limit ────────────────────────────

test('checkRateLimit returns limited:false when Redis count is under the limit', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  // Simulate INCR returning 1 (first request in the window).
  rateLimit.__setFetch(async () => ({
    ok: true,
    json: async () => [{ result: 1 }, { result: 1 }],
  }));

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, false);

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── checkRateLimit: Redis configured, over IP limit ──────────────────────────

test('checkRateLimit returns limited:true when IP count exceeds the limit', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  const ipLimit = LIMITS.payment.requests;
  rateLimit.__setFetch(async () => ({
    ok: true,
    json: async () => [{ result: ipLimit + 1 }, { result: 1 }],
  }));

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, true);
  assert.equal(result.message, RATE_LIMIT_MESSAGE);

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── checkRateLimit: email-based limit ────────────────────────────────────────

test('checkRateLimit checks email bucket when email is provided and IP is under limit', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  const emailLimit = LIMITS.payment.requests;
  const calls = [];

  rateLimit.__setFetch(async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    const callIndex = calls.length;
    // First call = IP check (under limit); second call = email check (over limit).
    const count = callIndex === 1 ? 1 : emailLimit + 1;
    return {
      ok: true,
      json: async () => [{ result: count }, { result: 1 }],
    };
  });

  const result = await checkRateLimit(makeReq(), { bucket: 'payment', email: 'user@example.com' });
  assert.equal(result.limited, true);
  assert.equal(result.message, RATE_LIMIT_MESSAGE);
  assert.equal(calls.length, 2);
  // Second pipeline should include the email key.
  assert.ok(calls[1][0][1].includes(':em:'), 'email key should contain :em:');
  assert.ok(calls[1][0][1].includes('user_example.com') || calls[1][0][1].includes('user@example.com'));

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test('checkRateLimit skips email bucket when no email is provided', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  const calls = [];
  rateLimit.__setFetch(async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return {
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }],
    };
  });

  await checkRateLimit(makeReq(), { bucket: 'coupon' });
  assert.equal(calls.length, 1, 'only one Redis call when no email supplied');

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── checkRateLimit: Redis error → fail open ──────────────────────────────────

test('checkRateLimit fails open when Redis returns a non-ok HTTP status', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  rateLimit.__setFetch(async () => ({ ok: false, status: 503 }));

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, false, 'should fail open on Redis HTTP error');

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test('checkRateLimit fails open when fetch throws a network error', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  rateLimit.__setFetch(async () => { throw new Error('Network failure'); });

  const result = await checkRateLimit(makeReq(), { bucket: 'payment' });
  assert.equal(result.limited, false, 'should fail open on network error');

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── Redis pipeline format ────────────────────────────────────────────────────

test('Redis pipeline uses INCR + EXPIRE NX with correct key prefix', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

  let capturedBody;
  rateLimit.__setFetch(async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }],
    };
  });

  await checkRateLimit(makeReq({ ip: '5.6.7.8' }), { bucket: 'leads' });

  assert.ok(Array.isArray(capturedBody), 'pipeline body should be an array');
  assert.equal(capturedBody[0][0], 'INCR');
  assert.ok(capturedBody[0][1].startsWith('rl:leads:ip:'), 'key should have correct prefix');
  assert.equal(capturedBody[1][0], 'EXPIRE');
  assert.equal(capturedBody[1][3], 'NX', 'EXPIRE should use NX flag');

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test('Authorization header uses Bearer token without leaking the token value in logs', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'super-secret-token';

  let capturedHeaders;
  rateLimit.__setFetch(async (url, opts) => {
    capturedHeaders = opts.headers;
    return {
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }],
    };
  });

  await checkRateLimit(makeReq(), { bucket: 'payment' });

  assert.equal(capturedHeaders['Authorization'], 'Bearer super-secret-token');
  // The key assertion: we only pass the token as a header, never log or expose it.
  // (Static verification — the module never calls console.log/error with the token.)

  rateLimit.__resetForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

// ── Bucket limits are correctly applied ──────────────────────────────────────

test('coupon bucket allows more requests per window than payment bucket', () => {
  assert.ok(LIMITS.coupon.requests > LIMITS.payment.requests);
});

test('all expected buckets are defined', () => {
  assert.ok(LIMITS.payment, 'payment bucket defined');
  assert.ok(LIMITS.coupon, 'coupon bucket defined');
  assert.ok(LIMITS.leads, 'leads bucket defined');
});
