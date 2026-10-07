'use strict';

const { timingSafeEqual } = require('node:crypto');
const { syncKitForResource } = require('./_lib/_free-resource.js');
const store = require('./_lib/_resource-sync-store.js');
const reconcileGamePlan = require('./_lib/_game-plan-reconcile.js');
const sendResourceSyncAlert = require('./_lib/_resource-sync-alert.js');

function authorized(req) {
  const secret = String(process.env.CRON_SECRET || '');
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer /, '');
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function resourceSyncHandler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Temporary preview-only check; removed after validating the existing table.
  if (req.query?.check === 'ledger') {
    try {
      await store.hasCompletedReconciliation();
      return res.status(200).json({ ledgerAvailable: true });
    } catch (error) {
      const status = error.message.match(/\((\d{3})\)/)?.[1] || null;
      return res.status(503).json({ ledgerAvailable: false, reason: status || (error.message.includes('Missing SUPABASE') ? 'missing_config' : 'request_failed') });
    }
  }
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  let retried = 0;
  let recovered = 0;
  let failed = 0;
  try {
    const rows = await store.listRetryable();
    for (const row of rows) {
      retried += 1;
      const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      const steps = Array.isArray(meta.failed_steps) && meta.failed_steps.length ? meta.failed_steps : undefined;
      const result = await syncKitForResource({
        resourceKey: row.product_slug,
        email: row.customer_email,
        firstName: row.customer_name || '',
      }, { steps, preserveInactive: true });
      const failedSteps = result.failedSteps || [];
      await store.updateLead(row.id, {
        outcome: result.synced ? 'synced' : result.permanent ? 'sync_skipped' : 'sync_failed',
        errorMessage: result.synced ? null : `Kit steps failed: ${failedSteps.join(', ') || result.reason}`,
        meta: { ...meta, failed_steps: failedSteps, retry_attempts: (Number(meta.retry_attempts) || 0) + 1 },
      });
      if (result.synced) recovered += 1;
      else if (!result.permanent) failed += 1;
    }

    let reconciliation = null;
    if (!await store.hasCompletedReconciliation()) {
      reconciliation = await reconcileGamePlan();
      await store.markReconciliationComplete(reconciliation);
      await sendResourceSyncAlert({
        kind: 'Game Plan reconciliation complete',
        detail: `Resend recipients: ${reconciliation.sentCount}; missing Kit tag: ${reconciliation.missingCount}; tagged: ${reconciliation.taggedCount}; inactive skipped: ${reconciliation.inactiveCount}.`,
      });
    }

    if (failed > 0) {
      await sendResourceSyncAlert({ kind: 'Kit retries still failing', detail: `${failed} of ${retried} retryable leads remain unsynced.` });
    }
    console.log(`[resource-sync] retried=${retried} recovered=${recovered} failed=${failed} reconciled=${Boolean(reconciliation)}`);
    return res.status(200).json({ ok: true, retried, recovered, failed, reconciliation });
  } catch (error) {
    console.error('[resource-sync] Cron failed:', error.message);
    await sendResourceSyncAlert({ kind: 'Resource sync job failed', detail: error.message });
    return res.status(500).json({ ok: false, retried, recovered, failed, error: 'Resource sync job failed' });
  }
}

module.exports = resourceSyncHandler;
