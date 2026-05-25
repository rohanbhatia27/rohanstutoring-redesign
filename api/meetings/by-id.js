'use strict';

const { validateApiKey } = require('../_lib/_meeting-auth.js');
const { getMeetingNoteById } = require('../_lib/_meeting-store.js');

/**
 * GET /api/meetings/by-id?id=<uuid-or-external-id>
 *
 * Returns the full meeting note including transcript and raw_payload.
 * Requires x-api-key header.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const id = String((req.query && req.query.id) || '').trim();
  if (!id) {
    return res.status(400).json({ error: 'Missing required query param: id' });
  }

  try {
    const meeting = await getMeetingNoteById(id);
    if (!meeting) {
      return res.status(404).json({ error: `No meeting found with id: ${id}` });
    }
    return res.status(200).json(meeting);
  } catch (err) {
    console.error('[meetings/by-id] Error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve meeting' });
  }
};
