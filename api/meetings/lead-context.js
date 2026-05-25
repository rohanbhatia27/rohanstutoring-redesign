'use strict';

const { validateApiKey } = require('../_lib/_meeting-auth.js');
const { getLeadContext } = require('../_lib/_meeting-store.js');

/**
 * GET /api/meetings/lead-context?name=<person-name>
 *
 * Returns enriched context about a lead or student:
 *   - All meetings involving this person (matched by name in title/summary)
 *   - Most recent call summary
 *   - Extracted pain points and objections from the most recent call
 *   - All open action items across recent calls
 *   - Suggested next step
 *
 * Extraction is deterministic (keyword-based sentences), not AI-generated.
 * Requires x-api-key header.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const name = String((req.query && req.query.name) || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Missing required query param: name' });
  }

  try {
    const context = await getLeadContext(name);
    if (!context) {
      return res.status(404).json({
        error: `No meetings found involving "${name}"`,
        hint: 'Try a partial first name or last name.',
      });
    }
    return res.status(200).json(context);
  } catch (err) {
    console.error('[meetings/lead-context] Error:', err.message);
    return res.status(500).json({ error: 'Failed to build lead context' });
  }
};
