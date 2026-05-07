const PAYPAL_API = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com';

async function getPayPalAccessToken() {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('PayPal token error:', text);
    throw new Error('Failed to authenticate with PayPal.');
  }

  const data = await response.json();
  return data.access_token;
}

module.exports = { PAYPAL_API, getPayPalAccessToken };
