const Stripe = require('stripe');
const createPaymentIntentHandler = require('./create-payment-intent.js');

const ELIGIBLE_INSTALMENT_PRODUCTS = new Set(['comprehensive', 'mastery']);
const PRICE_ENV_KEYS = {
  comprehensive: 'STRIPE_PRICE_COMPREHENSIVE_INSTALMENT',
  mastery: 'STRIPE_PRICE_MASTERY_INSTALMENT',
};
const PUBLIC_ERROR_MESSAGE = 'Instalment checkout setup failed. Please try again.';
let stripeFactory = (secretKey) => Stripe(secretKey);

function validateInstalmentRequest(body) {
  const slug = String(body && body.slug ? body.slug : '').trim();
  const paymentMode = String(body && body.paymentMode ? body.paymentMode : '').trim();
  const upsellSlug = createPaymentIntentHandler.normaliseUpsellSlug(body || {});

  if (paymentMode !== 'instalments') {
    return { error: 'Invalid payment mode.' };
  }

  if (!ELIGIBLE_INSTALMENT_PRODUCTS.has(slug)) {
    return { error: 'Instalments are not available for this product.' };
  }

  if (upsellSlug) {
    if (!createPaymentIntentHandler.isAllowedUpsellCombination(slug, upsellSlug)) {
      return { error: `Invalid upsell combination: ${slug} + ${upsellSlug}` };
    }
  }

  return { slug, paymentMode, upsellSlug };
}

function getSessionOrigin(bodyOrigin, requestOrigin) {
  const candidateOrigin = String(bodyOrigin || requestOrigin || '').trim();

  if (!candidateOrigin || !createPaymentIntentHandler.isAllowedOrigin(candidateOrigin)) {
    return '';
  }

  return candidateOrigin;
}

function buildAddInvoiceItems(slug, upsellSlug) {
  if (slug !== 'comprehensive' || upsellSlug !== 'mentoring-single') {
    return undefined;
  }

  return [
    {
      price_data: {
        currency: 'aud',
        product_data: {
          name: 'Add one 1:1 strategy class',
        },
        unit_amount: 9900,
      },
      quantity: 1,
    },
  ];
}

function buildInstalmentSessionPayload({ slug, upsellSlug, customer, origin, recurringPriceId }) {
  const addInvoiceItems = buildAddInvoiceItems(slug, upsellSlug);
  const metadata = {
    product_slug: slug,
    base_slug: slug,
    payment_mode: 'instalments',
    customer_email: customer.email,
    customer_name: customer.customerName,
  };

  if (upsellSlug) {
    metadata.upsell_slug = upsellSlug;
  }

  return {
    mode: 'subscription',
    success_url: `${origin}/checkout/success?product=${slug}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/?product=${slug}`,
    customer_email: customer.email,
    line_items: [
      {
        price: recurringPriceId,
        quantity: 1,
      },
    ],
    metadata,
    subscription_data: {
      metadata,
      ...(addInvoiceItems ? { add_invoice_items: addInvoiceItems } : {}),
    },
  };
}

async function createInstalmentSessionHandler(req, res) {
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

  const instalmentRequest = validateInstalmentRequest(body);
  if (instalmentRequest.error) {
    return res.status(400).json({ error: instalmentRequest.error });
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

  const recurringPriceId = String(process.env[PRICE_ENV_KEYS[instalmentRequest.slug]] || '').trim();
  if (!recurringPriceId) {
    return res.status(500).json({ error: `Missing ${PRICE_ENV_KEYS[instalmentRequest.slug]} environment variable` });
  }

  try {
    const stripe = stripeFactory(secretKey);
    const session = await stripe.checkout.sessions.create(
      buildInstalmentSessionPayload({
        slug: instalmentRequest.slug,
        upsellSlug: instalmentRequest.upsellSlug,
        customer,
        origin: sessionOrigin,
        recurringPriceId,
      })
    );

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error.message);
    return res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

createInstalmentSessionHandler.ELIGIBLE_INSTALMENT_PRODUCTS = ELIGIBLE_INSTALMENT_PRODUCTS;
createInstalmentSessionHandler.PRICE_ENV_KEYS = PRICE_ENV_KEYS;
createInstalmentSessionHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
createInstalmentSessionHandler.validateInstalmentRequest = validateInstalmentRequest;
createInstalmentSessionHandler.getSessionOrigin = getSessionOrigin;
createInstalmentSessionHandler.buildInstalmentSessionPayload = buildInstalmentSessionPayload;
createInstalmentSessionHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
createInstalmentSessionHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = createInstalmentSessionHandler;
