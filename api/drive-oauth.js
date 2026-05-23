'use strict';

const {
  buildAuthUrl,
  driveHealth,
  getRedirectUri,
  isAuthorized,
} = require('./_lib/_drive-oauth.js');

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = String(req.query?.action || 'health').trim();

  if (req.method === 'GET' && action === 'connect') {
    try {
      return res.status(200).json({
        authUrl: buildAuthUrl(req),
        redirectUri: getRedirectUri(req),
        instructions: [
          'Add redirectUri to the Google OAuth client if it is not already allowed.',
          'Open authUrl while signed into the Google account that owns or can share the Blueprint folder.',
          'After Google redirects back, copy the returned refresh token into GOOGLE_REFRESH_TOKEN in Vercel Production and Preview.',
        ],
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET' && action === 'health') {
    try {
      const result = await driveHealth();
      return res.status(result.ok ? 200 : 500).json(result);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err.message,
        expectedScope: 'https://www.googleapis.com/auth/drive',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = handler;
