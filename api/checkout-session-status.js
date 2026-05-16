const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const CHECKOUT_SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]+$/;
const PUBLIC_ERROR_MESSAGE = 'We could not verify this payment.';
let stripeFactory = (secretKey) => Stripe(secretKey);

function isValidCheckoutSessionId(value) {
  return CHECKOUT_SESSION_ID_PATTERN.test(String(value || '').trim());
}

function getStatusFromSession(session) {
  if (session?.payment_intent?.status) {
    return session.payment_intent.status;
  }

  if (session?.payment_status === 'paid') {
    return 'succeeded';
  }

  if (session?.payment_status === 'unpaid') {
    return 'requires_payment_method';
  }

  return session?.payment_status || '';
}

async function checkoutSessionStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (origin && !createPaymentIntentHandler.isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = String(req.query?.session_id || '').trim();
  if (!isValidCheckoutSessionId(sessionId)) {
    return res.status(400).json({ error: 'Invalid checkout session.' });
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = stripeFactory(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    if (!session) {
      return res.status(404).json({ error: PUBLIC_ERROR_MESSAGE });
    }

    const metadata = session.payment_intent?.metadata || session.metadata || {};

    return res.status(200).json({
      status: getStatusFromSession(session),
      paymentIntentId: session.payment_intent?.id || '',
      metadata: {
        base_slug: metadata.base_slug || metadata.product_slug || '',
        product_slug: metadata.product_slug || metadata.base_slug || '',
        upsell_slug: metadata.upsell_slug || '',
        payment_mode: metadata.payment_mode || '',
      },
    });
  } catch (error) {
    console.error('Stripe checkout session status error:', error.message);
    return res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

checkoutSessionStatusHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
checkoutSessionStatusHandler.isValidCheckoutSessionId = isValidCheckoutSessionId;
checkoutSessionStatusHandler.getStatusFromSession = getStatusFromSession;
checkoutSessionStatusHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
checkoutSessionStatusHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = checkoutSessionStatusHandler;
