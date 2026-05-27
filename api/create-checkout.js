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
  normaliseUpsellQuantity,
  getUpsellAmount,
  isAllowedUpsellCombination,
  resolveCheckoutPurchase,
  buildPaymentIntentIdempotencyKey,
} = require('./_lib/products.js');
const { CATALOG } = require('./_lib/catalog.server.js');
const { checkRateLimit } = require('./_lib/_rate-limit.js');
const logPurchaseEvent = require('./_lib/_purchase-log.js');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PUBLIC_ERROR_MESSAGE = 'Payment setup failed. Please try again.';
const INSTALMENT_PUBLIC_ERROR_MESSAGE = 'Instalment checkout setup failed. Please try again.';
let stripeFactory = (secretKey) => Stripe(secretKey);

// Derived from catalog — edit js/catalog.js instead.
const ELIGIBLE_INSTALMENT_PRODUCTS = new Set(
  Object.keys(CATALOG).filter(function (k) { return CATALOG[k].instalmentEligible; })
);
const ELIGIBLE_AFTERPAY_PRODUCTS = new Set(
  Object.keys(CATALOG).filter(function (k) { return CATALOG[k].afterpay; })
);
const PRICE_ENV_KEYS = (function () {
  const m = {};
  Object.keys(CATALOG).forEach(function (k) {
    const inst = CATALOG[k].instalment;
    if (inst && inst.plan && inst.plan.priceEnvKey) m[k] = inst.plan.priceEnvKey;
  });
  return m;
}());

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
    let discountValue;

    const slug = normaliseSlug(productSlug).toLowerCase();
    const metaAmountKey = `amount_${slug.replace(/-/g, '_')}`;
    const metaAmountCents = coupon.metadata && coupon.metadata[metaAmountKey]
      ? parseInt(coupon.metadata[metaAmountKey], 10)
      : NaN;

    if (!isNaN(metaAmountCents) && metaAmountCents > 0) {
      discountAmount = Math.min(metaAmountCents, baseAmount);
      discountValue = { type: 'fixed', value: discountAmount / 100 };
    } else if (coupon.percent_off) {
      discountAmount = Math.round(baseAmount * coupon.percent_off / 100);
      discountValue = { type: 'percent', value: coupon.percent_off };
    } else if (coupon.amount_off) {
      discountAmount = Math.min(coupon.amount_off, baseAmount);
      discountValue = { type: 'fixed', value: coupon.amount_off / 100 };
    } else {
      discountValue = { type: 'fixed', value: 0 };
    }

    const label = discountValue.type === 'fixed'
      ? `$${Number.isInteger(discountValue.value) ? discountValue.value.toLocaleString() : discountValue.value.toFixed(2)} Off`
      : formatCouponLabel(coupon, code);

    return {
      valid: true,
      code,
      coupon,
      couponId: coupon.id || '',
      promotionCodeId: promoCode.id || '',
      label,
      discount: discountValue,
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



function validateInstalmentRequest(body) {
  const slug = String(body && body.slug ? body.slug : '').trim();
  const paymentMode = String(body && body.paymentMode ? body.paymentMode : '').trim();
  const upsellSlug = normaliseUpsellSlug(body || {});
  const upsellQuantity = upsellSlug ? normaliseUpsellQuantity(body || {}) : 0;

  if (!['instalments', 'afterpay'].includes(paymentMode)) {
    return { error: 'Invalid payment mode.' };
  }

  if (paymentMode === 'instalments' && !ELIGIBLE_INSTALMENT_PRODUCTS.has(slug)) {
    return { error: 'Instalments are not available for this product.' };
  }

  if (paymentMode === 'afterpay' && !ELIGIBLE_AFTERPAY_PRODUCTS.has(slug)) {
    return { error: 'Afterpay is not available for this product.' };
  }

  if (upsellSlug) {
    if (!isAllowedUpsellCombination(slug, upsellSlug)) {
      return { error: `Invalid upsell combination: ${slug} + ${upsellSlug}` };
    }
  }

  return { slug, paymentMode, upsellSlug, upsellQuantity };
}

function getSessionOrigin(bodyOrigin, requestOrigin) {
  const candidateOrigin = String(bodyOrigin || requestOrigin || '').trim();

  if (!candidateOrigin || !isAllowedOrigin(candidateOrigin)) {
    return '';
  }

  return candidateOrigin;
}

function buildOneTimeCheckoutLineItems(slug, upsellSlug, upsellQuantity = 1) {
  if (!upsellSlug) return [];
  const upsellEntry = CATALOG[upsellSlug];
  if (!upsellEntry) return [];
  const upsellCents = getUpsellAmount(slug, upsellSlug);
  if (!upsellCents) return [];
  const quantity = Math.max(1, Math.floor(Number(upsellQuantity) || 1));

  return [
    {
      price_data: {
        currency: 'aud',
        product_data: {
          name: upsellEntry.title || upsellEntry.name,
        },
        unit_amount: upsellCents,
      },
      quantity,
    },
  ];
}

function buildInstalmentSessionPayload({
  slug,
  upsellSlug,
  upsellQuantity,
  customer,
  origin,
  recurringPriceId,
  couponCode = '',
  discountAmount = 0,
}) {
  const oneTimeLineItems = buildOneTimeCheckoutLineItems(slug, upsellSlug, upsellQuantity);
  const plan = CATALOG[slug] && CATALOG[slug].instalment ? CATALOG[slug].instalment.plan : null;
  const discountPerPayment = plan && discountAmount > 0
    ? Math.floor(discountAmount / plan.count)
    : 0;
  const discountedRecurringAmount = plan && discountPerPayment > 0
    ? Math.max(50, Math.round(plan.recurringPayment * 100) - discountPerPayment)
    : 0;
  const metadata = {
    product_slug: slug,
    base_slug: slug,
    payment_mode: 'instalments',
    customer_email: customer.email,
    customer_name: customer.customerName,
    customer_phone: customer.phone,
  };

  if (upsellSlug) {
    metadata.upsell_slug = upsellSlug;
    if (Number(upsellQuantity) > 1) {
      metadata.upsell_quantity = String(Math.max(1, Math.floor(Number(upsellQuantity) || 1)));
    }
  }

  if (couponCode && discountAmount > 0) {
    metadata.coupon_code = couponCode;
    metadata.discount_amount = String(discountAmount);
    metadata.discount_per_instalment = String(discountPerPayment);
  }

  const lineItem = discountedRecurringAmount > 0
    ? {
        price_data: {
          currency: 'aud',
          product_data: {
            name: CATALOG[slug].title || CATALOG[slug].name || slug,
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: discountedRecurringAmount,
        },
        quantity: 1,
      }
    : {
        price: recurringPriceId,
        quantity: 1,
      };

  return {
    mode: 'subscription',
    success_url: `${origin}/checkout/success?product=${slug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/?product=${slug}`,
    customer_email: customer.email,
    line_items: [lineItem, ...oneTimeLineItems],
    metadata,
    subscription_data: {
      metadata,
    },
    allow_promotion_codes: false,
  };
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
    customer_phone: customer.phone,
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

async function handleOneOffCheckout(req, res, body) {
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
      if (Number(purchase.upsellQuantity) > 1) {
        metadata.upsell_quantity = String(purchase.upsellQuantity);
      }
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

async function handleInstalmentCheckout(req, res, body, origin) {
  const checkoutRequest = validateInstalmentRequest(body);
  if (checkoutRequest.error) {
    return res.status(400).json({ error: checkoutRequest.error });
  }

  const customer = normaliseCustomerDetails(body);
  if (customer.error) {
    return res.status(400).json({ error: customer.error });
  }

  const rl = await checkRateLimit(req, { bucket: 'payment', email: customer.email });
  if (rl.limited) {
    return res.status(429).json({ error: rl.message });
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
    let sessionPayload;

    if (checkoutRequest.paymentMode === 'afterpay') {
      const purchase = resolveCheckoutPurchase(body);
      if (purchase.error) {
        return res.status(400).json({ error: purchase.error });
      }

      const couponCode = String(body.couponCode || '').trim();
      const couponDetails = await getValidatedCouponDetails(stripe, {
        couponCode,
        productSlug: purchase.baseSlug,
        baseAmount: purchase.amount,
      });
      if (couponCode && !couponDetails.valid) {
        return res.status(400).json({ error: couponDetails.error || 'Coupon code not found or expired.' });
      }
      const discountAmount = couponDetails.valid ? couponDetails.discountAmount : 0;
      const validatedCode = couponDetails.valid ? couponDetails.code : '';
      const finalAmount = Math.max(50, purchase.amount - discountAmount);

      sessionPayload = buildAfterpaySessionPayload({
        purchase,
        customer,
        origin: sessionOrigin,
        finalAmount,
        couponCode: validatedCode && discountAmount > 0 ? validatedCode : '',
      });
    } else {
      const recurringPriceId = String(process.env[PRICE_ENV_KEYS[checkoutRequest.slug]] || '').trim();
      if (!recurringPriceId) {
        return res.status(500).json({ error: `Missing ${PRICE_ENV_KEYS[checkoutRequest.slug]} environment variable` });
      }
      const couponCode = String(body.couponCode || '').trim();
      let validatedCode = '';
      let discountAmount = 0;

      if (couponCode) {
        if (checkoutRequest.slug !== 'comprehensive' && checkoutRequest.slug !== 'mastery') {
          return res.status(400).json({ error: 'This coupon is not valid for the selected product.' });
        }

        const couponDetails = await getValidatedCouponDetails(stripe, {
          couponCode,
          productSlug: checkoutRequest.slug,
          baseAmount: AMOUNTS[checkoutRequest.slug] || 0,
        });

        if (!couponDetails.valid) {
          return res.status(400).json({ error: couponDetails.error || 'Coupon code not found or expired.' });
        }

        if (!couponDetails.discount || couponDetails.discount.type !== 'fixed' || couponDetails.discountAmount <= 0) {
          return res.status(400).json({ error: 'This coupon cannot be applied to instalment checkout.' });
        }

        validatedCode = couponDetails.code;
        discountAmount = couponDetails.discountAmount;
      }

      sessionPayload = buildInstalmentSessionPayload({
        slug: checkoutRequest.slug,
        upsellSlug: checkoutRequest.upsellSlug,
        upsellQuantity: checkoutRequest.upsellQuantity,
        customer,
        origin: sessionOrigin,
        recurringPriceId,
        couponCode: validatedCode,
        discountAmount,
      });
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error.message);
    return res.status(500).json({ error: INSTALMENT_PUBLIC_ERROR_MESSAGE });
  }
}

async function handlePublicConfig(req, res) {
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

  const publishableKey = String(process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
  if (!publishableKey) {
    return res.status(500).json({ error: 'Missing STRIPE_PUBLISHABLE_KEY environment variable' });
  }

  const amounts = {};
  for (const [key, value] of Object.entries(AMOUNTS || {})) {
    amounts[key] = value / 100;
  }

  const posthogPublicKey = String(process.env.POSTHOG_PUBLIC_KEY || '').trim();
  const posthogHost = String(process.env.POSTHOG_HOST || '').trim();
  const paypalClientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();

  return res.status(200).json({
    stripePublishableKey: publishableKey,
    amounts,
    posthogPublicKey,
    posthogHost,
    paypalClientId,
  });
}

async function handleValidateCoupon(req, res, body) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = body && typeof body === 'object' ? body : null;
  if (!payload) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const code = String(payload.code || '').trim().toUpperCase();
  const slug = String(payload.slug || '').trim();
  const paymentMode = String(payload.paymentMode || '').trim().toLowerCase();
  if (!code) {
    return res.status(200).json({ valid: false, error: 'Please enter a coupon code.' });
  }

  if (!slug) {
    return res.status(400).json({ error: 'Missing product slug.' });
  }

  if (paymentMode === 'instalments' && slug !== 'comprehensive' && slug !== 'mastery') {
    return res.status(200).json({
      valid: false,
      error: 'This coupon is not valid for the selected product.',
    });
  }

  const rl = await checkRateLimit(req, { bucket: 'coupon' });
  if (rl.limited) {
    return res.status(429).json({ error: rl.message });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Configuration error.' });
  }

  try {
    const stripe = stripeFactory(process.env.STRIPE_SECRET_KEY);
    const couponDetails = await getValidatedCouponDetails(stripe, {
      couponCode: code,
      productSlug: slug,
      baseAmount: AMOUNTS[slug] || 0,
    });

    if (!couponDetails.valid) {
      return res.status(200).json({ valid: false, error: couponDetails.error || 'Coupon code not found or expired.' });
    }

    if (paymentMode === 'instalments' && (!couponDetails.discount || couponDetails.discount.type !== 'fixed')) {
      return res.status(200).json({
        valid: false,
        error: 'This coupon cannot be applied to instalment checkout.',
      });
    }

    return res.status(200).json({
      valid: true,
      code: couponDetails.code,
      discount: couponDetails.discount,
      label: couponDetails.label,
    });
  } catch (err) {
    console.error('Coupon validation error:', err.message);
    return res.status(500).json({ error: 'Could not validate coupon. Please try again.' });
  }
}

async function createCheckoutHandler(req, res) {
  const action = String(
    (req.query && req.query.action) ||
    (req.body && typeof req.body === 'object' ? req.body.action : '') ||
    ''
  ).trim();

  if (action === 'publicConfig') {
    return handlePublicConfig(req, res);
  }

  if (action === 'validateCoupon') {
    return handleValidateCoupon(req, res, req.body);
  }

  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body && typeof req.body === 'object' ? req.body : null;

  if (!body) {
    return res.status(400).json({ error: 'Missing or invalid JSON body' });
  }

  const mode = String(body.mode || '').trim().toLowerCase();
  const paymentMode = String(body.paymentMode || '').trim().toLowerCase();
  const isInstalment = mode === 'instalment'
    || (!mode && (paymentMode === 'instalments' || paymentMode === 'afterpay'));

  if (isInstalment) {
    return handleInstalmentCheckout(req, res, body, origin);
  }

  return handleOneOffCheckout(req, res, body);
}

createCheckoutHandler.AMOUNTS = AMOUNTS;
createCheckoutHandler.UNAVAILABLE_PRODUCTS = UNAVAILABLE_PRODUCTS;
createCheckoutHandler.ALLOWED_UPSELLS = ALLOWED_UPSELLS;
createCheckoutHandler.HIGH_TICKET_PRODUCT_SLUGS = HIGH_TICKET_PRODUCT_SLUGS;
createCheckoutHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
createCheckoutHandler.isAllowedOrigin = isAllowedOrigin;
createCheckoutHandler.isValidEmail = isValidEmail;
createCheckoutHandler.normaliseCustomerDetails = normaliseCustomerDetails;
createCheckoutHandler.buildEssayUploadToken = buildEssayUploadToken;
createCheckoutHandler.buildEssayUploadUrl = buildEssayUploadUrl;
createCheckoutHandler.isAllowedUpsellCombination = isAllowedUpsellCombination;
createCheckoutHandler.isCouponEligibleForProduct = isCouponEligibleForProduct;
createCheckoutHandler.getCouponAllowedProductSlugs = getCouponAllowedProductSlugs;
createCheckoutHandler.formatCouponLabel = formatCouponLabel;
createCheckoutHandler.getValidatedCouponDetails = getValidatedCouponDetails;
createCheckoutHandler.normaliseUpsellSlug = normaliseUpsellSlug;
createCheckoutHandler.getUpsellAmount = getUpsellAmount;
createCheckoutHandler.resolveCheckoutPurchase = resolveCheckoutPurchase;
createCheckoutHandler.buildPaymentIntentIdempotencyKey = buildPaymentIntentIdempotencyKey;

// Instalment-specific exports (preserved from create-instalment-session.js).
createCheckoutHandler.ELIGIBLE_INSTALMENT_PRODUCTS = ELIGIBLE_INSTALMENT_PRODUCTS;
createCheckoutHandler.ELIGIBLE_AFTERPAY_PRODUCTS = ELIGIBLE_AFTERPAY_PRODUCTS;
createCheckoutHandler.PRICE_ENV_KEYS = PRICE_ENV_KEYS;
createCheckoutHandler.INSTALMENT_PUBLIC_ERROR_MESSAGE = INSTALMENT_PUBLIC_ERROR_MESSAGE;
createCheckoutHandler.validateInstalmentRequest = validateInstalmentRequest;
createCheckoutHandler.getSessionOrigin = getSessionOrigin;
createCheckoutHandler.buildInstalmentSessionPayload = buildInstalmentSessionPayload;
createCheckoutHandler.buildAfterpaySessionPayload = buildAfterpaySessionPayload;

createCheckoutHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
createCheckoutHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = createCheckoutHandler;
