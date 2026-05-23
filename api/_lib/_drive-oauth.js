'use strict';

const crypto = require('crypto');
const { DRIVE_SCOPE, verifyProductDriveAccess } = require('./_google-drive.js');

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

function getAdminToken() {
  return getOptionalEnv('FULFILLMENT_RETRY_TOKEN');
}

function getRequestToken(req) {
  return String(
    req.headers['x-fulfillment-retry-token'] ||
    req.query?.token ||
    req.body?.token ||
    ''
  ).trim();
}

function isAuthorized(req) {
  const expected = getAdminToken();
  return Boolean(expected && getRequestToken(req) === expected);
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
  const configured = getOptionalEnv('GOOGLE_DRIVE_REDIRECT_URI');
  if (configured) return configured;
  return `${getBaseUrl(req)}/api/drive-oauth-callback`;
}

function getStateSecret() {
  return getOptionalEnv('TOKEN_ENCRYPTION_KEY') || requireEnv('FULFILLMENT_RETRY_TOKEN');
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
  const provided = parts[2];
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

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
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: DRIVE_SCOPE,
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
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getRedirectUri(req),
      grant_type: 'authorization_code',
    }).toString(),
  });

  const body = await response.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (err) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${payload.error_description || payload.error || body || 'Unknown token error'}`);
  }

  return payload;
}

async function driveHealth() {
  return verifyProductDriveAccess({ baseSlug: 'blueprint' });
}

module.exports = {
  DRIVE_SCOPE,
  buildAuthUrl,
  buildState,
  driveHealth,
  exchangeCodeForTokens,
  getRedirectUri,
  isAuthorized,
  verifyState,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
