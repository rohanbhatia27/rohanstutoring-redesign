'use strict';

// The existing service-role-only event table also serves as the durable queue
// for free-resource leads. Every accepted email has a row before Resend is called.
const LEAD_EVENT = 'free_resource.lead';
const RECONCILIATION_EVENT = 'free_resource.reconciliation';
let fetchImpl = (...args) => fetch(...args);

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return { url: url.replace(/\/$/, ''), key };
}

async function request(path, method = 'GET', body) {
  const { url, key } = config();
  const response = await fetchImpl(`${url}/rest/v1/purchase_events${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key,
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resource ledger request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  if (method === 'PATCH') return null;
  return response.json();
}

async function createLead({ resourceKey, email, firstName = '', outcome = 'pending', meta = {} }) {
  const rows = await request('', 'POST', {
    event_type: LEAD_EVENT,
    provider: 'resend',
    product_slug: String(resourceKey).slice(0, 100),
    customer_email: String(email).trim().toLowerCase().slice(0, 320),
    customer_name: String(firstName).trim().slice(0, 120) || null,
    outcome,
    meta,
  });
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error('Resource ledger did not return an id');
  return rows[0];
}

async function updateLead(id, { outcome, errorMessage = null, meta = {} }) {
  if (!id) throw new Error('Missing resource ledger id');
  await request(`?id=eq.${encodeURIComponent(id)}`, 'PATCH', {
    outcome,
    error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
    meta,
  });
}

async function listRetryable({ olderThan = new Date(Date.now() - 5 * 60 * 1000), limit = 50 } = {}) {
  const query = new URLSearchParams({
    select: 'id,created_at,product_slug,customer_email,customer_name,outcome,meta',
    event_type: `eq.${LEAD_EVENT}`,
    outcome: 'in.(pending,sync_pending,sync_failed)',
    created_at: `lt.${olderThan.toISOString()}`,
    order: 'created_at.asc',
    limit: String(Math.min(limit, 100)),
  });
  return request(`?${query}`);
}

async function hasCompletedReconciliation() {
  const query = new URLSearchParams({
    select: 'id', event_type: `eq.${RECONCILIATION_EVENT}`,
    product_slug: 'eq.game-plan', outcome: 'eq.completed', limit: '1',
  });
  const rows = await request(`?${query}`);
  return Array.isArray(rows) && rows.length > 0;
}

async function markReconciliationComplete(summary) {
  const rows = await request('', 'POST', {
    event_type: RECONCILIATION_EVENT,
    provider: 'resend',
    product_slug: 'game-plan',
    outcome: 'completed',
    meta: summary,
  });
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error('Reconciliation marker was not saved');
  return rows[0];
}

module.exports = {
  createLead, updateLead, listRetryable, hasCompletedReconciliation, markReconciliationComplete,
  __setFetch: (fn) => { fetchImpl = fn; },
  __resetForTests: () => { fetchImpl = (...args) => fetch(...args); },
};
