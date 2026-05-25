const { shareProductAccess } = require('./_lib/_google-drive.js');

async function handler(req, res) {
  const token = String(req.headers['x-test-token'] || '').trim();
  if (!token || token !== String(process.env.FULFILLMENT_RETRY_TOKEN || '').trim()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const email = (req.body?.email || req.query?.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Missing email param' });
  }

  try {
    const result = await shareProductAccess({ baseSlug: 'blueprint', email });
    return res.status(200).json({ ok: !result.skipped, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
