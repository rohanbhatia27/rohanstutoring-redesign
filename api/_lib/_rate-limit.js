'use strict';

// Per-bucket limits: max requests per IP (and optionally per email) within the window.
const LIMITS = {
  payment: { requests: 10, windowSeconds: 60 },
  coupon:  { requests: 20, windowSeconds: 60 },
  leads:   { requests: 15, windowSeconds: 60 },
};

const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';

// Overridable for tests — never logs the real token value.
let _fetch = (...args) => fetch(...args);

function isRedisConfigured() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sanitizeKey(value) {
  return String(value || '').replace(/[^a-zA-Z0-9@._-]/g, '_').slice(0, 128);
}

async function redisIncr(key, windowSeconds) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/pipeline`;
  const response = await _fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    // INCR then EXPIRE NX so we set TTL only on the first write.
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, windowSeconds, 'NX'],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Redis pipeline HTTP ${response.status}`);
  }

  const data = await response.json();
  return Number(data[0].result);
}

/**
 * Check whether the caller has exceeded the rate limit for `bucket`.
 *
 * Returns { limited: false } when Redis is not configured (local/test mode).
 * Fails open on Redis errors so legitimate traffic is never blocked by
 * infrastructure issues.
 *
 * @param {object} req  - Incoming request object (headers, socket).
 * @param {object} opts
 * @param {string} opts.bucket - One of 'payment' | 'coupon' | 'leads'.
 * @param {string} [opts.email] - Customer email for per-identity limiting.
 * @returns {Promise<{ limited: boolean, message?: string }>}
 */
async function checkRateLimit(req, { bucket = 'payment', email = '' } = {}) {
  if (!isRedisConfigured()) {
    return { limited: false };
  }

  const { requests, windowSeconds } = LIMITS[bucket] || LIMITS.payment;
  const ip = getClientIp(req);

  try {
    const ipKey = `rl:${bucket}:ip:${sanitizeKey(ip)}`;
    const ipCount = await redisIncr(ipKey, windowSeconds);
    if (ipCount > requests) {
      return { limited: true, message: RATE_LIMIT_MESSAGE };
    }

    if (email) {
      const emailKey = `rl:${bucket}:em:${sanitizeKey(email.toLowerCase())}`;
      const emailCount = await redisIncr(emailKey, windowSeconds);
      if (emailCount > requests) {
        return { limited: true, message: RATE_LIMIT_MESSAGE };
      }
    }

    return { limited: false };
  } catch (err) {
    // Fail open — a Redis outage should not block checkout.
    console.error('[rate-limit] Redis check failed:', err.message);
    return { limited: false };
  }
}

function __setFetch(fn) {
  _fetch = fn;
}

function __resetForTests() {
  _fetch = (...args) => fetch(...args);
}

module.exports = {
  checkRateLimit,
  RATE_LIMIT_MESSAGE,
  LIMITS,
  getClientIp,
  sanitizeKey,
  __setFetch,
  __resetForTests,
};
