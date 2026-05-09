const Stripe = require('stripe');

let stripeFactory = (secretKey) => Stripe(secretKey);

function normaliseOriginHost(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch (error) {
    return false;
  }

  const host = parsedOrigin.host.toLowerCase();
  const ownVercelHosts = new Set([
    'rohanstutoring-redesign.vercel.app',
    normaliseOriginHost(process.env.VERCEL_URL),
  ]);

  if (parsedOrigin.protocol === 'http:') {
    return /^(127\.0\.0\.1|localhost):\d+$/i.test(host);
  }

  if (parsedOrigin.protocol !== 'https:') return false;

  return (
    host === 'rohanstutoring.com' ||
    host === 'www.rohanstutoring.com' ||
    ownVercelHosts.has(host) ||
    /^rohanstutoring-redesign(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(host)
  );
}

async function validateCouponHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const code = String(body.code || '').trim().toUpperCase();
  if (!code) {
    return res.status(200).json({ valid: false, error: 'Please enter a coupon code.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Configuration error.' });
  }

  try {
    const stripe = stripeFactory(process.env.STRIPE_SECRET_KEY);
    const result = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    const promoCode = result.data[0];

    if (!promoCode || !promoCode.coupon || !promoCode.coupon.valid) {
      return res.status(200).json({ valid: false, error: 'Coupon code not found or expired.' });
    }

    const coupon = promoCode.coupon;
    const discount = coupon.percent_off
      ? { type: 'percent', value: coupon.percent_off }
      : { type: 'fixed', value: coupon.amount_off / 100 };

    return res.status(200).json({
      valid: true,
      code,
      discount,
      label: coupon.name || code,
    });
  } catch (err) {
    console.error('Coupon validation error:', err.message);
    return res.status(500).json({ error: 'Could not validate coupon. Please try again.' });
  }
}

validateCouponHandler.__setStripeFactory = (fn) => { stripeFactory = fn; };

module.exports = validateCouponHandler;
