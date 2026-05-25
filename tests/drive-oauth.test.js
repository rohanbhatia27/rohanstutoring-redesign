const test = require('node:test');
const assert = require('node:assert/strict');

const driveOAuth = require('../api/_lib/_drive-oauth.js');
const adminHandler = require('../api/admin.js');

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.headers['Content-Type'] = this.headers['Content-Type'] || 'application/json';
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('Drive OAuth connect returns an admin-protected auth URL with Drive scope', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'retry_secret';
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_DRIVE_REDIRECT_URI = 'https://www.rohanstutoring.com/api/drive-oauth-callback';

  const req = {
    method: 'GET',
    headers: { host: 'www.rohanstutoring.com' },
    query: {
      action: 'driveOAuthStart',
      mode: 'connect',
      token: 'retry_secret',
    },
  };
  const res = createResponseRecorder();

  await adminHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.redirectUri, 'https://www.rohanstutoring.com/api/drive-oauth-callback');
  const url = new URL(res.body.authUrl);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/drive');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');

  driveOAuth.__resetForTests();
  delete process.env.FULFILLMENT_RETRY_TOKEN;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
});

test('Drive OAuth connect rejects missing admin token', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'retry_secret';

  const req = {
    method: 'GET',
    headers: { host: 'www.rohanstutoring.com' },
    query: { action: 'driveOAuthStart', mode: 'connect' },
  };
  const res = createResponseRecorder();

  await adminHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Unauthorized' });

  delete process.env.FULFILLMENT_RETRY_TOKEN;
});

test('Drive OAuth callback exchanges code and displays a new refresh token', async () => {
  process.env.FULFILLMENT_RETRY_TOKEN = 'retry_secret';
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_DRIVE_REDIRECT_URI = 'https://www.rohanstutoring.com/api/drive-oauth-callback';

  driveOAuth.__setFetch(async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('code'), 'auth_code_123');
    assert.equal(body.get('redirect_uri'), 'https://www.rohanstutoring.com/api/drive-oauth-callback');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ refresh_token: 'new_refresh_token_123' }),
    };
  });

  const req = {
    method: 'GET',
    headers: { host: 'www.rohanstutoring.com' },
    query: {
      action: 'driveOAuthCallback',
      code: 'auth_code_123',
      state: driveOAuth.buildState(),
    },
  };
  const res = createResponseRecorder();

  await adminHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /new_refresh_token_123/);
  assert.match(res.body, /GOOGLE_REFRESH_TOKEN/);

  driveOAuth.__resetForTests();
  delete process.env.FULFILLMENT_RETRY_TOKEN;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_DRIVE_REDIRECT_URI;
});
