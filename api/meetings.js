'use strict';

/**
 * Unified meeting notes handler — all routes in one Serverless Function
 * to stay within Vercel Hobby plan's 12-function limit.
 *
 * POST /api/meetings          — Spellar webhook ingestion (requires SPELLAR_WEBHOOK_SECRET)
 * GET  /api/meetings          — list meetings (query: type, tag, person, limit)
 * GET  /api/meetings?id=      — full meeting record including transcript
 * GET  /api/meetings?q=       — text search across title/summary/transcript/tags
 * GET  /api/meetings?name=    — lead context profile for a named person
 * GET  /api/meetings?debug=env — safe storage/env diagnostics
 *
 * Read endpoints require x-api-key header (MEETING_NOTES_API_KEY).
 * Webhook requires x-spellar-secret header or ?secret= query param.
 */

const { normaliseSpellarPayload } = require('./_lib/_meeting-normalise.js');
const {
  storeMeetingNote,
  listMeetingNotes,
  getMeetingNoteById,
  searchMeetingNotes,
  getLeadContext,
  getMeetingStoreDebugInfo,
} = require('./_lib/_meeting-store.js');
const { validateApiKey } = require('./_lib/_meeting-auth.js');

// ---- Webhook auth ----

function validateWebhookSecret(req) {
  const expected = String(process.env.SPELLAR_WEBHOOK_SECRET || '').trim();
  if (!expected) {
    return { error: 'SPELLAR_WEBHOOK_SECRET is not configured on this server', status: 500 };
  }
  const fromHeader = String(req.headers['x-spellar-secret'] || '').trim();
  const fromQuery  = String((req.query && req.query.secret) || '').trim();
  const provided   = fromHeader || fromQuery;
  if (!provided) {
    return { error: 'Missing webhook secret (x-spellar-secret header or ?secret= query param)', status: 401 };
  }
  if (provided !== expected) {
    return { error: 'Invalid webhook secret', status: 401 };
  }
  return null;
}

// ---- Route handlers ----

async function handleWebhook(req, res) {
  const authError = validateWebhookSecret(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  let raw;
  try {
    raw = typeof req.body === 'object' && req.body !== null
      ? req.body
      : JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const note = normaliseSpellarPayload(raw);

  // Log metadata only — never log transcript content
  console.log(
    `[spellar-webhook] Received: "${note.title}" | ` +
    `started=${note.started_at || 'unknown'} | ` +
    `external_id=${note.external_id || 'none'} | ` +
    `source=${note.source}`
  );

  let stored;
  try {
    stored = await storeMeetingNote(note);
  } catch (err) {
    console.error('[spellar-webhook] Storage error:', err.message);
    return res.status(500).json({ error: 'Failed to store meeting note. Check server logs.' });
  }

  return res.status(200).json({
    received: true,
    id: stored.id,
    title: stored.title,
    source: stored.source,
    external_id: stored.external_id || null,
  });
}

async function handleList(req, res) {
  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const { type, tag, person, limit } = req.query || {};
  try {
    const meetings = await listMeetingNotes({ type, tag, person, limit });
    return res.status(200).json({ count: meetings.length, meetings });
  } catch (err) {
    console.error('[meetings] list error:', err.message);
    return res.status(500).json({ error: 'Failed to list meetings' });
  }
}

async function handleDebugEnv(req, res) {
  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  return res.status(200).json(getMeetingStoreDebugInfo());
}

async function handleById(req, res) {
  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const id = String((req.query && req.query.id) || '').trim();
  if (!id) return res.status(400).json({ error: 'Missing required param: id' });

  try {
    const meeting = await getMeetingNoteById(id);
    if (!meeting) return res.status(404).json({ error: `No meeting found with id: ${id}` });
    return res.status(200).json(meeting);
  } catch (err) {
    console.error('[meetings] by-id error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve meeting' });
  }
}

async function handleSearch(req, res) {
  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const q = String((req.query && req.query.q) || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing required param: q' });
  if (q.length < 2) return res.status(400).json({ error: 'Search query must be at least 2 characters' });

  try {
    const results = await searchMeetingNotes(q);
    return res.status(200).json({ query: q, count: results.length, results });
  } catch (err) {
    console.error('[meetings] search error:', err.message);
    return res.status(500).json({ error: 'Search failed' });
  }
}

async function handleLeadContext(req, res) {
  const authError = validateApiKey(req);
  if (authError) return res.status(authError.status).json({ error: authError.error });

  const name = String((req.query && req.query.name) || '').trim();
  if (!name) return res.status(400).json({ error: 'Missing required param: name' });

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
    console.error('[meetings] lead-context error:', err.message);
    return res.status(500).json({ error: 'Failed to build lead context' });
  }
}

// ---- Main dispatcher ----

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    return handleWebhook(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, q, name, debug } = req.query || {};

  if (debug === 'env') return handleDebugEnv(req, res);
  if (id)   return handleById(req, res);
  if (q)    return handleSearch(req, res);
  if (name) return handleLeadContext(req, res);
  return handleList(req, res);
};
