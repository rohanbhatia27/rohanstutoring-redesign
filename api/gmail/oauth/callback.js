'use strict';

const { exchangeCodeForTokens, verifyState } = require('../../_lib/_gmail-oauth.js');

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

async function gmailOAuthCallbackHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const error = String(req.query?.error || '').trim();
  if (error) {
    return sendText(res, 400, `Google OAuth error: ${error}`);
  }

  const state = String(req.query?.state || '').trim();
  if (!verifyState(state)) {
    return sendText(res, 401, 'Invalid or expired OAuth state. Start the Gmail OAuth flow again.');
  }

  const code = String(req.query?.code || '').trim();
  if (!code) {
    return sendText(res, 400, 'Missing authorization code.');
  }

  try {
    const tokens = await exchangeCodeForTokens(req, code);
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

module.exports = gmailOAuthCallbackHandler;
