const Stripe = require('stripe');
const fulfillPaymentIntent = require('./_lib/_fulfill-payment-intent.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const paymentIntentStatusHandler = require('./payment-status.js');

let stripeFactory = (secretKey) => Stripe(secretKey);

function getRetryToken() {
  return String(process.env.FULFILLMENT_RETRY_TOKEN || '').trim();
}

function getRequestToken(req) {
  return String(
    req.headers['x-fulfillment-retry-token'] ||
    req.body?.token ||
    ''
  ).trim();
}

async function retryFulfillmentHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!createPaymentIntentHandler.isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = getRetryToken();
  if (!expectedToken || getRequestToken(req) !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const paymentIntentId = String(req.body?.payment_intent || req.body?.paymentIntentId || '').trim();
  if (!paymentIntentStatusHandler.isValidPaymentIntentId(paymentIntentId)) {
    return res.status(400).json({ error: 'Invalid payment intent.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripeClient = stripeFactory(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    const result = await fulfillPaymentIntent({
      paymentIntent,
      stripeClient,
      forceAutomation: true,
    });

    return res.status(200).json({
      ok: true,
      alreadyFulfilled: Boolean(result.alreadyFulfilled),
      productSlug: result.plan?.productSlug || '',
    });
  } catch (error) {
    console.error('[retry-fulfillment] Retry failed:', error.message);
    return res.status(500).json({ error: 'Fulfillment retry failed.' });
  }
}

retryFulfillmentHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};

retryFulfillmentHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = retryFulfillmentHandler;
