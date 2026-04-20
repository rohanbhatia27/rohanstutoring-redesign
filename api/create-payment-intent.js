const Stripe = require('stripe');

// Amounts in cents (AUD). Private mentoring uses separate slugs per package.
const AMOUNTS = {
  blueprint: 59900,
  advanced: 29900,
  'essay-collection': 7900,
  'starter-pack': 9700,
  'essay-marking': 3499,
  'essay-pack-10': 24900,
  comprehensive: 154900,
  mastery: 224900,
  's1-rescue-sprint': 34700,
  's2-rescue-sprint': 19900,
  'mentoring-single': 11900,
  'mentoring-pack': 107000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PUBLIC_ERROR_MESSAGE = 'Payment setup failed. Please try again.';

function isAllowedOrigin(origin) {
  if (!origin) return true;

  return (
    origin === 'https://rohanstutoring.com' ||
    origin === 'https://www.rohanstutoring.com' ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/(127\.0\.0\.1|localhost):\d+$/i.test(origin)
  );
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

function normaliseCustomerDetails(body) {
  const email = String(body.email || '').trim();
  const customerName = String(body.customerName || '').trim().replace(/\s+/g, ' ');

  if (!isValidEmail(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  if (!customerName) {
    return { error: 'Missing customer name.' };
  }

  return {
    email,
    customerName: customerName.slice(0, 120),
  };
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

  const { slug } = body;
  const amount = AMOUNTS[slug];

  if (!amount) return res.status(400).json({ error: 'Invalid product slug: ' + slug });

  const customer = normaliseCustomerDetails(body);
  if (customer.error) {
    return res.status(400).json({ error: customer.error });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      receipt_email: customer.email,
      description: `Rohan's GAMSAT - ${slug}`,
      metadata: {
        product_slug: slug,
        customer_email: customer.email,
        customer_name: customer.customerName,
      },
    });
    res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: PUBLIC_ERROR_MESSAGE });
  }
}

createPaymentIntentHandler.AMOUNTS = AMOUNTS;
createPaymentIntentHandler.PUBLIC_ERROR_MESSAGE = PUBLIC_ERROR_MESSAGE;
createPaymentIntentHandler.isAllowedOrigin = isAllowedOrigin;
createPaymentIntentHandler.isValidEmail = isValidEmail;
createPaymentIntentHandler.normaliseCustomerDetails = normaliseCustomerDetails;

module.exports = createPaymentIntentHandler;
