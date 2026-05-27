'use strict';

const { buildAuthUrl, getRedirectUri } = require('../../_lib/_gmail-oauth.js');

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

async function gmailOAuthStartHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = getExpectedToken();
  if (!expectedToken || getRequestToken(req) !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    return res.status(200).json({
      authUrl: buildAuthUrl(req),
      redirectUri: getRedirectUri(req),
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

module.exports = gmailOAuthStartHandler;
