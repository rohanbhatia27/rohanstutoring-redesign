const { PAYPAL_API, getPayPalAccessToken } = require('./_lib/_paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');
const {
  isValidPayPalOrderId,
  validateCompletedPayPalOrder,
} = require('./_lib/_paypal-order-validation.js');

const { isAllowedOrigin, resolveCheckoutPurchase } = createPaymentIntentHandler;

async function paypalOrderStatusHandler(req, res) {
  const origin = req.headers.origin || '';

  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query || {};
  const orderID = String(query.paypal_order || '').trim();
  if (!isValidPayPalOrderId(orderID)) {
    return res.status(400).json({ error: 'Invalid PayPal order ID.' });
  }

  const productSlug = String(query.package || query.product || '').trim();
  const upsellSlug = String(query.upsell || '').trim();
  const purchase = resolveCheckoutPurchase({
    slug: productSlug,
    upsellSlug,
  });

  if (purchase.error) {
    return res.status(400).json({ error: purchase.error });
  }

  try {
    const accessToken = await getPayPalAccessToken();
    const orderResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderID)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}));
      console.error('PayPal order status failed:', errorData);
      return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
    }

    const orderData = await orderResponse.json();
    const validation = validateCompletedPayPalOrder(orderData, purchase, orderID);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    return res.status(200).json({
      status: 'succeeded',
      orderID: validation.orderID,
      metadata: {
        base_slug: purchase.baseSlug,
        upsell_slug: purchase.upsellSlug || '',
      },
    });
  } catch (err) {
    console.error('PayPal order status error:', err.message);
    return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
  }
}

paypalOrderStatusHandler.isAllowedOrigin = isAllowedOrigin;

module.exports = paypalOrderStatusHandler;
