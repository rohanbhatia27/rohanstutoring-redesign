#!/usr/bin/env node

/**
 * Pricing and Enrolment Drift Audit.
 *
 * Validates that prices, JSON-LD schemas, enrolment CTAs, and Stripe links
 * are consistent across the catalog, checkout config, StorefrontConfig,
 * API handlers, and rendered HTML — without a second source of truth.
 *
 * Zero dependencies outside Node stdlib.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── External Stripe links (not derivable from catalog/StorefrontConfig) ─────

/**
 * These two pages have hardcoded Stripe instalment buy buttons even though
 * the catalog has no `instalment` block for s1-comprehensive or s2-comprehensive.
 * Keeping this minimal map so the audit can still validate the link labels.
 * If instalment config is ever added to the catalog for these slugs, delete this.
 */
const EXTERNAL_STRIPE_LINKS = {
  's1-comprehensive': {
    url: 'https://buy.stripe.com/dRmcN567q5o62u1c2EeEo0u',
    payment: 299,
    count: 4,
  },
  's2-comprehensive': {
    url: 'https://buy.stripe.com/bJe4gz2Ve3fY3y51o0eEo0v',
    payment: 299,
    count: 4,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recursively find all JSON-LD Offer objects nested inside a parsed schema blob.
 */
function findOffers(obj) {
  let offers = [];
  if (!obj || typeof obj !== 'object') return offers;
  if (Array.isArray(obj)) {
    for (const item of obj) offers = offers.concat(findOffers(item));
  } else {
    if (obj['@type'] === 'Offer') offers.push(obj);
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') offers = offers.concat(findOffers(obj[key]));
    }
  }
  return offers;
}

/**
 * Match a JSON-LD Offer to a catalog product via its checkout URL or price.
 */
function findMatchingProductForOffer(offer, pageProducts) {
  if (offer.url) {
    const m = /[?&]product=([a-z0-9-]+)/i.exec(offer.url);
    if (m) {
      const prod = pageProducts.find(p => p.slug === m[1]);
      if (prod) return prod;
    }
  }
  const offerPrice = Number(offer.price);
  if (!isNaN(offerPrice)) {
    const prod = pageProducts.find(p => p.priceCents !== null && p.priceCents / 100 === offerPrice);
    if (prod) return prod;
  }
  return null;
}

/**
 * Extract a dollar amount from text and normalise it (e.g. "$1,699 AUD" → "1699").
 * Returns the normalised string, or null if no dollar amount found.
 */
function normaliseDollar(text) {
  const m = /\$([0-9,.]+)/.exec(text);
  if (!m) return null;
  return m[1].replace(/,/g, '');
}

/**
 * Format a cents value as a plain dollar string (e.g. 169900 → "1699").
 */
function dollars(cents) {
  return String(cents / 100);
}

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function priceMatchesCatalog(value, product) {
  if (!product || product.priceCents === null) return false;
  const expected = dollars(product.priceCents);
  const expectedFixed = (product.priceCents / 100).toFixed(2);
  return value === expected || value === expectedFixed;
}

function getPageProducts(catalog, pageSlug) {
  return Object.values(catalog).filter(function (p) {
    return p.pageSlug === pageSlug || p.slug === pageSlug;
  });
}

function findProductForPrice(pageProducts, price) {
  return pageProducts.find(function (product) {
    return priceMatchesCatalog(price, product);
  }) || null;
}

// ─── Page-level checks ──────────────────────────────────────────────────────

/**
 * Check that sticky-bar and value-summary prices on a course page
 * match the catalog price for the product.
 */
function checkCoursePageVisiblePrices(html, catalog, pageSlug, errors, fileName) {
  const prod = Object.values(catalog).find(function (p) { return p.pageSlug === pageSlug || p.slug === pageSlug; });
  if (!prod || prod.priceCents === null) return;

  const expected = dollars(prod.priceCents);

  // sticky-bar__price
  const stickyRe = /<span\b[^>]*class=["'][^"']*sticky-bar__price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i;
  const stickyM = stickyRe.exec(html);
  if (stickyM) {
    const p = normaliseDollar(stickyM[1]);
    if (p && p !== expected && p !== (prod.priceCents / 100).toFixed(2)) {
      // Skip hourly-rate text like "From $107/hr"
      if (!/\/hr|per hour/i.test(stickyM[1])) {
        errors.push('[Visible Price] In ' + fileName + ': sticky-bar shows $' + p + ', catalog has $' + expected + ' (' + prod.slug + ')');
      }
    }
  }

  // value-summary__now
  const valRe = /<span\b[^>]*class=["'][^"']*value-summary__now[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  let valM;
  while ((valM = valRe.exec(html)) !== null) {
    const p = normaliseDollar(valM[1]);
    if (p && p !== expected && p !== (prod.priceCents / 100).toFixed(2)) {
      errors.push('[Visible Price] In ' + fileName + ': value-summary shows $' + p + ', catalog has $' + expected + ' (' + prod.slug + ')');
    }
  }
}

function checkCatalogPriceElements(html, pageProducts, errors, fileName) {
  const watchedClasses = new Set(['sticky-bar__price', 'value-summary__now', 'bundle-card__price', 'pricing-card__price']);
  const priceClassRe = /<([a-z0-9]+)\b[^>]*class=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = priceClassRe.exec(html)) !== null) {
    const classTokens = String(match[2] || '').split(/\s+/);
    if (!classTokens.some(function (token) { return watchedClasses.has(token); })) continue;

    const text = stripTags(match[3]);
    const price = normaliseDollar(text);
    if (!price) continue;

    if (/\/hr|per hour/i.test(text) && price === '107') continue;

    if (!findProductForPrice(pageProducts, price)) {
      const expected = pageProducts
        .filter(function (product) { return product.priceCents !== null; })
        .map(function (product) { return product.slug + '=$' + dollars(product.priceCents); })
        .join(', ');
      errors.push('[Visible Price] In ' + fileName + ': "' + text + '" does not match page catalog prices (' + expected + ')');
    }
  }
}

function checkCheckoutLinkTextPrices(html, catalog, errors, fileName) {
  const checkoutLinkRe = /<a\b[^>]*href=["']([^"']*\/checkout\/\?product=([a-z0-9-]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = checkoutLinkRe.exec(html)) !== null) {
    const href = match[1];
    const slug = match[2];
    const product = catalog[slug];
    if (!product || product.priceCents === null) continue;

    const text = stripTags(match[3]);
    const price = normaliseDollar(text);
    if (!price) continue;

    const hrefParams = new URLSearchParams(href.split('?')[1] || '');
    const isInstalmentLink = String(hrefParams.get('paymentMode') || hrefParams.get('payment_mode') || '').trim().toLowerCase() === 'instalments';
    const expectedAmount = isInstalmentLink && product.instalment && product.instalment.plan
      ? product.instalment.plan.firstPayment
      : product.priceCents / 100;
    const expectedPrice = String(expectedAmount);
    const expectedFixed = Number(expectedAmount).toFixed(2);

    if (price !== expectedPrice && price !== expectedFixed) {
      errors.push('[CTA Price] In ' + fileName + ': /checkout/?product=' + slug + ' link says $' + price + ', catalog has $' + expectedPrice);
    }
  }
}

/**
 * Enrolment CTA vs product availability.
 *
 * An unavailable product must not expose checkout links or Stripe buy links.
 * An available product should have at least one purchase path.
 */
function checkEnrolmentCtaVsAvailability(html, catalog, pageSlug, errors, fileName) {
  const prod = Object.values(catalog).find(p => p.pageSlug === pageSlug || p.slug === pageSlug);
  if (!prod) return;
  const isAvailableOnPage = prod.available;

  const hasStripeBuy = /buy\.stripe\.com/.test(html);

  // Check for checkout links specifically targeting this product
  const checkoutRe = /\/checkout\/\?product=([a-z0-9-]+)/gi;
  let checkoutM;
  let hasCheckoutForThis = false;
  while ((checkoutM = checkoutRe.exec(html)) !== null) {
    if (checkoutM[1] === prod.slug) {
      hasCheckoutForThis = true;
    }
  }
  const hasAnyCheckout = /\/checkout\/\?product=/.test(html);

  // Purchase CTAs: only clear buy/enrol intent inside clickable controls
  const ctaTagRe = /<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi;
  const ctaTextRe = /\b(?:Enrol(?:\s+Now)?|Secure My Spot|Join Now|Buy Now)\b/i;
  let hasEnrolCta = false;
  let ctaTagMatch;
  while ((ctaTagMatch = ctaTagRe.exec(html)) !== null) {
    if (ctaTextRe.test(stripTags(ctaTagMatch[1]))) {
      hasEnrolCta = true;
      break;
    }
  }

  if (!isAvailableOnPage) {
    if (hasCheckoutForThis) {
      errors.push('[Enrolment] In ' + fileName + ': ' + prod.slug + ' is unavailable but page links to /checkout/?product=' + prod.slug);
    }
    if (hasStripeBuy) {
      errors.push('[Enrolment] In ' + fileName + ': ' + prod.slug + ' is unavailable but page has Stripe buy link(s)');
    }
    if (!hasCheckoutForThis && !hasStripeBuy && hasEnrolCta) {
      errors.push('[Enrolment] In ' + fileName + ': ' + prod.slug + ' is unavailable but page has enrolment CTA text');
    }
  } else {
    if (!hasAnyCheckout && !hasStripeBuy) {
      errors.push('[Enrolment] In ' + fileName + ': ' + prod.slug + ' is available but has no checkout or Stripe buy link');
    }
  }
}

/**
 * Instalment plan consistency.
 *
 * Only fails if the instalment total is below the full catalog price
 * (a premium over the full price is intentional).
 * No longer requires firstPayment == recurringPayment.
 */
function checkInstalmentPlanConsistency(catalog, errors) {
  Object.keys(catalog).forEach(function (slug) {
    const entry = catalog[slug];
    if (!entry.instalment || !entry.instalment.plan || entry.priceCents === null) return;

    const plan = entry.instalment.plan;
    const fullPrice = entry.priceCents / 100;
    const instalmentTotal = plan.firstPayment + plan.recurringPayment * (plan.count - 1);

    if (instalmentTotal < fullPrice - 1) {
      errors.push('[Instalment] ' + slug + ': instalment total $' + instalmentTotal + ' is less than full price $' + fullPrice);
    }
  });
}

// ─── Core runner ─────────────────────────────────────────────────────────────

function runPriceAudit() {
  const errors = [];

  const siteDir = path.resolve(__dirname, '..');

  // Load modules
  const { CATALOG, getUpsellPriceCents } = require(path.join(siteDir, 'js/catalog.js'));
  const { PRODUCTS, ORDER_BUMPS, INSTALMENT_PLANS, UNAVAILABLE_PRODUCT_SLUGS } = require(path.join(siteDir, 'js/checkout.js'));
  const StorefrontConfig = require(path.join(siteDir, 'js/storefront-config.js'));
  const createPaymentIntentHandler = require(path.join(siteDir, 'api/create-checkout.js'));
  const { AMOUNTS, UNAVAILABLE_PRODUCTS } = createPaymentIntentHandler;

  // ── 1. Config alignment: PRODUCTS vs AMOUNTS ──
  for (const [slug, prod] of Object.entries(PRODUCTS)) {
    const cat = CATALOG[slug];
    if (!cat) continue;

    if (cat.hasPkgSelector && cat.packages) {
      for (const pkg of prod.packages) {
        const expected = AMOUNTS[pkg.slug] / 100;
        if (pkg.price !== expected) {
          errors.push('[Config Drift] Package ' + pkg.slug + ' on page ' + slug + ': frontend price $' + pkg.price + ', backend $' + expected);
        }
      }
    } else if (prod.price !== undefined) {
      const expected = AMOUNTS[slug] / 100;
      if (prod.price !== expected) {
        errors.push('[Config Drift] ' + slug + ': frontend price $' + prod.price + ', backend $' + expected);
      }
    }
  }

  // ── 2. Config alignment: ORDER_BUMPS vs getUpsellPriceCents ──
  for (const [baseSlug, bump] of Object.entries(ORDER_BUMPS)) {
    const expectedCents = getUpsellPriceCents(baseSlug, bump.slug);
    if (expectedCents === null) continue;
    const expected = expectedCents / 100;
    if (bump.price !== expected) {
      errors.push('[Config Drift] Order bump ' + bump.slug + ' for ' + baseSlug + ': frontend $' + bump.price + ', backend $' + expected);
    }
  }

  // ── 3. Config alignment: UNAVAILABLE sets ──
  const frontendUnavail = Array.from(UNAVAILABLE_PRODUCT_SLUGS).sort();
  const backendUnavail = Array.from(UNAVAILABLE_PRODUCTS).sort();
  if (JSON.stringify(frontendUnavail) !== JSON.stringify(backendUnavail)) {
    errors.push('[Config Drift] Unavailable sets mismatch. Frontend: [' + frontendUnavail.join(', ') + '], Backend: [' + backendUnavail.join(', ') + ']');
  }

  // ── 4. Config alignment: StorefrontConfig vs catalog instalment ──
  for (const [key, cfg] of Object.entries(StorefrontConfig.instalmentLinks)) {
    const plan = INSTALMENT_PLANS[key];
    const cat = CATALOG[key];

    if (!plan || !cat || !cat.instalment) {
      errors.push('[Config Drift] StorefrontConfig has instalment link for ' + key + ' but no matching catalog/checkout plan');
      continue;
    }

    if (cfg.url !== cat.instalment.url) {
      errors.push('[Config Drift] StorefrontConfig instalment URL for ' + key + ' differs from catalog');
    }

    const labelRe = /or pay \$(\d+) [x×] (\d+) instalments/i;
    const labelM = labelRe.exec(cfg.label);
    if (!labelM) {
      errors.push('[Config Drift] StorefrontConfig label for ' + key + ' does not match expected format');
    } else {
      const labelPrice = parseInt(labelM[1], 10);
      const labelCount = parseInt(labelM[2], 10);
      if (labelPrice !== plan.firstPayment || labelCount !== plan.count) {
        errors.push('[Config Drift] StorefrontConfig label for ' + key + ' says $' + labelPrice + ' x ' + labelCount + ', catalog has $' + plan.firstPayment + ' x ' + plan.count);
      }
    }
  }

  // ── 5. HTML file auditing ──
  const coursesDir = path.join(siteDir, 'courses');
  const htmlFiles = [
    path.join(siteDir, 'index.html'),
    path.join(siteDir, 'courses.html'),
  ];

  if (fs.existsSync(coursesDir)) {
    fs.readdirSync(coursesDir).forEach(function (f) {
      if (f.endsWith('.html') && !f.includes('-mock')) htmlFiles.push(path.join(coursesDir, f));
    });
  }

  for (const filePath of htmlFiles) {
    const fileName = path.relative(siteDir, filePath);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, 'utf8');

    // Skip storefront pages for per-product checks
    if (filePath.endsWith('index.html') || filePath.endsWith('courses.html')) continue;

    const pageSlug = path.basename(filePath, '.html');
    const pageProducts = getPageProducts(CATALOG, pageSlug);
    if (pageProducts.length === 0) continue;

    // A. Visible price checks
    // Only canonical purchase-decision elements are checked (sticky-bar__price,
    // value-summary__now). Secondary elements like bundle-card, pricing-card,
    // and upsell-band are intentionally omitted — they duplicate the canonical
    // prices or serve non-product displays (e.g. hourly rates).
    // Storefront card prices on index.html / courses.html are also not checked;
    // the previous regex-based card parser was too brittle (attribute-ordering
    // assumptions, single-quote/double-quote fragility).
    checkCoursePageVisiblePrices(html, CATALOG, pageSlug, errors, fileName);
    checkCatalogPriceElements(html, pageProducts, errors, fileName);
    checkCheckoutLinkTextPrices(html, CATALOG, errors, fileName);

    // B. Enrolment CTA vs availability
    checkEnrolmentCtaVsAvailability(html, CATALOG, pageSlug, errors, fileName);

    // C. JSON-LD
    const ldRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldM;
    while ((ldM = ldRe.exec(html)) !== null) {
      try {
        const payload = JSON.parse(ldM[1].trim());
        const offers = findOffers(payload);
        for (const offer of offers) {
          const matched = findMatchingProductForOffer(offer, pageProducts);
          if (!matched) {
            errors.push('[JSON-LD] In ' + fileName + ': offer price $' + offer.price + ' does not match any product on this page');
            continue;
          }
          if (matched.priceCents !== null && Number(offer.price) !== matched.priceCents / 100) {
            errors.push('[JSON-LD] In ' + fileName + ': schema price $' + offer.price + ', catalog $' + dollars(matched.priceCents) + ' (' + matched.slug + ')');
          }
          if (offer.priceCurrency !== 'AUD') {
            errors.push('[JSON-LD] In ' + fileName + ': priceCurrency is "' + offer.priceCurrency + '", must be AUD');
          }
          if (offer.availability) {
            const isAvailableOnPage = matched.available;
            const isSoldOut = offer.availability === 'https://schema.org/SoldOut';
            if (!isAvailableOnPage && !isSoldOut) {
              errors.push('[JSON-LD] In ' + fileName + ': ' + matched.slug + ' is unavailable but availability is not SoldOut');
            }
            if (isAvailableOnPage && isSoldOut) {
              errors.push('[JSON-LD] In ' + fileName + ': ' + matched.slug + ' is available but availability is SoldOut');
            }
          }
        }
      } catch (e) {
        errors.push('[JSON-LD] In ' + fileName + ': parse error — ' + e.message);
      }
    }

    // D. Stripe buy link validation
    // Meta description price mentions are intentionally not checked here.
    // Meta tags often include non-product dollar amounts from marketing copy
    // (e.g. "$150 credit", "$107/hr") that cannot be reliably distinguished
    // from actual product prices without a fragile allowlist. JSON-LD covers
    // the structured data that search engines consume.
    const stripeRe = /<a\b[^>]*href=["'](https:\/\/buy\.stripe\.com\/[a-zA-Z0-9]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let sM;
    while ((sM = stripeRe.exec(html)) !== null) {
      const url = sM[1];
      const label = sM[2].replace(/<[^>]*>/g, '').trim();

      // Try to match against StorefrontConfig or catalog instalment
      let matched = false;
      let expectedPayment = null;
      let expectedCount = null;
      let ownerKey = null;

      // Check StorefrontConfig
      for (const [key, cfg] of Object.entries(StorefrontConfig.instalmentLinks)) {
        if (cfg.url === url) {
          matched = true;
          ownerKey = key;
          const plan = INSTALMENT_PLANS[key];
          if (plan) { expectedPayment = plan.firstPayment; expectedCount = plan.count; }
          break;
        }
      }

      // Check catalog instalment URLs
      if (!matched) {
        for (const [slug, entry] of Object.entries(CATALOG)) {
          if (entry.instalment && entry.instalment.url === url) {
            matched = true;
            ownerKey = slug;
            const plan = entry.instalment.plan;
            expectedPayment = plan.firstPayment;
            expectedCount = plan.count;
            break;
          }
        }
      }

      // Check EXTERNAL_STRIPE_LINKS
      if (!matched && EXTERNAL_STRIPE_LINKS[pageSlug] && EXTERNAL_STRIPE_LINKS[pageSlug].url === url) {
        matched = true;
        ownerKey = pageSlug + ' (external)';
        expectedPayment = EXTERNAL_STRIPE_LINKS[pageSlug].payment;
        expectedCount = EXTERNAL_STRIPE_LINKS[pageSlug].count;
      }

      if (!matched) {
        errors.push('[Stripe] In ' + fileName + ': unregistered Stripe link ' + url);
        continue;
      }

      if (ownerKey && ownerKey !== pageSlug && !ownerKey.endsWith('(external)')) {
        errors.push('[Stripe] In ' + fileName + ': Stripe link for "' + ownerKey + '" found on page for "' + pageSlug + '"');
      }

      if (expectedPayment !== null) {
        // Validate label mentions the correct payment amount using word-boundary match
        const paymentRe = new RegExp('\\$' + expectedPayment + '(?![0-9])');
        if (!paymentRe.test(label)) {
          errors.push('[Stripe] In ' + fileName + ': link label "' + label + '" does not mention $' + expectedPayment);
        }
        if (expectedCount !== null && !label.includes(String(expectedCount))) {
          errors.push('[Stripe] In ' + fileName + ': link label "' + label + '" does not mention ' + expectedCount + ' instalments');
        }
      }
    }
  }

  // ── 6. Instalment plan consistency ──
  checkInstalmentPlanConsistency(CATALOG, errors);

  return { success: errors.length === 0, errors };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const result = runPriceAudit();
  if (result.success) {
    console.log('\x1b[32m%s\x1b[0m', '✓ Price audit passed.');
    process.exit(0);
  } else {
    console.error('\x1b[31m%s\x1b[0m', '✗ Price audit failed with ' + result.errors.length + ' error(s):');
    result.errors.forEach(function (e) { console.error('\x1b[31m%s\x1b[0m', '  - ' + e); });
    process.exit(1);
  }
}

module.exports = {
  runPriceAudit,
  findOffers,
  findMatchingProductForOffer,
  checkCatalogPriceElements,
  checkCheckoutLinkTextPrices,
};
