'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'rg_ga4_rt';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days
const STATE_COOKIE_NAME = '__Host-rg_ga4_state';
const STATE_MAX_AGE = 10 * 60; // 10 minutes

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getEncryptionKey() {
  const raw = requireEnv('TOKEN_ENCRYPTION_KEY');
  // Accept either 64-char hex (32 bytes) or any string >= 32 chars (we'll hash it).
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}

function decrypt(payload) {
  const parts = String(payload).split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error('Bad cookie payload');
  }
  const [ivB, encB, tagB] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivB, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = Object.create(null);
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch (err) {
        out[k] = null;
      }
    }
  });
  return out;
}

function appendCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [].concat(existing, cookie) : cookie);
}

function createOAuthState(res) {
  const state = crypto.randomBytes(32).toString('base64url');
  const payload = encrypt(JSON.stringify({ state, expiresAt: Date.now() + STATE_MAX_AGE * 1000 }));
  appendCookie(res, `${STATE_COOKIE_NAME}=${payload}; Max-Age=${STATE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return state;
}

function clearOAuthStateCookie(res) {
  appendCookie(res, `${STATE_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
}

function validateOAuthState(req, state) {
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) return false;
  try {
    const raw = parseCookies(req)[STATE_COOKIE_NAME];
    if (!raw) return false;
    const saved = JSON.parse(decrypt(raw));
    if (!saved || typeof saved.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(saved.state) ||
        !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) return false;
    return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(saved.state));
  } catch (err) {
    return false;
  }
}

function setRefreshTokenCookie(res, refreshToken) {
  const enc = encrypt(refreshToken);
  const cookie = [
    `${COOKIE_NAME}=${enc}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
  appendCookie(res, cookie);
}

function clearRefreshTokenCookie(res) {
  appendCookie(
    res,
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

function readRefreshToken(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch (err) {
    return null;
  }
}

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: requireEnv('GOOGLE_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  if (state) params.set('state', state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: requireEnv('GOOGLE_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Token refresh failed (${res.status}): ${body}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

module.exports = {
  SCOPE,
  createOAuthState,
  clearOAuthStateCookie,
  validateOAuthState,
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  readRefreshToken,
};
