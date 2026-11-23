const supabaseHeaders = require('./_supabase-headers.js');
let fetchImpl = (...args) => fetch(...args);
function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new Error('PayPal order storage is not configured');
  return { url, key };
}
async function request(path, options = {}) {
  const { url, key } = config();
  const response = await fetchImpl(`${url}/rest/v1/paypal_orders${path}`, { ...options, headers: { ...supabaseHeaders(key), 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) throw new Error(`PayPal order storage request failed (${response.status})`);
  return response;
}
async function save({ orderID, customer, purchase, currency }) {
  await request('', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ order_id: orderID, customer_email: customer.email, customer_name: customer.customerName, purchase, amount_cents: purchase.amount, currency }) });
}
async function load(orderID) {
  const response = await request(`?order_id=eq.${encodeURIComponent(orderID)}&select=*`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('PayPal order has no saved checkout recipient; manual review required');
  const row = rows[0];
  return { customer: { email: row.customer_email, customerName: row.customer_name || '' }, purchase: row.purchase, amountCents: row.amount_cents, currency: row.currency };
}
async function savePayer(orderID, payerEmail) {
  if (!payerEmail) return;
  await request(`?order_id=eq.${encodeURIComponent(orderID)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payer_email: payerEmail }) });
}
module.exports = { save, load, savePayer, __setFetch: fn => { fetchImpl = fn; }, __resetForTests: () => { fetchImpl = (...args) => fetch(...args); } };
