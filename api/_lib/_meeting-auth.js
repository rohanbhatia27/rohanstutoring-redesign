'use strict';

/**
 * Returns an error object { error, status } if the request's x-api-key header
 * does not match MEETING_NOTES_API_KEY, or null if auth passes.
 */
function validateApiKey(req) {
  const expected = String(process.env.MEETING_NOTES_API_KEY || '').trim();
  if (!expected) {
    return { error: 'MEETING_NOTES_API_KEY is not configured on this server', status: 500 };
  }
  const provided = String(req.headers['x-api-key'] || '').trim();
  if (!provided) {
    return { error: 'Missing x-api-key header', status: 401 };
  }
  if (provided !== expected) {
    return { error: 'Invalid API key', status: 401 };
  }
  return null;
}

module.exports = { validateApiKey };
