const store = require('./_lib/_resource-sync-store.js');

module.exports = async function resourceLedgerHealth(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    await store.hasCompletedReconciliation();
    return res.status(200).json({ ok: true, ledgerAvailable: true });
  } catch (error) {
    console.error('[resource-ledger-health] check failed:', error.message);
    return res.status(503).json({ ok: false, ledgerAvailable: false });
  }
};
