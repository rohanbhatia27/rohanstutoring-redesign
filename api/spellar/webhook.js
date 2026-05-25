'use strict';

const { normaliseSpellarPayload } = require('../_lib/_meeting-normalise.js');
const { storeMeetingNote } = require('../_lib/_meeting-store.js');

function validateWebhookSecret(req) {
  const expected = String(process.env.SPELLAR_WEBHOOK_SECRET || '').trim();
  if (!expected) {
    return { error: 'SPELLAR_WEBHOOK_SECRET is not configured on this server', status: 500 };
  }
  const fromHeader = String(req.headers['x-spellar-secret'] || '').trim();
  const fromQuery = String((req.query && req.query.secret) || '').trim();
  const provided = fromHeader || fromQuery;

  if (!provided) {
    return { error: 'Missing webhook secret (x-spellar-secret header or ?secret= query param)', status: 401 };
  }
  if (provided !== expected) {
    return { error: 'Invalid webhook secret', status: 401 };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authError = validateWebhookSecret(req);
  if (authError) {
    return res.status(authError.status).json({ error: authError.error });
  }

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
};
