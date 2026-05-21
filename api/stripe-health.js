async function stripeHealthHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

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

module.exports = stripeHealthHandler;
