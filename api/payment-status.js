'use strict';

const Stripe = require('stripe');
const { PAYPAL_API, getPayPalAccessToken } = require('./_lib/_paypal.js');
const createPaymentIntentHandler = require('./create-checkout.js');
const {
  isValidPayPalOrderId,
  validateCompletedPayPalOrder,
} = require('./_lib/_paypal-order-validation.js');

const { isAllowedOrigin, resolveCheckoutPurchase } = createPaymentIntentHandler;

const PUBLIC_ERROR_MESSAGE = 'We could not verify this payment.';
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9]+$/;
const CHECKOUT_SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]+$/;

let stripeFactory = (secretKey) => Stripe(secretKey);

function isValidPaymentIntentId(value) {
  return PAYMENT_INTENT_ID_PATTERN.test(String(value || '').trim());
}

function isValidCheckoutSessionId(value) {
  return CHECKOUT_SESSION_ID_PATTERN.test(String(value || '').trim());
}

function getStatusFromCheckoutSession(session) {
  if (session?.payment_status === 'paid') return 'succeeded';
  if (session?.payment_status === 'unpaid') return 'requires_payment_method';
  return session?.payment_status || '';
}

// ---- Stripe payment status ----

async function handleStripeStatus(req, res) {
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
    let intent, session;

    if (hasValidSession) {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ['payment_intent'] });
      intent = session?.payment_intent || null;
    } else {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    }

    const status = intent?.status || getStatusFromCheckoutSession(session);
    const metadata = intent?.metadata || session?.metadata || {};

    if (!status) return res.status(404).json({ error: PUBLIC_ERROR_MESSAGE });

    return res.status(200).json({
      status,
      paymentIntentId: intent?.id || '',
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

// ---- PayPal order status ----

async function handlePayPalStatus(req, res) {
  const query = req.query || {};
  const orderID = String(query.paypal_order || '').trim();

  if (!isValidPayPalOrderId(orderID)) {
    return res.status(400).json({ error: 'Invalid PayPal order ID.' });
  }

  const productSlug = String(query.package || query.product || '').trim();
  const upsellSlug = String(query.upsell || '').trim();
  const purchase = resolveCheckoutPurchase({ slug: productSlug, upsellSlug });

  if (purchase.error) return res.status(400).json({ error: purchase.error });

  try {
    const accessToken = await getPayPalAccessToken();
    const orderResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      }
    );

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));
      console.error('PayPal order status failed:', errorData);
      return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
    }

    const orderData = await orderResponse.json();
    const validation = validateCompletedPayPalOrder(orderData, purchase, orderID);
    if (validation.error) return res.status(400).json({ error: validation.error });

    return res.status(200).json({
      status: 'succeeded',
      orderID: validation.orderID,
      metadata: {
        base_slug: purchase.baseSlug,
        upsell_slug: purchase.upsellSlug || '',
      },
    });
  } catch (err) {
    console.error('PayPal order status error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
  }
}

// ---- Router ----

async function paymentStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route by query params: paypal_order → PayPal; payment_intent or session_id → Stripe
  const query = req.query || {};
  if (query.paypal_order) {
    return handlePayPalStatus(req, res);
  }
  return handleStripeStatus(req, res);
}

paymentStatusHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
paymentStatusHandler.isAllowedOrigin = isAllowedOrigin;
paymentStatusHandler.isValidPaymentIntentId = isValidPaymentIntentId;
paymentStatusHandler.isValidCheckoutSessionId = isValidCheckoutSessionId;
paymentStatusHandler.getStatusFromCheckoutSession = getStatusFromCheckoutSession;
paymentStatusHandler.__setStripeFactory = (value) => { stripeFactory = value; };
paymentStatusHandler.__resetForTests = () => { stripeFactory = (secretKey) => Stripe(secretKey); };

module.exports = paymentStatusHandler;
