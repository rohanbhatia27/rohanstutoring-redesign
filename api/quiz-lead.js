const createPaymentIntentHandler = require('./create-payment-intent.js');
const { syncQuizLead } = require('./_lib/_kit.js');

function normaliseLead(body) {
  const firstName = String(body.firstName || '').trim().replace(/\s+/g, ' ');
  const email = String(body.email || '').trim();
  const outcome = String(body.outcome || '').trim();

  if (!firstName) {
    return { error: 'Missing first name.' };
  }

  if (!createPaymentIntentHandler.isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  if (!outcome) {
    return { error: 'Missing quiz outcome.' };
  }

  return {
    firstName: firstName.slice(0, 120),
    email,
    outcome,
  };
}

async function quizLeadHandler(req, res) {
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
    await syncQuizLead(lead);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[quiz-lead] Kit sync failed:', error.message);
    return res.status(500).json({ error: 'Unable to save your study plan right now. Please try again.' });
  }
}

quizLeadHandler.normaliseLead = normaliseLead;

module.exports = quizLeadHandler;
