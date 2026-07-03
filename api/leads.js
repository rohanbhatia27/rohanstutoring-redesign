'use strict';

const createPaymentIntentHandler = require('./create-checkout.js');
const { syncQuizLead } = require('./_lib/_kit.js');
const { checkRateLimit } = require('./_lib/_rate-limit.js');
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

  if (!firstName) return { error: 'Missing first name.' };
  if (!createPaymentIntentHandler.isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (!outcome) return { error: 'Missing quiz outcome.' };

  return { firstName: firstName.slice(0, 120), email, outcome };
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

  let resource;
  try {
    const result = await sendDeliveryEmail(lead);
    resource = getFreeResource(lead.resourceKey);
    console.log(`[leads/resource] Delivered ${lead.resourceKey} to ${lead.email} (resend id: ${result.id || 'n/a'})`);
  } catch (error) {
    console.error(`[leads/resource] Delivery email failed for ${lead.resourceKey}:`, error.message);
    const fallback = buildFallbackPayload({ resourceKey: lead.resourceKey, emailSent: false });
    return res.status(202).json({
      ok: true,
      status: 'fallback',
      resource: { key: fallback.resource.key, name: fallback.resource.name },
      message: fallback.message,
      fallback: fallback.fallback,
    });
  }

  // Delivery already succeeded above. Kit sync is best-effort and never throws,
  // so a Kit outage cannot turn a delivered lead into a failure.
  await syncKitForResource(lead);

  return res.status(200).json({
    ok: true,
    status: 'delivered',
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
