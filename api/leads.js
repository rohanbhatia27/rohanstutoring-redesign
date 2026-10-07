'use strict';

const createPaymentIntentHandler = require('./create-checkout.js');
const { syncQuizLead } = require('./_lib/_kit.js');
const { checkRateLimit } = require('./_lib/_rate-limit.js');
const resourceSyncStore = require('./_lib/_resource-sync-store.js');
const sendResourceSyncAlert = require('./_lib/_resource-sync-alert.js');
const {
  getFreeResource,
  sendDeliveryEmail,
  syncKitForResource,
  buildFallbackPayload,
} = require('./_lib/_free-resource.js');

// ---- Quiz lead ----

function normaliseQuizLead(body) {
  const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim();
  const outcome = String(body.outcome || '').trim();
  const sitting = String(body.sitting || '').trim().slice(0, 20);

  if (!firstName) return { error: 'Missing first name.' };
  if (!createPaymentIntentHandler.isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (!outcome) return { error: 'Missing quiz outcome.' };

  return { firstName: firstName.slice(0, 120), email, outcome, sitting };
}

async function handleQuizLead(body, res, req) {
  const lead = normaliseQuizLead(body);
  if (lead.error) return res.status(400).json({ error: lead.error });

  const rl = await checkRateLimit(req, { bucket: 'leads', email: lead.email });
  if (rl.limited) return res.status(429).json({ error: rl.message });

  try {
    await syncQuizLead(lead);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[leads/quiz] Kit sync failed:', error.message);
    return res.status(500).json({ error: 'Unable to save your study plan right now. Please try again.' });
  }
}

// ---- Free resource lead ----

function normaliseResourceLead(body) {
  const resourceKey = String(body.resourceKey || '').trim();
  const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const email = String(body.email || '').trim();

  if (!getFreeResource(resourceKey)) return { error: 'Missing or invalid resource.' };
  if (!createPaymentIntentHandler.isValidEmail(email)) return { error: 'Please enter a valid email address.' };

  return { resourceKey, firstName, email };
}

async function handleResourceLead(body, res, req) {
  const lead = normaliseResourceLead(body);
  if (lead.error) return res.status(400).json({ error: lead.error });

  const rl = await checkRateLimit(req, { bucket: 'leads', email: lead.email });
  if (rl.limited) return res.status(429).json({ error: rl.message });

  const resource = getFreeResource(lead.resourceKey);
  let ledgerRow;
  try {
    ledgerRow = await resourceSyncStore.createLead(lead);
  } catch (error) {
    console.error('[leads/resource] Could not record signup before email delivery:', error.message);
    await sendResourceSyncAlert({ kind: 'Signup ledger unavailable', resourceKey: lead.resourceKey, email: lead.email, detail: error.message });
    const fallback = buildFallbackPayload({ resourceKey: lead.resourceKey, emailSent: false });
    return res.status(202).json({
      ok: true, status: 'fallback', recorded: false,
      resource: { key: resource.key, name: resource.name },
      message: 'We could not save your request or email the resource. Please use this direct access option and try the form again later.',
      fallback: fallback.fallback,
    });
  }

  let delivery;
  try {
    delivery = await sendDeliveryEmail(lead);
    console.log(`[leads/resource] Delivered ${lead.resourceKey} (resend id: ${delivery.id})`);
  } catch (error) {
    console.error(`[leads/resource] Delivery email failed for ${lead.resourceKey}:`, error.message);
    try {
      await resourceSyncStore.updateLead(ledgerRow.id, { outcome: 'delivery_failed', errorMessage: error.message, meta: { email_status: 'failed' } });
    } catch (saveError) {
      console.error('[leads/resource] Failed to record delivery error:', saveError.message);
      await sendResourceSyncAlert({ kind: 'Delivery ledger update failed', resourceKey: lead.resourceKey, email: lead.email, detail: saveError.message });
    }
    const fallback = buildFallbackPayload({ resourceKey: lead.resourceKey, emailSent: false });
    return res.status(202).json({
      ok: true,
      status: 'fallback',
      resource: { key: fallback.resource.key, name: fallback.resource.name },
      message: fallback.message,
      fallback: fallback.fallback,
    });
  }

  const meta = { email_status: 'sent', resend_id: delivery.id };
  let ledgerHealthy = true;
  try {
    await resourceSyncStore.updateLead(ledgerRow.id, { outcome: 'sync_pending', meta });
  } catch (error) {
    ledgerHealthy = false;
    console.error('[leads/resource] Failed to record accepted delivery:', error.message);
    await sendResourceSyncAlert({ kind: 'Delivery ledger update failed', resourceKey: lead.resourceKey, email: lead.email, detail: error.message });
  }

  const kitResult = await syncKitForResource(lead);
  const failedSteps = kitResult.failedSteps || [];
  const outcome = kitResult.synced ? 'synced' : 'sync_failed';
  try {
    await resourceSyncStore.updateLead(ledgerRow.id, {
      outcome,
      errorMessage: kitResult.synced ? null : `Kit steps failed: ${failedSteps.join(', ') || kitResult.reason}`,
      meta: { ...meta, failed_steps: failedSteps },
    });
  } catch (error) {
    ledgerHealthy = false;
    console.error('[leads/resource] Failed to update Kit sync state:', error.message);
    await sendResourceSyncAlert({ kind: 'Kit ledger update failed', resourceKey: lead.resourceKey, email: lead.email, detail: error.message });
  }

  if (!kitResult.synced) {
    await sendResourceSyncAlert({ kind: 'Kit sync failed', resourceKey: lead.resourceKey, email: lead.email, detail: `Retry queued for: ${failedSteps.join(', ') || kitResult.reason}` });
  }

  return res.status(200).json({
    ok: true,
    status: kitResult.synced && ledgerHealthy ? 'delivered' : 'delivered_pending_sync',
    resource: { key: resource.key, name: resource.name },
  });
}

// ---- Router ----

async function leadsHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!createPaymentIntentHandler.isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return res.status(400).json({ error: 'Missing or invalid JSON body' });

  // Route by payload shape: quiz has `outcome`, resource has `resourceKey`
  if (body.resourceKey !== undefined) {
    return handleResourceLead(body, res, req);
  }
  return handleQuizLead(body, res, req);
}

leadsHandler.normaliseQuizLead = normaliseQuizLead;
leadsHandler.normaliseResourceLead = normaliseResourceLead;

module.exports = leadsHandler;
