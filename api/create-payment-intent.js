const Stripe = require('stripe');
const {
  ESSAY_UPLOAD_INSTRUCTIONS,
  buildEssayUploadToken,
  buildEssayUploadUrl,
} = require('./_lib/_essay-upload.js');
const {
  AMOUNTS,
  UNAVAILABLE_PRODUCTS,
  HIGH_TICKET_PRODUCT_SLUGS,
  ESSAY_UPLOAD_SLUGS,
  ALLOWED_UPSELLS,
  normaliseSlug,
  normaliseUpsellSlug,
  getUpsellAmount,
  isAllowedUpsellCombination,
  resolveCheckoutPurchase,
  buildPaymentIntentIdempotencyKey,
} = require('./_lib/products.js');
const { checkRateLimit } = require('./_lib/_rate-limit.js');
const logPurchaseEvent = require('./_lib/_purchase-log.js');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PUBLIC_ERROR_MESSAGE = 'Payment setup failed. Please try again.';
let stripeFactory = (secretKey) => Stripe(secretKey);

async function applyCouponDiscount(stripe, baseAmount, couponCode, productSlug = '') {
  const couponDetails = await getValidatedCouponDetails(stripe, {
    couponCode,
    productSlug,
    baseAmount,
  });

  if (!couponDetails.valid) {
    return {
      discountAmount: 0,
      error: couponDetails.error || '',
    };
  }

  return {
    discountAmount: couponDetails.discountAmount,
    couponCode: couponDetails.code,
  };
}

function parseCouponRestrictionSet(value) {
  return new Set(
    String(value || '')
      .split(/[,\s]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getCouponAllowedProductSlugs(coupon) {
  const metadata = coupon && coupon.metadata && typeof coupon.metadata === 'object'
    ? coupon.metadata
    : {};
  const explicitProducts = parseCouponRestrictionSet(
    metadata.allowed_products || metadata.allowed_product_slugs || metadata.product_slugs
  );

  if (explicitProducts.size > 0) {
    return explicitProducts;
  }

  const productGroups = parseCouponRestrictionSet(
    metadata.allowed_product_group || metadata.allowed_product_groups || metadata.product_group
  );

  if (productGroups.has('high_ticket') || productGroups.has('high-ticket')) {
    return new Set(HIGH_TICKET_PRODUCT_SLUGS);
  }

  return null;
}

function isCouponEligibleForProduct(coupon, productSlug) {
  const slug = normaliseSlug(productSlug).toLowerCase();
  if (!slug) return false;

  const allowedProducts = getCouponAllowedProductSlugs(coupon);
  if (!allowedProducts || allowedProducts.size === 0) {
    return true;
  }

  return allowedProducts.has(slug);
}

function formatCouponLabel(coupon, fallbackCode = '') {
  if (!coupon) return fallbackCode;

  if (coupon.percent_off) {
    return `${coupon.percent_off}% Off`;
  }

  if (coupon.amount_off) {
    const amount = coupon.amount_off / 100;
    const formattedAmount = Number.isInteger(amount)
      ? amount.toLocaleString()
      : amount.toFixed(2);
    return `$${formattedAmount} Off`;
  }

  return coupon.name || fallbackCode;
}

async function getValidatedCouponDetails(stripe, {
  couponCode,
  productSlug = '',
  baseAmount = 0,
} = {}) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) {
    return { valid: false, error: '' };
  }

  try {
    const result = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });
    const promoCode = result.data[0];

    if (!promoCode || !promoCode.coupon || !promoCode.coupon.valid) {
      return { valid: false, error: 'Coupon code not found or expired.' };
    }

    const coupon = promoCode.coupon;
    if (!isCouponEligibleForProduct(coupon, productSlug || 'unknown')) {
      return {
        valid: false,
        error: 'This coupon is not valid for the selected product.',
      };
    }

    let discountAmount = 0;

    if (coupon.percent_off) {
      discountAmount = Math.round(baseAmount * coupon.percent_off / 100);
    } else if (coupon.amount_off) {
      discountAmount = Math.min(coupon.amount_off, baseAmount);
    }

    return {
      valid: true,
      code,
      coupon,
      couponId: coupon.id || '',
      promotionCodeId: promoCode.id || '',
      label: formatCouponLabel(coupon, code),
      discount: coupon.percent_off
        ? { type: 'percent', value: coupon.percent_off }
        : { type: 'fixed', value: coupon.amount_off / 100 },
      discountAmount,
    };
  } catch (err) {
    console.error('Coupon lookup error:', err.message);
    return { valid: false, error: 'Could not validate coupon. Please try again.' };
  }
}



