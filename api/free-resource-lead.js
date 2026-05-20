const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  getFreeResource,
  submitKitResourceLead,
  buildFallbackPayload,
  sendFallbackEmail,
} = require('./_lib/_free-resource.js');

function normaliseLead(body) {
  const resourceKey = String(body.resourceKey || '').trim();
  const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const email = String(body.email || '').trim();

  if (!getFreeResource(resourceKey)) {
    return { error: 'Missing or invalid resource.' };
  }

  if (!createPaymentIntentHandler.isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  return {
    resourceKey,
    firstName,
    email,
  };
}

async function freeResourceLeadHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!createPaymentIntentHandler.isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) {
    return res.status(400).json({ error: 'Missing or invalid JSON body' });
  }

  const lead = normaliseLead(body);
  if (lead.error) {
    return res.status(400).json({ error: lead.error });
  }

  try {
    const result = await submitKitResourceLead(lead);
    return res.status(200).json({
      ok: true,
      status: 'kit',
      resource: {
        key: result.resource.key,
        name: result.resource.name,
      },
    });
  } catch (error) {
    console.error(`[free-resource-lead] Kit submission failed for ${lead.resourceKey}:`, error.message);

    let fallbackEmailSent = false;
    try {
      const emailResult = await sendFallbackEmail(lead);
      fallbackEmailSent = Boolean(emailResult && emailResult.sent);
    } catch (emailError) {
      console.error(`[free-resource-lead] Fallback email failed for ${lead.resourceKey}:`, emailError.message);
    }

    const fallback = buildFallbackPayload({
      resourceKey: lead.resourceKey,
      emailSent: fallbackEmailSent,
    });

    return res.status(202).json({
      ok: true,
      status: 'fallback',
      resource: {
        key: fallback.resource.key,
        name: fallback.resource.name,
      },
      message: fallback.message,
      fallback: fallback.fallback,
    });
  }
}

freeResourceLeadHandler.normaliseLead = normaliseLead;

module.exports = freeResourceLeadHandler;
