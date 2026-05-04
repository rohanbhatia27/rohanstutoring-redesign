const { PAYPAL_API, getPayPalAccessToken } = require('./lib/paypal.js');

function getHeader(headers, name) {
  const lowerName = String(name).toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === lowerName);
  return entry ? String(entry[1] || '') : '';
}

async function verifyPayPalWebhook(req, eventBody) {
  const webhookId = String(process.env.PAYPAL_WEBHOOK_ID || '').trim();
  if (!webhookId) {
    return { error: 'PayPal webhook is not configured.' };
  }

  const accessToken = await getPayPalAccessToken();
  const verificationResponse = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: getHeader(req.headers, 'paypal-auth-algo'),
      cert_url: getHeader(req.headers, 'paypal-cert-url'),
      transmission_id: getHeader(req.headers, 'paypal-transmission-id'),
      transmission_sig: getHeader(req.headers, 'paypal-transmission-sig'),
      transmission_time: getHeader(req.headers, 'paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: eventBody,
    }),
  });

  if (!verificationResponse.ok) {
    return { error: 'PayPal webhook verification failed.' };
  }

  const verification = await verificationResponse.json();
  if (verification.verification_status !== 'SUCCESS') {
    return { error: 'PayPal webhook signature was not verified.' };
  }

  return { ok: true };
}

async function paypalWebhookHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const eventBody = req.body && typeof req.body === 'object' ? req.body : null;
  if (!eventBody) {
    return res.status(400).json({ error: 'Missing or invalid JSON body' });
  }

  try {
    const verification = await verifyPayPalWebhook(req, eventBody);
    if (verification.error) {
      const statusCode = verification.error === 'PayPal webhook is not configured.' ? 500 : 400;
      return res.status(statusCode).json({ error: verification.error });
    }

    if (eventBody.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = eventBody.resource || {};
      const relatedIds = resource.supplementary_data?.related_ids || {};
      console.log('PayPal capture completed webhook:', {
        eventId: eventBody.id,
        captureId: resource.id,
        orderID: relatedIds.order_id || null,
        amount: resource.amount?.value || null,
        currency: resource.amount?.currency_code || null,
        fulfillmentRequired: true,
      });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayPal webhook error:', err.message);
    return res.status(500).json({ error: 'PayPal webhook processing failed.' });
  }
}

paypalWebhookHandler.verifyPayPalWebhook = verifyPayPalWebhook;

module.exports = paypalWebhookHandler;
