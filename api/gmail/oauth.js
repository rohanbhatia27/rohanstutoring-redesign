'use strict';

const gmailOAuth = require('../_lib/_gmail-oauth.js');

function getExpectedToken() {
  return String(
    process.env.ENQUIRY_AUTOMATION_TOKEN ||
    process.env.FULFILLMENT_RETRY_TOKEN ||
    ''
  ).trim();
}

function getRequestToken(req) {
  return String(
    req.headers['x-enquiry-automation-token'] ||
    req.query?.token ||
    req.body?.token ||
    ''
  ).trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

function sendHtml(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

async function handleStart(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = getExpectedToken();
  if (!expectedToken || getRequestToken(req) !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    return res.status(200).json({
      authUrl: gmailOAuth.buildAuthUrl(req),
      redirectUri: gmailOAuth.getRedirectUri(req),
      instructions: [
        'Add the redirectUri to your Google OAuth client if needed.',
        'Open authUrl while signed into the Gmail account where drafts should be created.',
        'After the callback, copy the refresh token into GMAIL_REFRESH_TOKEN in Vercel.',
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleCallback(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const error = String(req.query?.error || '').trim();
  if (error) {
    return sendText(res, 400, `Google OAuth error: ${error}`);
  }

  const state = String(req.query?.state || '').trim();
  if (!gmailOAuth.verifyState(state)) {
    return sendText(res, 401, 'Invalid or expired OAuth state. Start the Gmail OAuth flow again.');
  }

  const code = String(req.query?.code || '').trim();
  if (!code) {
    return sendText(res, 400, 'Missing authorization code.');
  }

  try {
    const tokens = await gmailOAuth.exchangeCodeForTokens(req, code);
    if (!tokens.refresh_token) {
      return sendHtml(
        res,
        400,
        '<pre>Google did not return a refresh_token.\n\nRevoke the app at https://myaccount.google.com/permissions, then start again.</pre>'
      );
    }

    return sendHtml(
      res,
      200,
      '<!doctype html><meta charset="utf-8">' +
      '<title>Gmail token generated</title>' +
      '<body style="font-family:ui-sans-serif,system-ui;padding:32px;line-height:1.5;max-width:900px">' +
      '<h1>Gmail token generated</h1>' +
      '<p>Update <code>GMAIL_REFRESH_TOKEN</code> in Vercel Production and Preview with this value, then redeploy.</p>' +
      `<textarea readonly style="width:100%;min-height:140px;font-family:ui-monospace,monospace">${escapeHtml(tokens.refresh_token)}</textarea>` +
      '</body>'
    );
  } catch (err) {
    return sendText(res, 500, `Token exchange failed: ${err.message}`);
  }
}

async function gmailOAuthHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = String(req.query?.action || '').trim().toLowerCase();
  if (action === 'start') {
    return handleStart(req, res);
  }
  if (action === 'callback') {
    return handleCallback(req, res);
  }

  if (req.query?.code || req.query?.state) {
    return handleCallback(req, res);
  }

  return handleStart(req, res);
}

module.exports = Object.assign(gmailOAuthHandler, {
  ...gmailOAuth,
});
