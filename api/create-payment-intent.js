const Stripe = require('stripe');
const {
  ESSAY_UPLOAD_INSTRUCTIONS,
  buildEssayUploadToken,
  buildEssayUploadUrl,
} = require('./_lib/_essay-upload.js');

// Amounts in cents (AUD). Private mentoring uses separate slugs per package.
const AMOUNTS = {
  blueprint: 59900,
  advanced: 29900,
  'essay-collection': 7900,
  'starter-pack': 9700,
  'essay-marking': 3499,
  'essay-pack-10': 24900,
  comprehensive: 154900,
  's1-comprehensive': 89900,
  's2-comprehensive': 89900,
  mastery: 224900,
  's1-rescue-sprint': 34700,
  's2-rescue-sprint': 19900,
  'mentoring-single': 11900,
  'mentoring-pack': 107000,
};

const UNAVAILABLE_PRODUCTS = new Set([
  's1-rescue-sprint',
  's2-rescue-sprint',
]);
const HIGH_TICKET_PRODUCT_SLUGS = new Set([
  'comprehensive',
  'mastery',
]);

const ALLOWED_UPSELLS = {
  blueprint: new Set(['essay-pack-10']),
  advanced: new Set(['essay-collection']),
  'starter-pack': new Set(['essay-collection']),
  'essay-marking': new Set(['essay-collection']),
  comprehensive: new Set(['mentoring-single']),
  's1-rescue-sprint': new Set(['essay-collection']),
  's2-rescue-sprint': new Set(['essay-collection']),
  'private-mentoring': new Set(['essay-collection']),
  'mentoring-single': new Set(['essay-collection']),
  'mentoring-pack': new Set(['essay-collection']),
};

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
        error: 'This coupon is only valid for the Comprehensive Course and Mastery Program.',
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
      label: coupon.name || code,
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

function getUpsellAmount(baseSlug, upsellSlug) {
  if (baseSlug === 'comprehensive' && upsellSlug === 'mentoring-single') {
    return 9900;
  }

  return AMOUNTS[upsellSlug];
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

function normaliseSlug(value) {
  return String(value || '').trim();
}

function normaliseUpsellSlug(body) {
  return normaliseSlug(body.upsellSlug || body.upsell_slug || body.addOnSlug);
}

function isAllowedUpsellCombination(baseSlug, upsellSlug) {
  const allowedUpsells = ALLOWED_UPSELLS[baseSlug];

  return !!allowedUpsells && allowedUpsells.has(upsellSlug);
}

function resolveCheckoutPurchase(body) {
  const baseSlug = normaliseSlug(body.slug);
  const upsellSlug = normaliseUpsellSlug(body);
  const baseAmount = AMOUNTS[baseSlug];

  if (!baseAmount) {
    return { error: 'Invalid product slug: ' + baseSlug };
  }

  if (UNAVAILABLE_PRODUCTS.has(baseSlug)) {
    return { error: 'This product is currently unavailable.' };
  }

  if (!upsellSlug) {
    return {
      amount: baseAmount,
      baseAmount,
      baseSlug,
      upsellAmount: 0,
      upsellSlug: '',
    };
  }

  const upsellAmount = getUpsellAmount(baseSlug, upsellSlug);
  if (!upsellAmount) {
    return { error: 'Invalid upsell slug: ' + upsellSlug };
  }

  if (baseSlug === upsellSlug || !isAllowedUpsellCombination(baseSlug, upsellSlug)) {
    return {
      error: `Invalid upsell combination: ${baseSlug} + ${upsellSlug}`,
    };
  }

  return {
    amount: baseAmount + upsellAmount,
    baseAmount,
    baseSlug,
    upsellAmount,
    upsellSlug,
  };
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
  return purchase && purchase.baseSlug === 'essay-marking';
}

function buildPaymentIntentIdempotencyKey({ customerEmail = '', purchase = {} } = {}) {
  const emailPart = String(customerEmail || '').trim().toLowerCase();
  const baseSlugPart = String(purchase.baseSlug || '').trim().toLowerCase();
  const upsellSlugPart = String(purchase.upsellSlug || '').trim().toLowerCase();
  const minuteWindow = Math.floor(Date.now() / 60000);

  return [
    'pi',
    emailPart || 'anonymous',
    baseSlugPart || 'unknown',
    upsellSlugPart || 'no-upsell',
    minuteWindow,
  ].join('-');
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
