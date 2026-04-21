const createPaymentIntentHandler = require('./create-payment-intent.js');

function isAllowedOrigin(origin) {
  return createPaymentIntentHandler.isAllowedOrigin(origin);
}

async function publicConfigHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
  if (!publishableKey) {
    return res.status(500).json({ error: 'Missing STRIPE_PUBLISHABLE_KEY environment variable' });
  }

  const amountsCents = createPaymentIntentHandler.AMOUNTS || {};
  const amounts = {};
  for (const [key, value] of Object.entries(amountsCents)) {
    amounts[key] = value / 100;
  }

  return res.status(200).json({ stripePublishableKey: publishableKey, amounts });
}

publicConfigHandler.isAllowedOrigin = isAllowedOrigin;

module.exports = publicConfigHandler;
