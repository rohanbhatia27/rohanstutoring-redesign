const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const PUBLIC_ERROR_MESSAGE = 'We could not verify this payment.';
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9]+$/;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]+$/;
let stripeFactory = (secretKey) => Stripe(secretKey);

function isAllowedOrigin(origin) {
  return createPaymentIntentHandler.isAllowedOrigin(origin);
}

function isValidPaymentIntentId(value) {
  return PAYMENT_INTENT_ID_PATTERN.test(String(value || '').trim());
}

function isValidCheckoutSessionId(value) {
  return CHECKOUT_SESSION_ID_PATTERN.test(String(value || '').trim());
}

async function paymentIntentStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymentIntentId = String(req.query?.payment_intent || '').trim();
  const checkoutSessionId = String(req.query?.session_id || '').trim();
  const hasValidPaymentIntent = isValidPaymentIntentId(paymentIntentId);
  const hasValidSession = isValidCheckoutSessionId(checkoutSessionId);

  if (!hasValidPaymentIntent && !hasValidSession) {
    return res.status(400).json({ error: paymentIntentId ? 'Invalid payment intent.' : 'Invalid checkout session.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = stripeFactory(process.env.STRIPE_SECRET_KEY);
    let intent;

    if (hasValidSession) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ['payment_intent'],
      });

      intent = session?.payment_intent || null;
    } else {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    }

    if (!intent || !intent.status) {
      return res.status(404).json({ error: PUBLIC_ERROR_MESSAGE });
    }

    const metadata = intent.metadata || {};

    return res.status(200).json({
      status: intent.status,
      paymentIntentId: intent.id || '',
      metadata: {
        base_slug: metadata.base_slug || metadata.product_slug || '',
        product_slug: metadata.product_slug || metadata.base_slug || '',
        upsell_slug: metadata.upsell_slug || '',
        payment_mode: metadata.payment_mode || '',
      },
    });
  } catch (error) {
    console.error('Stripe error:', error.message);
    return res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

paymentIntentStatusHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
paymentIntentStatusHandler.isAllowedOrigin = isAllowedOrigin;
paymentIntentStatusHandler.isValidPaymentIntentId = isValidPaymentIntentId;
paymentIntentStatusHandler.isValidCheckoutSessionId = isValidCheckoutSessionId;
paymentIntentStatusHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
paymentIntentStatusHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = paymentIntentStatusHandler;
