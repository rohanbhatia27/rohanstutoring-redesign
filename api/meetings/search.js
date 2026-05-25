'use strict';

const { validateApiKey } = require('../_lib/_meeting-auth.js');
const { searchMeetingNotes } = require('../_lib/_meeting-store.js');

/**
 * GET /api/meetings/search?q=<query>
 *
 * Text search across title, summary, transcript, and tags.
 * Returns up to 50 results without transcript or raw_payload.
 * Requires x-api-key header.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const q = String((req.query && req.query.q) || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing required query param: q' });
  }
  if (q.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const results = await searchMeetingNotes(q);
    return res.status(200).json({ query: q, count: results.length, results });
  } catch (err) {
    console.error('[meetings/search] Error:', err.message);
    return res.status(500).json({ error: 'Search failed' });
  }
};
