'use strict';

const { validateApiKey } = require('../_lib/_meeting-auth.js');
const { listMeetingNotes } = require('../_lib/_meeting-store.js');

/**
 * GET /api/meetings
 *
 * Query params:
 *   q      - free-text search across title, summary, transcript
 *   type   - exact match on meeting_type
 *   tag    - exact match on a tag in the tags array
 *   person - partial text match on person name in title/summary
 *   limit  - max results (default 20, max 100)
 *
 * Returns the list without transcript or raw_payload to keep responses lean.
 * Requires x-api-key header.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const { q, type, tag, person, limit } = req.query || {};

  try {
    const meetings = await listMeetingNotes({ q, type, tag, person, limit });
    return res.status(200).json({ count: meetings.length, meetings });
  } catch (err) {
    console.error('[meetings/index] Error:', err.message);
    return res.status(500).json({ error: 'Failed to list meetings' });
  }
};
