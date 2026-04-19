const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const PUBLIC_ERROR_MESSAGE = 'We could not verify this payment.';
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9]+$/;

function isAllowedOrigin(origin) {
  return createPaymentIntentHandler.isAllowedOrigin(origin);
}

function isValidPaymentIntentId(value) {
  return PAYMENT_INTENT_ID_PATTERN.test(String(value || '').trim());
}

async function paymentIntentStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymentIntentId = String(req.query?.payment_intent || '').trim();
  if (!isValidPaymentIntentId(paymentIntentId)) {
    return res.status(400).json({ error: 'Invalid payment intent.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!intent || !intent.status) {
      return res.status(404).json({ error: PUBLIC_ERROR_MESSAGE });
    }

    return res.status(200).json({ status: intent.status });
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

paymentIntentStatusHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
paymentIntentStatusHandler.isAllowedOrigin = isAllowedOrigin;
paymentIntentStatusHandler.isValidPaymentIntentId = isValidPaymentIntentId;

module.exports = paymentIntentStatusHandler;
