const Stripe = require('stripe');
const fulfillPaymentIntent = require('./_lib/_fulfill-payment-intent.js');
const createCheckoutHandler = require('./create-checkout.js');
const paymentIntentStatusHandler = require('./payment-status.js');
const { shareProductAccess } = require('./_lib/_google-drive.js');
const {
  buildAuthUrl,
  driveHealth,
  exchangeCodeForTokens,
  getRedirectUri,
  isAuthorized: isDriveAdminAuthorized,
  verifyState,
} = require('./_lib/_drive-oauth.js');

let stripeFactory = (secretKey) => Stripe(secretKey);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

function sendHtml(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(body);
}

function getRetryToken() {
  return String(process.env.FULFILLMENT_RETRY_TOKEN || '').trim();
}

function getRequestToken(req) {
  return String(
    req.headers['x-fulfillment-retry-token'] ||
    req.body?.token ||
    ''
  ).trim();
}

async function handleRetryFulfillment(req, res) {
  const origin = req.headers.origin || '';

  if (!createCheckoutHandler.isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = getRetryToken();
  if (!expectedToken || getRequestToken(req) !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const paymentIntentId = String(req.body?.payment_intent || req.body?.paymentIntentId || '').trim();
  if (!paymentIntentStatusHandler.isValidPaymentIntentId(paymentIntentId)) {
    return res.status(400).json({ error: 'Invalid payment intent.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY environment variable' });
  }

  try {
    const stripeClient = stripeFactory(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    // Subscription PIs have no slug metadata — resolve it from the subscription before fulfilling.
    if (paymentIntent.invoice) {
      const piMeta = paymentIntent.metadata || {};
      if (!piMeta.base_slug && !piMeta.product_slug) {
        try {
          const invoice = await stripeClient.invoices.retrieve(paymentIntent.invoice, {
            expand: ['subscription'],
          });
          const subMeta = (invoice.subscription && typeof invoice.subscription === 'object')
            ? invoice.subscription.metadata || {}
            : {};
          const resolvedSlug = subMeta.base_slug || subMeta.product_slug;
          if (resolvedSlug) {
            const patch = { base_slug: resolvedSlug };
            if (subMeta.customer_email) patch.customer_email = subMeta.customer_email;
            if (subMeta.customer_name) patch.customer_name = subMeta.customer_name;
            await stripeClient.paymentIntents.update(paymentIntentId, { metadata: patch });
            console.log(`[admin:retry-fulfillment] Patched PI ${paymentIntentId} with slug '${resolvedSlug}' from subscription`);
          }
        } catch (subErr) {
          console.error('[admin:retry-fulfillment] Could not resolve subscription slug:', subErr.message);
        }
      }
    }

    const result = await fulfillPaymentIntent({
      paymentIntent,
      stripeClient,
      forceAutomation: true,
    });

    return res.status(200).json({
      ok: true,
      alreadyFulfilled: Boolean(result.alreadyFulfilled),
      productSlug: result.plan?.productSlug || '',
    });
  } catch (error) {
    console.error('[admin:retry-fulfillment] Retry failed:', error.message);
    return res.status(500).json({ error: 'Fulfillment retry failed.' });
  }
}

function handleStripeHealth(req, res) {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    return res.status(500).json({
      ok: false,
      stripeConfigured: false,
      error: 'STRIPE_SECRET_KEY is missing',
    });
  }

  return res.status(200).json({
    ok: true,
    stripeConfigured: true,
    service: 'rohanstutoring-site',
  });
}

async function handleDriveOAuthStart(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!isDriveAdminAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mode = String(req.query?.mode || 'health').trim();

  if (req.method === 'GET' && mode === 'connect') {
    try {
      return res.status(200).json({
        authUrl: buildAuthUrl(req),
        redirectUri: getRedirectUri(req),
        instructions: [
          'Add redirectUri to the Google OAuth client if it is not already allowed.',
          'Open authUrl while signed into the Google account that owns or can share the Blueprint folder.',
          'After Google redirects back, copy the returned refresh token into GOOGLE_REFRESH_TOKEN in Vercel Production and Preview.',
        ],
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'GET' && mode === 'health') {
    try {
      const result = await driveHealth();
      return res.status(result.ok ? 200 : 500).json(result);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err.message,
        expectedScope: 'https://www.googleapis.com/auth/drive',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleDriveOAuthCallback(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const error = String(req.query?.error || '').trim();
  if (error) {
    return sendText(res, 400, `Google OAuth error: ${error}`);
  }

  const state = String(req.query?.state || '').trim();
  if (!verifyState(state)) {
    return sendText(res, 401, 'Invalid or expired OAuth state. Start again from /api/admin?action=driveOAuthStart&mode=connect.');
  }

  const code = String(req.query?.code || '').trim();
  if (!code) {
    return sendText(res, 400, 'Missing authorization code.');
  }

  try {
    const tokens = await exchangeCodeForTokens(req, code);
    if (!tokens.refresh_token) {
      return sendHtml(res, 400,
        '<pre>Google did not return a refresh_token.\n\n' +
        'Revoke the app at https://myaccount.google.com/permissions, then start the Drive OAuth flow again.</pre>'
      );
    }

    return sendHtml(res, 200,
      '<!doctype html><meta charset="utf-8">' +
      '<title>Google Drive token generated</title>' +
      '<body style="font-family:ui-sans-serif,system-ui;padding:32px;line-height:1.5;max-width:900px">' +
      '<h1>Google Drive token generated</h1>' +
      '<p>Update <code>GOOGLE_REFRESH_TOKEN</code> in Vercel Production and Preview with this value, then redeploy.</p>' +
      `<textarea readonly style="width:100%;min-height:140px;font-family:ui-monospace,monospace">${escapeHtml(tokens.refresh_token)}</textarea>` +
      '<p>After updating Vercel, check <code>/api/admin?action=driveOAuthStart&mode=health</code> with the fulfillment retry token.</p>' +
      '</body>'
    );
  } catch (err) {
    return sendText(res, 500, `Token exchange failed: ${err.message}`);
  }
}

async function handleTestDriveShare(req, res) {
  const token = String(
    req.headers['x-test-token'] ||
    req.headers['x-fulfillment-retry-token'] ||
    req.query?.token ||
    req.body?.token ||
    ''
  ).trim();

  const expectedToken = String(process.env.FULFILLMENT_RETRY_TOKEN || '').trim();
  if (!expectedToken || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = String(req.body?.email || req.query?.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Missing email param' });
  }

  try {
    const result = await shareProductAccess({ baseSlug: 'blueprint', email });
    return res.status(200).json({ ok: !result.skipped, ...result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function adminHandler(req, res) {
  const action = String(
    (req.body && typeof req.body === 'object' ? req.body.action : '') ||
    (req.query ? req.query.action : '') ||
    ''
  ).trim();

  if (action === 'retryFulfillment') {
    return handleRetryFulfillment(req, res);
  }

  if (action === 'driveOAuthStart') {
    return handleDriveOAuthStart(req, res);
  }

  if (action === 'driveOAuthCallback') {
    return handleDriveOAuthCallback(req, res);
  }

  if (action === 'testDriveShare') {
    return handleTestDriveShare(req, res);
  }

  if (action === 'stripeHealth' || (!action && req.method === 'GET')) {
    return handleStripeHealth(req, res);
  }

  return res.status(400).json({ ok: false, error: 'Unknown admin action' });
}

adminHandler.__setStripeFactory = (value) => {
  stripeFactory = value;
};

adminHandler.__resetForTests = () => {
  stripeFactory = (secretKey) => Stripe(secretKey);
};

module.exports = adminHandler;
