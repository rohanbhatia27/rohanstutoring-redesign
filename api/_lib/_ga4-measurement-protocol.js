'use strict';

const { CATALOG, getUpsellPriceCents } = require('./catalog.server.js');

const DEFAULT_MEASUREMENT_ID = 'G-H1KDZ561ZE';

let fetchImpl = (...args) => fetch(...args);

function getConfig() {
  const measurementId = String(process.env.GA4_MEASUREMENT_ID || DEFAULT_MEASUREMENT_ID).trim();
  const apiSecret = String(
    process.env.GA4_MEASUREMENT_PROTOCOL_SECRET
    || process.env.GA4_API_SECRET
    || ''
  ).trim();

  if (!measurementId || !apiSecret) return null;
  return { measurementId, apiSecret };
}

function getMetadataValue(metadata, ...keys) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  for (const key of keys) {
    const value = String(source[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function centsToDollars(value) {
  const cents = Number(value);
  return Number.isFinite(cents) ? Math.round(cents) / 100 : undefined;
}

function getItemCategory(slug) {
  const entry = CATALOG[slug];
  if (!entry) return 'Product';
  if (entry.successType === 'cohort' || /course|mastery|sprint/i.test(entry.title || entry.name || slug)) return 'Course';
  if (entry.successType === 'mentoring' || /mentoring|session|class/i.test(entry.title || entry.name || slug)) return 'Service';
  if (entry.successType === 'essay-marking') return 'Service';
  return 'Digital Product';
}

function getItemForSlug(slug, context = {}) {
  const entry = CATALOG[slug];
  const baseSlug = String(context.baseSlug || '').trim();
  const baseEntry = baseSlug ? CATALOG[baseSlug] : null;
  const contextualBump = baseEntry && baseEntry.orderBump && baseEntry.orderBump.slug === slug
    ? baseEntry.orderBump
    : null;
  const priceCents = contextualBump
    ? getUpsellPriceCents(baseSlug, slug)
    : entry && entry.priceCents;

  if (!entry && !contextualBump) return null;

  const item = {
    item_id: slug,
    item_name: (contextualBump && contextualBump.title)
      || (entry && (entry.title || entry.name))
      || slug,
    item_category: getItemCategory(slug),
    price: centsToDollars(priceCents),
    quantity: Number(context.quantity) > 0 ? Math.floor(Number(context.quantity)) : 1,
  };

  if (context.cohort && slug === baseSlug) {
    item.item_variant = 'Cohort ' + context.cohort;
  }

  return item;
}

function buildItemsFromMetadata(metadata) {
  const baseSlug = getMetadataValue(metadata, 'base_slug', 'product_slug');
  const upsellSlug = getMetadataValue(metadata, 'upsell_slug');
  const upsellSlug2 = getMetadataValue(metadata, 'upsell_slug_2');
  const cohort = getMetadataValue(metadata, 'cohort');
  const upsellQuantity = getMetadataValue(metadata, 'upsell_quantity');
  const items = [];

  const baseItem = getItemForSlug(baseSlug, { baseSlug, cohort });
  if (baseItem) items.push(baseItem);

  const upsellItem = getItemForSlug(upsellSlug, {
    baseSlug,
    quantity: upsellQuantity,
  });
  if (upsellItem) items.push(upsellItem);

  const secondUpsellItem = getItemForSlug(upsellSlug2, { baseSlug });
  if (secondUpsellItem) items.push(secondUpsellItem);

  return items;
}

function buildGa4PurchasePayload({
  transactionId = '',
  amountCents,
  currency = 'aud',
  metadata = {},
} = {}) {
  const safeTransactionId = String(transactionId || '').trim();
  const clientId = getMetadataValue(metadata, 'ga_client_id', 'gaClientId');
  const sessionId = getMetadataValue(metadata, 'ga_session_id', 'gaSessionId');
  const productSlug = getMetadataValue(metadata, 'base_slug', 'product_slug');
  const paymentMode = getMetadataValue(metadata, 'payment_mode') || 'full';
  const couponCode = getMetadataValue(metadata, 'coupon_code');
  const items = buildItemsFromMetadata(metadata);
  const value = centsToDollars(amountCents);

  if (!safeTransactionId || !productSlug || !items.length) return null;

  const params = {
    transaction_id: safeTransactionId,
    currency: String(currency || 'AUD').toUpperCase(),
    value,
    product_slug: productSlug,
    payment_mode: paymentMode,
    coupon: couponCode,
    coupon_code: couponCode,
    items,
  };

  if (sessionId) params.session_id = sessionId;

  return {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params,
      },
    ],
  };
}

async function sendGa4Purchase(input = {}) {
  const config = getConfig();
  if (!config) return { sent: false, reason: 'not_configured' };

  const payload = buildGa4PurchasePayload(input);
  if (!payload) return { sent: false, reason: 'invalid_payload' };
  if (!payload.client_id) return { sent: false, reason: 'missing_client_id' };

  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', config.measurementId);
  url.searchParams.set('api_secret', config.apiSecret);

  try {
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[ga4-mp] Purchase dispatch failed:', response.status, text.slice(0, 200));
      return { sent: false, reason: 'request_failed', status: response.status };
    }

    return { sent: true };
  } catch (error) {
    console.warn('[ga4-mp] Purchase dispatch error:', error.message);
    return { sent: false, reason: 'request_error' };
  }
}

module.exports = {
  buildGa4PurchasePayload,
  sendGa4Purchase,
  __setFetchImpl(fn) {
    fetchImpl = fn;
  },
  __resetForTests() {
    fetchImpl = (...args) => fetch(...args);
  },
};
