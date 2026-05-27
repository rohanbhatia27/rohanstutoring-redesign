'use strict';

const crypto = require('crypto');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const STATE_TTL_MS = 10 * 60 * 1000;

let fetchImpl = (...args) => fetch(...args);

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

function getOptionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function getGoogleClientId() {
  return getOptionalEnv('GOOGLE_CLIENT_ID') || getOptionalEnv('GMAIL_CLIENT_ID');
}

function getGoogleClientSecret() {
  return getOptionalEnv('GOOGLE_CLIENT_SECRET') || getOptionalEnv('GMAIL_CLIENT_SECRET');
}

function getBaseUrl(req) {
  const configured = getOptionalEnv('PUBLIC_SITE_URL');
  if (configured) return configured.replace(/\/+$/, '');

  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  if (!host) throw new Error('Missing request host for OAuth redirect URI.');
  return `${proto}://${host}`;
}

function getRedirectUri(req) {
  const configured = getOptionalEnv('GMAIL_REDIRECT_URI');
  if (configured) return configured;
  return `${getBaseUrl(req)}/api/gmail/oauth/callback`;
}

function getStateSecret() {
  return (
    getOptionalEnv('TOKEN_ENCRYPTION_KEY') ||
    getOptionalEnv('ENQUIRY_AUTOMATION_TOKEN') ||
    getOptionalEnv('FULFILLMENT_RETRY_TOKEN') ||
    getGoogleClientSecret() ||
    requireEnv('GOOGLE_CLIENT_SECRET')
  );
}

function signState(payload) {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(payload)
    .digest('base64url');
}

function buildState(now = Date.now()) {
  const payload = `${now}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${payload}.${signState(payload)}`;
}

function verifyState(state, now = Date.now()) {
  const parts = String(state || '').split('.');
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = signState(payload);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(parts[2]);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return false;
  }

  const createdAt = Number(parts[0]);
  return Number.isFinite(createdAt) && now - createdAt <= STATE_TTL_MS;
}

function buildAuthUrl(req) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId() || requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: buildState(),
  });

  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(req, code) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code || '').trim(),
      client_id: getGoogleClientId() || requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: getGoogleClientSecret() || requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getRedirectUri(req),
      grant_type: 'authorization_code',
    }).toString(),
  });

  const body = await response.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(
      `Token exchange failed (${response.status}): ${payload.error_description || payload.error || body || 'Unknown token error'}`
    );
  }

  return payload;
}

module.exports = {
  AUTH_URL,
  GMAIL_SCOPE,
  TOKEN_URL,
  buildAuthUrl,
  buildState,
  exchangeCodeForTokens,
  getRedirectUri,
  verifyState,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
