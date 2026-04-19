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

  return res.status(200).json({ stripePublishableKey: publishableKey });
}

publicConfigHandler.isAllowedOrigin = isAllowedOrigin;

module.exports = publicConfigHandler;