function normaliseOriginHost(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

function isAllowedOrigin(origin) {
  if (!origin) return false;

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

function isValidEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}



function normaliseCustomerDetails(body) {
  const email = String(body.email || '').trim();
  const customerName = String(body.customerName || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').trim().replace(/\s+/g, ' ');

  if (!isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  if (!customerName) {
    return { error: 'Missing customer name.' };
  }

  if (!phone) {
    return { error: 'Please enter a phone number.' };
  }

  return {
    email,
    customerName: customerName.slice(0, 120),
    phone: phone.slice(0, 40),
  };
}

function requiresEssayUploadLink(purchase) {
  return purchase && ESSAY_UPLOAD_SLUGS.has(purchase.baseSlug);
}



async function createPaymentIntentHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body && typeof req.body === 'object' ? req.body : null;

  if (!body) {
    return res.status(400).json({ error: 'Missing or invalid JSON body' });
  }

  const purchase = resolveCheckoutPurchase(body);
  if (purchase.error) {
    return res.status(400).json({ error: purchase.error });
  }

  const customer = normaliseCustomerDetails(body);
  if (customer.error) {
    return res.status(400).json({ error: customer.error });
  }

  const rl = await checkRateLimit(req, { bucket: 'payment', email: customer.email });
  if (rl.limited) {
    return res.status(429).json({ error: rl.message });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = stripeFactory(process.env.STRIPE_SECRET_KEY);
    const metadata = {
      product_slug: purchase.baseSlug,
      base_slug: purchase.baseSlug,
      customer_email: customer.email,
      customer_name: customer.customerName,
      customer_phone: customer.phone,
    };

    if (purchase.upsellSlug) {
      metadata.upsell_slug = purchase.upsellSlug;
    }

    const couponCode = String(body.couponCode || '').trim();
    const { discountAmount, couponCode: validatedCode, error: couponError } = await applyCouponDiscount(
      stripe,
      purchase.amount,
      couponCode,
      purchase.baseSlug
    );
    if (couponCode && couponError) {
      return res.status(400).json({ error: couponError });
    }
    const finalAmount = Math.max(50, purchase.amount - discountAmount);

    if (validatedCode && discountAmount > 0) {
      metadata.coupon_code = validatedCode;
      metadata.discount_amount = String(discountAmount);
    }

    const intent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: 'aud',
      receipt_email: customer.email,
      description: purchase.upsellSlug
        ? `Rohan's GAMSAT - ${purchase.baseSlug} + ${purchase.upsellSlug}`
        : `Rohan's GAMSAT - ${purchase.baseSlug}`,
      metadata,
    }, {
      idempotencyKey: buildPaymentIntentIdempotencyKey({
        customerEmail: customer.email,
        purchase,
      }),
    });

    if (requiresEssayUploadLink(purchase) && stripe.paymentIntents.update && intent.id) {
      const essayUploadToken = buildEssayUploadToken({
        paymentIntentId: intent.id,
        productSlug: purchase.baseSlug,
        upsellSlug: purchase.upsellSlug,
      });
      const essayUploadUrl = buildEssayUploadUrl({
        paymentIntentId: intent.id,
        productSlug: purchase.baseSlug,
        upsellSlug: purchase.upsellSlug,
        uploadToken: essayUploadToken,
      });

      await stripe.paymentIntents.update(intent.id, {
        description: `Rohan's GAMSAT - ${purchase.baseSlug}. Upload essay after payment: ${essayUploadUrl}`,
        metadata: {
          ...metadata,
          essay_upload_required: 'true',
          essay_upload_url: essayUploadUrl,
          essay_upload_token: essayUploadToken,
          essay_upload_instructions: ESSAY_UPLOAD_INSTRUCTIONS,
        },
      });
    }

    await logPurchaseEvent({
      eventType: 'payment_intent.created',
      provider: 'stripe',
      paymentId: intent.id,
      productSlug: purchase.baseSlug,
      upsellSlug: purchase.upsellSlug || '',
      customerEmail: customer.email,
      customerName: customer.customerName,
      amountCents: finalAmount,
      currency: 'aud',
      outcome: 'success',
    });

    res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

createPaymentIntentHandler.AMOUNTS = AMOUNTS;
createPaymentIntentHandler.UNAVAILABLE_PRODUCTS = UNAVAILABLE_PRODUCTS;
createPaymentIntentHandler.ALLOWED_UPSELLS = ALLOWED_UPSELLS;
createPaymentIntentHandler.HIGH_TICKET_PRODUCT_SLUGS = HIGH_TICKET_PRODUCT_SLUGS;
createPaymentIntentHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
createPaymentIntentHandler.isAllowedOrigin = isAllowedOrigin;
createPaymentIntentHandler.isValidEmail = isValidEmail;
createPaymentIntentHandler.normaliseCustomerDetails = normaliseCustomerDetails;
createPaymentIntentHandler.buildEssayUploadToken = buildEssayUploadToken;
createPaymentIntentHandler.buildEssayUploadUrl = buildEssayUploadUrl;
createPaymentIntentHandler.isAllowedUpsellCombination = isAllowedUpsellCombination;
createPaymentIntentHandler.isCouponEligibleForProduct = isCouponEligibleForProduct;
createPaymentIntentHandler.getCouponAllowedProductSlugs = getCouponAllowedProductSlugs;
createPaymentIntentHandler.formatCouponLabel = formatCouponLabel;
createPaymentIntentHandler.getValidatedCouponDetails = getValidatedCouponDetails;
createPaymentIntentHandler.normaliseUpsellSlug = normaliseUpsellSlug;
createPaymentIntentHandler.getUpsellAmount = getUpsellAmount;
createPaymentIntentHandler.resolveCheckoutPurchase = resolveCheckoutPurchase;
createPaymentIntentHandler.buildPaymentIntentIdempotencyKey = buildPaymentIntentIdempotencyKey;
createPaymentIntentHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
createPaymentIntentHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = createPaymentIntentHandler;
