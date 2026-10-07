'use strict';

const { getFreeResource } = require('./_free-resource.js');
const { upsertSubscriber, tagSubscriber } = require('./_kit.js');
const store = require('./_resource-sync-store.js');

const LAUNCHED_AT = Date.parse('2026-09-30T00:00:00Z');
const SUBJECT = 'Your March 2027 Game Plan';
const IGNORED_EVENTS = new Set(['bounced', 'complained', 'failed', 'canceled', 'cancelled']);
let fetchImpl = (...args) => fetch(...args);

async function jsonRequest(url, headers) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`Reconciliation source failed (${response.status})`);
  return response.json();
}

async function sentGamePlanEmails() {
  const key = String(process.env.RESEND_API_KEY || '').trim();
  if (!key) throw new Error('Missing RESEND_API_KEY');
  const emails = new Map();
  let after = '';
  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({ limit: '100' });
    if (after) query.set('after', after);
    const result = await jsonRequest(`https://api.resend.com/emails?${query}`, { Authorization: `Bearer ${key}` });
    const items = Array.isArray(result.data) ? result.data : [];
    let reachedLaunch = false;
    for (const item of items) {
      const createdAt = Date.parse(item.created_at || '');
      if (!Number.isFinite(createdAt)) throw new Error('Resend email missing created_at');
      if (createdAt < LAUNCHED_AT) { reachedLaunch = true; continue; }
      if (item.subject !== SUBJECT || IGNORED_EVENTS.has(item.last_event)) continue;
      for (const address of item.to || []) {
        const email = String(address || '').trim().toLowerCase();
        if (email) emails.set(email, { email, resendId: item.id, createdAt: item.created_at });
      }
    }
    if (reachedLaunch || !result.has_more || items.length === 0) return emails;
    after = items.at(-1).id;
    if (!after) throw new Error('Resend pagination cursor missing');
  }
  throw new Error('Resend reconciliation exceeded 50 pages; no completion marker saved');
}

async function taggedGamePlanEmails(tagId) {
  const key = String(process.env.KIT_API_KEY || '').trim();
  if (!key) throw new Error('Missing KIT_API_KEY');
  const emails = new Set();
  let after = '';
  for (let page = 0; page < 50; page += 1) {
    const query = new URLSearchParams({ status: 'all', slim: 'true', per_page: '1000' });
    if (after) query.set('after', after);
    const result = await jsonRequest(`https://api.kit.com/v4/tags/${encodeURIComponent(tagId)}/subscribers?${query}`, { 'X-Kit-Api-Key': key });
    for (const item of result.subscribers || []) {
      const email = String(item.email_address || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    if (!result.pagination?.has_next_page) return emails;
    after = result.pagination.end_cursor;
    if (!after) throw new Error('Kit pagination cursor missing');
  }
  throw new Error('Kit reconciliation exceeded 50 pages; no completion marker saved');
}

async function findExistingSubscriber(email) {
  const key = String(process.env.KIT_API_KEY || '').trim();
  const query = new URLSearchParams({ email_address: email, status: 'all', slim: 'true' });
  const result = await jsonRequest(`https://api.kit.com/v4/subscribers?${query}`, { 'X-Kit-Api-Key': key });
  return (result.subscribers || []).find((item) => String(item.email_address).toLowerCase() === email) || null;
}

async function reconcileGamePlan() {
  const resource = getFreeResource('game-plan');
  const [sent, tagged] = await Promise.all([
    sentGamePlanEmails(),
    taggedGamePlanEmails(resource.kitTagId),
  ]);
  const missing = [...sent.values()].filter(({ email }) => !tagged.has(email));
  let taggedCount = 0;
  let inactiveCount = 0;

  for (const item of missing) {
    const existing = await findExistingSubscriber(item.email);
    if (existing && existing.state !== 'active') {
      inactiveCount += 1;
      continue; // Never reactivate someone who has left the list.
    }
    const row = await store.createLead({
      resourceKey: 'game-plan', email: item.email, outcome: 'sync_pending',
      meta: { email_status: 'sent', resend_id: item.resendId, source: 'historical_reconciliation', sent_at: item.createdAt },
    });
    const subscriber = existing || await upsertSubscriber({ email: item.email });
    if (!subscriber?.id) throw new Error('Kit returned no subscriber id during reconciliation');
    await tagSubscriber({ subscriberId: subscriber.id, tagId: resource.kitTagId });
    await store.updateLead(row.id, {
      outcome: 'synced',
      meta: { email_status: 'sent', resend_id: item.resendId, source: 'historical_reconciliation', sent_at: item.createdAt },
    });
    taggedCount += 1;
  }
  return { sentCount: sent.size, missingCount: missing.length, taggedCount, inactiveCount };
}

reconcileGamePlan.__setFetch = (fn) => { fetchImpl = fn; };
reconcileGamePlan.__resetForTests = () => { fetchImpl = (...args) => fetch(...args); };

module.exports = reconcileGamePlan;
