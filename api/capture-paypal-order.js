const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  isValidPayPalOrderId,
  resolvePayPalPurchaseFromBody,
  validateCompletedPayPalOrder,
} = require('./lib/paypal-order-validation.js');

const { isAllowedOrigin } = createPaymentIntentHandler;

async function capturePayPalOrderHandler(req, res) {
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

  const orderID = String(body.orderID || '').trim();
  if (!orderID) {
    return res.status(400).json({ error: 'Missing PayPal order ID.' });
  }

  if (!isValidPayPalOrderId(orderID)) {
    return res.status(400).json({ error: 'Invalid PayPal order ID.' });
  }

  const resolved = resolvePayPalPurchaseFromBody(body);
  if (resolved.error) {
    return res.status(400).json({ error: resolved.error });
  }

  const { purchase, customer } = resolved;

  try {
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json().catch(() => ({}));
      console.error('PayPal capture failed:', errorData);
      return res.status(500).json({ error: 'Payment capture failed. Please try again.' });
    }

    const captureData = await captureResponse.json();

    const validation = validateCompletedPayPalOrder(captureData, purchase, orderID);
    if (validation.error) {
      console.error('PayPal capture validation failed:', validation.error);
      return res.status(400).json({ error: validation.error });
    }

    console.log('PayPal order captured:', {
      orderID: validation.orderID,
      status: 'COMPLETED',
      amount: validation.amount,
      currency: validation.currency,
      baseSlug: purchase.baseSlug,
      upsellSlug: purchase.upsellSlug || null,
      customerName: customer.customerName,
      email: customer.email,
      fulfillmentRequired: true,
    });

    return res.status(200).json({
      status: 'succeeded',
      orderID: validation.orderID,
      metadata: {
        base_slug: purchase.baseSlug,
        upsell_slug: purchase.upsellSlug || '',
      },
    });
  } catch (err) {
    console.error('PayPal capture error:', err.message);
    return res.status(500).json({ error: 'Payment capture failed. Please try again.' });
  }
}

module.exports = capturePayPalOrderHandler;
