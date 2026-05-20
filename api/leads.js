'use strict';

const createPaymentIntentHandler = require('./create-payment-intent.js');
const { syncQuizLead } = require('./_lib/_kit.js');
const {
  getFreeResource,
  submitKitResourceLead,
  buildFallbackPayload,
  sendFallbackEmail,
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

async function handleQuizLead(body, res) {
  const lead = normaliseQuizLead(body);
  if (lead.error) return res.status(400).json({ error: lead.error });

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

async function handleResourceLead(body, res) {
  const lead = normaliseResourceLead(body);
  if (lead.error) return res.status(400).json({ error: lead.error });

  try {
    const result = await submitKitResourceLead(lead);
    return res.status(200).json({
      ok: true,
      status: 'kit',
      resource: { key: result.resource.key, name: result.resource.name },
    });
  } catch (error) {
    console.error(`[leads/resource] Kit submission failed for ${lead.resourceKey}:`, error.message);

    let fallbackEmailSent = false;
    try {
      const emailResult = await sendFallbackEmail(lead);
      fallbackEmailSent = Boolean(emailResult && emailResult.sent);
    } catch (emailError) {
      console.error(`[leads/resource] Fallback email failed for ${lead.resourceKey}:`, emailError.message);
    }

    const fallback = buildFallbackPayload({ resourceKey: lead.resourceKey, emailSent: fallbackEmailSent });
    return res.status(202).json({
      ok: true,
      status: 'fallback',
      resource: { key: fallback.resource.key, name: fallback.resource.name },
      message: fallback.message,
      fallback: fallback.fallback,
    });
  }
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
    return handleResourceLead(body, res);
  }
  return handleQuizLead(body, res);
}

leadsHandler.normaliseQuizLead = normaliseQuizLead;
leadsHandler.normaliseResourceLead = normaliseResourceLead;

module.exports = leadsHandler;
