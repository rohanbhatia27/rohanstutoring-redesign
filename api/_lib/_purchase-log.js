/**
 * Lightweight Supabase purchase event logger.
 *
 * Logs safe lifecycle events (intent created, fulfilled, email, kit, drive).
 * Never logs secrets, raw webhook bodies, card data, or API tokens.
 * No-ops silently when SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are absent.
 * Never throws — checkout must never fail because of a logging error.
 */

let fetchImpl = (...args) => fetch(...args);

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Shape a caller-supplied payload into the exact columns that exist in
 * purchase_events. Unknown keys on the caller's object are dropped here,
 * which is how we guarantee no secret ever leaks into the DB row.
 */
function sanitisePayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  return {
    event_type:     String(p.eventType    || '').slice(0, 100),
    provider:       String(p.provider     || '').slice(0, 50)  || null,
    payment_id:     String(p.paymentId    || '').slice(0, 200) || null,
    product_slug:   String(p.productSlug  || '').slice(0, 100) || null,
    upsell_slug:    String(p.upsellSlug   || '').slice(0, 100) || null,
    customer_email: String(p.customerEmail|| '').slice(0, 320) || null,
    customer_name:  String(p.customerName || '').slice(0, 120) || null,
    amount_cents:   typeof p.amountCents === 'number' ? Math.round(p.amountCents) : null,
    currency:       String(p.currency     || '').slice(0, 10)  || null,
    outcome:        String(p.outcome      || '').slice(0, 50)  || null,
    error_message:  String(p.errorMessage || '').slice(0, 500) || null,
    meta:           (p.meta && typeof p.meta === 'object') ? p.meta : null,
  };
}

async function logPurchaseEvent(payload) {
  const config = getSupabaseConfig();
  if (!config) return;

  const row = sanitisePayload(payload);

  try {
    const res = await fetchImpl(
      `${config.url}/rest/v1/purchase_events`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${config.key}`,
          'apikey':        config.key,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify(row),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[purchase-log] Insert failed (${res.status}):`, text.slice(0, 200));
    }
  } catch (err) {
    console.warn('[purchase-log] Logging error (non-fatal):', err.message);
  }
}

logPurchaseEvent.sanitisePayload = sanitisePayload;
logPurchaseEvent.__setFetchImpl = (fn) => { fetchImpl = fn; };
logPurchaseEvent.__resetForTests = () => { fetchImpl = (...args) => fetch(...args); };

module.exports = logPurchaseEvent;
