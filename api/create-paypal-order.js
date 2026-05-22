const { PAYPAL_API, getPayPalAccessToken } = require('./_lib/_paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  PAYPAL_CURRENCY,
  formatPayPalAmount,
  getPayPalPurchaseCustomId,
} = require('./_lib/_paypal-order-validation.js');
const { checkRateLimit } = require('./_lib/_rate-limit.js');

const { isAllowedOrigin, resolveCheckoutPurchase, normaliseCustomerDetails } = createPaymentIntentHandler;

async function createPayPalOrderHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  const amountValue = formatPayPalAmount(purchase.amount);
  const customId = getPayPalPurchaseCustomId(purchase);
  const description = purchase.upsellSlug
    ? `Rohan's GAMSAT - ${purchase.baseSlug} + ${purchase.upsellSlug}`
    : `Rohan's GAMSAT - ${purchase.baseSlug}`;

  try {
    const accessToken = await getPayPalAccessToken();

    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: PAYPAL_CURRENCY,
              value: amountValue,
            },
            custom_id: customId,
            description,
          },
        ],
        payer: {
          name: {
            given_name: customer.customerName.split(' ')[0] || '',
            surname: customer.customerName.split(' ').slice(1).join(' ') || '',
          },
          email_address: customer.email,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));
      console.error('PayPal order creation failed:', errorData);
      return res.status(500).json({ error: 'Payment setup failed. Please try again.' });
    }

    const order = await orderResponse.json();
    return res.status(200).json({ orderID: order.id });
  } catch (err) {
    console.error('PayPal create-order error:', err.message);
    return res.status(500).json({ error: 'Payment setup failed. Please try again.' });
  }
}

module.exports = createPayPalOrderHandler;
