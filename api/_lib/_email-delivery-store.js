const crypto = require('crypto');
const supabaseHeaders = require('./_supabase-headers.js');
async function dbRequest(method, data) {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Email delivery storage is not configured');
  const headers = { ...supabaseHeaders(key), 'Content-Type': 'application/json' };
  const filter = `?delivery_key=eq.${encodeURIComponent(data.delivery_key)}`;
  let path = filter, options = { method: 'GET', headers };
  if (method === 'reserve') { path = '?on_conflict=delivery_key'; options = { method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(data) }; }
  if (method === 'complete') options = { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'sent', message_id: data.messageId, sent_at: new Date().toISOString() }) };
  if (method === 'fail') { path += '&status=eq.pending'; options = { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed' }) }; }
  if (method === 'restart') { path += '&status=eq.failed'; options = { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'pending', created_at: new Date().toISOString() }) }; }
  const response = await fetch(`${url}/rest/v1/email_deliveries${path}`, options);
  if (!response.ok) throw new Error(`Email delivery storage failed (${response.status})`);
  if (method === 'get') { const rows = await response.json(); return rows[0]; }
}
let request = dbRequest;
async function run({ provider, paymentId, purpose, send }) {
  if (!provider || !paymentId || !purpose) throw new Error('Missing email delivery identity');
  const delivery_key = crypto.createHash('sha256').update(JSON.stringify([provider, paymentId, purpose])).digest('hex');
  const identity = { delivery_key, provider, payment_id: paymentId, purpose };
  await request('reserve', identity);
  let row = await request('get', identity);
  if (!row) throw new Error('Email delivery record missing');
  if (row.status === 'sent' && row.message_id) return { messageId: row.message_id, alreadySent: true };
  if (row.status === 'failed') {
    await request('restart', identity);
    row = await request('get', identity);
    if (row?.status === 'sent' && row.message_id) return { messageId: row.message_id, alreadySent: true };
  }
  const started = Date.parse(row.created_at);
  if (!Number.isFinite(started) || Date.now() - started >= 23 * 60 * 60 * 1000) throw new Error('Email delivery requires manual review after idempotency window');
  let result;
  try { result = await send(`delivery/${delivery_key}`); }
  catch (error) { if (error.notAccepted) await request('fail', identity); throw error; }
  if (!result?.messageId) throw new Error('Missing accepted email message ID');
  await request('complete', { ...identity, messageId: result.messageId });
  return result;
}
module.exports = { run, __setRequest: fn => { request = fn; }, __resetForTests: () => { request = dbRequest; } };
