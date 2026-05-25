'use strict';

const {
  CATALOG,
  getUpsellPriceCents,
  isAllowedUpsell,
  getUnavailableSlugs,
  getHighTicketSlugs,
} = require('./catalog.server.js');

// Derived from catalog — do not edit these; edit js/catalog.js instead.
const AMOUNTS = (function () {
  const m = {};
  Object.keys(CATALOG).forEach(function (slug) {
    if (CATALOG[slug].priceCents !== null) m[slug] = CATALOG[slug].priceCents;
  });
  return m;
}());

const UNAVAILABLE_PRODUCTS = new Set(getUnavailableSlugs());
const HIGH_TICKET_PRODUCT_SLUGS = new Set(getHighTicketSlugs());
const ESSAY_UPLOAD_SLUGS = new Set(
  Object.keys(CATALOG).filter(function (k) { return CATALOG[k].requiresEssayUpload; })
);

const ALLOWED_UPSELLS = (function () {
  const m = {};
  Object.keys(CATALOG).forEach(function (slug) {
    const upsells = CATALOG[slug].allowedUpsells;
    if (upsells && upsells.length) m[slug] = new Set(upsells);
  });
  return m;
}());

function normaliseSlug(value) {
  return String(value || '').trim();
}

function normaliseUpsellSlug(body) {
  return normaliseSlug(body.upsellSlug || body.upsell_slug || body.addOnSlug);
}

function normaliseUpsellQuantity(body) {
  const rawValue = body.upsellQuantity || body.upsell_quantity || (body.upsell && body.upsell.quantity);
  const quantity = Math.floor(Number(rawValue) || 1);
  return Math.max(1, quantity);
}

function getUpsellAmount(baseSlug, upsellSlug) {
  return getUpsellPriceCents(baseSlug, upsellSlug);
}

function isAllowedUpsellCombination(baseSlug, upsellSlug) {
  return isAllowedUpsell(baseSlug, upsellSlug);
}

function resolveCheckoutPurchase(body) {
  const baseSlug = normaliseSlug(body.slug);
  const upsellSlug = normaliseUpsellSlug(body);
  const baseAmount = AMOUNTS[baseSlug];

  if (!baseAmount) {
    return { error: 'Invalid product slug: ' + baseSlug };
  }

  if (UNAVAILABLE_PRODUCTS.has(baseSlug)) {
    return { error: 'This product is currently unavailable.' };
  }

  if (!upsellSlug) {
    return {
      amount: baseAmount,
      baseAmount,
      baseSlug,
      upsellAmount: 0,
      upsellSlug: '',
      upsellQuantity: 0,
      upsellUnitAmount: 0,
    };
  }

  const upsellUnitAmount = getUpsellAmount(baseSlug, upsellSlug);
  if (!upsellUnitAmount) {
    return { error: 'Invalid upsell slug: ' + upsellSlug };
  }

  if (baseSlug === upsellSlug || !isAllowedUpsellCombination(baseSlug, upsellSlug)) {
    return {
      error: `Invalid upsell combination: ${baseSlug} + ${upsellSlug}`,
    };
  }

  const upsellQuantity = normaliseUpsellQuantity(body);
  const upsellAmount = upsellUnitAmount * upsellQuantity;
  const purchase = {
    amount: baseAmount + upsellAmount,
    baseAmount,
    baseSlug,
    upsellAmount,
    upsellSlug,
  };

  if (upsellQuantity > 1) {
    purchase.upsellQuantity = upsellQuantity;
    purchase.upsellUnitAmount = upsellUnitAmount;
  }

  return purchase;
}

function buildPaymentIntentIdempotencyKey({ customerEmail = '', purchase = {} } = {}) {
  const emailPart = String(customerEmail || '').trim().toLowerCase();
  const baseSlugPart = String(purchase.baseSlug || '').trim().toLowerCase();
  const upsellSlugPart = String(purchase.upsellSlug || '').trim().toLowerCase();
  const minuteWindow = Math.floor(Date.now() / 60000);
  const parts = [
    'pi',
    emailPart || 'anonymous',
    baseSlugPart || 'unknown',
    upsellSlugPart || 'no-upsell',
  ];

  if (Number(purchase.upsellQuantity) > 1) {
    parts.push(String(purchase.upsellQuantity));
  }

  parts.push(minuteWindow);
  return parts.join('-');
}

module.exports = {
  AMOUNTS,
  UNAVAILABLE_PRODUCTS,
  HIGH_TICKET_PRODUCT_SLUGS,
  ESSAY_UPLOAD_SLUGS,
  ALLOWED_UPSELLS,
  normaliseSlug,
  normaliseUpsellSlug,
  normaliseUpsellQuantity,
  getUpsellAmount,
  isAllowedUpsellCombination,
  resolveCheckoutPurchase,
  buildPaymentIntentIdempotencyKey,
};
