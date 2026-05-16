const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const ELIGIBLE_AFTERPAY_PRODUCTS = new Set(['blueprint']);
const PUBLIC_ERROR_MESSAGE = 'Afterpay checkout setup failed. Please try again.';
let stripeFactory = (secretKey) => Stripe(secretKey);

async function applyCouponDiscount(stripe, baseAmount, couponCode) {
  if (!couponCode) return { discountAmount: 0 };

  try {
    const result = await stripe.promotionCodes.list({
      code: String(couponCode).trim().toUpperCase(),
      active: true,
      limit: 1,
    });
    const promoCode = result.data[0];

    if (!promoCode || !promoCode.coupon || !promoCode.coupon.valid) {
      return { discountAmount: 0 };
    }

    const coupon = promoCode.coupon;
    let discountAmount = 0;

    if (coupon.percent_off) {
      discountAmount = Math.round(baseAmount * coupon.percent_off / 100);
    } else if (coupon.amount_off) {
      discountAmount = Math.min(coupon.amount_off, baseAmount);
    }

    return { discountAmount, couponCode: String(couponCode).trim().toUpperCase() };
  } catch (err) {
    console.error('Coupon lookup error:', err.message);
    return { discountAmount: 0 };
  }
}

function validateAfterpayRequest(body) {
  const slug = String(body && body.slug ? body.slug : '').trim();
  const paymentMode = String(body && body.paymentMode ? body.paymentMode : '').trim();

  if (paymentMode !== 'afterpay') {
    return { error: 'Invalid payment mode.' };
  }

  if (!ELIGIBLE_AFTERPAY_PRODUCTS.has(slug)) {
    return { error: 'Afterpay is not available for this product.' };
  }

  return { slug, paymentMode };
}

function getSessionOrigin(bodyOrigin, requestOrigin) {
  const candidateOrigin = String(bodyOrigin || requestOrigin || '').trim();

  if (!candidateOrigin || !createPaymentIntentHandler.isAllowedOrigin(candidateOrigin)) {
    return '';
  }

  return candidateOrigin;
}

function buildAfterpaySessionPayload({
  purchase,
  customer,
  origin,
  finalAmount,
  couponCode,
}) {
  const metadata = {
    product_slug: purchase.baseSlug,
    base_slug: purchase.baseSlug,
    payment_mode: 'afterpay',
    customer_email: customer.email,
    customer_name: customer.customerName,
  };

  if (purchase.upsellSlug) {
    metadata.upsell_slug = purchase.upsellSlug;
  }

  if (couponCode) {
    metadata.coupon_code = couponCode;
  }

  return {
    mode: 'payment',
    payment_method_types: ['afterpay_clearpay'],
    success_url: `${origin}/checkout/success?product=${purchase.baseSlug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/?product=${purchase.baseSlug}`,
    customer_email: customer.email,
    billing_address_collection: 'required',
    line_items: [
      {
        price_data: {
          currency: 'aud',
          product_data: {
            name: purchase.upsellSlug
              ? `Rohan's GAMSAT - ${purchase.baseSlug} + ${purchase.upsellSlug}`
              : `Rohan's GAMSAT - ${purchase.baseSlug}`,
          },
          unit_amount: finalAmount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: {
      receipt_email: customer.email,
      description: purchase.upsellSlug
        ? `Rohan's GAMSAT - ${purchase.baseSlug} + ${purchase.upsellSlug}`
        : `Rohan's GAMSAT - ${purchase.baseSlug}`,
      metadata,
    },
  };
}

async function createAfterpaySessionHandler(req, res) {
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

  const afterpayRequest = validateAfterpayRequest(body);
  if (afterpayRequest.error) {
    return res.status(400).json({ error: afterpayRequest.error });
  }

  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase(body);
  if (purchase.error) {
    return res.status(400).json({ error: purchase.error });
  }

  const customer = createPaymentIntentHandler.normaliseCustomerDetails(body);
  if (customer.error) {
    return res.status(400).json({ error: customer.error });
  }

  const sessionOrigin = getSessionOrigin(body.origin, origin);
  if (!sessionOrigin) {
    return res.status(400).json({ error: 'Invalid origin.' });
  }

  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = stripeFactory(secretKey);
    const couponCode = String(body.couponCode || '').trim();
    const { discountAmount, couponCode: validatedCode } = await applyCouponDiscount(stripe, purchase.amount, couponCode);
    const finalAmount = Math.max(50, purchase.amount - discountAmount);
    const session = await stripe.checkout.sessions.create(
      buildAfterpaySessionPayload({
        purchase,
        customer,
        origin: sessionOrigin,
        finalAmount,
        couponCode: validatedCode && discountAmount > 0 ? validatedCode : '',
      })
    );

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Afterpay checkout session error:', error.message);
    return res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

createAfterpaySessionHandler.ELIGIBLE_AFTERPAY_PRODUCTS = ELIGIBLE_AFTERPAY_PRODUCTS;
createAfterpaySessionHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
createAfterpaySessionHandler.validateAfterpayRequest = validateAfterpayRequest;
createAfterpaySessionHandler.getSessionOrigin = getSessionOrigin;
createAfterpaySessionHandler.buildAfterpaySessionPayload = buildAfterpaySessionPayload;
createAfterpaySessionHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
createAfterpaySessionHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = createAfterpaySessionHandler;
