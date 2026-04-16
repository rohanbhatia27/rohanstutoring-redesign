const Stripe = require('stripe');

// Amounts in cents (AUD). Private mentoring uses separate slugs per package.
const AMOUNTS = {
  blueprint: 59900,
  advanced: 29900,
  'essay-collection': 7900,
  'starter-pack': 9700,
  'essay-marking': 3499,
  comprehensive: 154900,
  mastery: 224900,
  's1-rescue-sprint': 34700,
  's2-rescue-sprint': 19900,
  'mentoring-single': 11900,
  'mentoring-pack': 107000,
};

module.exports = async (req, res) => {
  // Allow CORS for local dev; Vercel dev can run on a different port from static preview.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { slug } = req.body;
  const amount = AMOUNTS[slug];

  if (!amount) return res.status(400).json({ error: 'Invalid product slug: ' + slug });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'aud',
      metadata: { product_slug: slug },
    });
    res.status(200).json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
