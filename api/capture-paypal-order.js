const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');
const createPaymentIntentHandler = require('./create-payment-intent.js');

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

  const baseSlug = String(body.slug || '').trim();
  const upsellSlug = String(body.upsellSlug || '').trim();
  const customerName = String(body.customerName || '').trim();
  const email = String(body.email || '').trim();

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

    if (captureData.status !== 'COMPLETED') {
      console.error('PayPal capture not completed:', captureData.status);
      return res.status(400).json({ error: 'Payment was not completed.' });
    }

    const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedAmount = captureUnit?.amount?.value;
    const capturedCurrency = captureUnit?.amount?.currency_code;

    console.log('PayPal order captured:', {
      orderID: captureData.id,
      status: captureData.status,
      amount: capturedAmount,
      currency: capturedCurrency,
      baseSlug,
      upsellSlug: upsellSlug || null,
      customerName,
      email,
      fulfillmentRequired: true,
    });

    return res.status(200).json({
      status: 'succeeded',
      orderID: captureData.id,
    });
  } catch (err) {
    console.error('PayPal capture error:', err.message);
    return res.status(500).json({ error: 'Payment capture failed. Please try again.' });
  }
}

module.exports = capturePayPalOrderHandler;
