'use strict';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_DRAFT_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';

let fetchImpl = (...args) => fetch(...args);

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} environment variable`);
  return value;
}

function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '').trim();
}

function getGoogleClientSecret() {
  return String(process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '').trim();
}

function sanitiseHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function normaliseBody(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

async function fetchAccessToken() {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGoogleClientId() || requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: getGoogleClientSecret() || requireEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: requireEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }).toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Gmail OAuth token request failed (${response.status}): ${payload.error_description || payload.error || 'Unknown token error'}`
    );
  }

  return payload.access_token;
}

function buildMimeMessage({ to, subject, body }) {
  return [
    `To: ${sanitiseHeader(to)}`,
    `Subject: ${sanitiseHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    normaliseBody(body),
    '',
  ].join('\r\n');
}

async function createDraft({ to, subject, body, threadId = '' }) {
  const accessToken = await fetchAccessToken();
  const message = {
    raw: Buffer.from(buildMimeMessage({ to, subject, body }), 'utf8').toString('base64url'),
  };

  if (threadId) {
    message.threadId = String(threadId).trim();
  }

  const response = await fetchImpl(GMAIL_DRAFT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Gmail draft creation failed (${response.status}): ${payload.error?.message || payload.error_description || 'Unknown Gmail error'}`
    );
  }

  return payload;
}

module.exports = {
  GMAIL_DRAFT_URL,
  TOKEN_URL,
  buildMimeMessage,
  createDraft,
  fetchAccessToken,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
