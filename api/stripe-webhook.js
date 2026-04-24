const Stripe = require('stripe');
const fulfillPaymentIntent = require('./lib/fulfill-payment-intent.js');

let stripeFactory = (secretKey) => Stripe(secretKey);
let fulfillPaymentIntentImpl = fulfillPaymentIntent;

function getStripeClient() {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable');
  }

  return stripeFactory(secretKey);
}

function getWebhookSecret() {
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
  }

  return webhookSecret;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }

  if (typeof req.rawBody === 'string') {
    return Buffer.from(req.rawBody, 'utf8');
  }

  if (req && typeof req.on === 'function') {
    const chunks = [];

    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return Buffer.from(req.body, 'utf8');
  }

  throw new Error('Raw Stripe webhook body unavailable.');
}

async function stripeWebhookHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = String(req.headers['stripe-signature'] || '').trim();
  if (!signature) {
    return res.status(400).json({ error: 'Missing Stripe signature.' });
  }

  let stripeClient;
  let event;

  try {
    stripeClient = getStripeClient();
    const rawBody = await readRawBody(req);
    event = stripeClient.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (error) {
    console.error('Stripe webhook verification failed:', error.message);
    return res.status(400).json({ error: 'Invalid Stripe webhook.' });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      await fulfillPaymentIntentImpl({
        paymentIntent: event.data.object,
        stripeClient,
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook fulfillment failed:', error.message);
    return res.status(500).json({ error: 'Webhook fulfillment failed.' });
  }
}

stripeWebhookHandler.readRawBody = readRawBody;
stripeWebhookHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};
stripeWebhookHandler.__setFulfillPaymentIntent = (value) => {
  fulfillPaymentIntentImpl = value;
};
stripeWebhookHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
  fulfillPaymentIntentImpl = fulfillPaymentIntent;
};

module.exports = stripeWebhookHandler;
