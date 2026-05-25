const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  runPriceAudit,
  findOffers,
  findMatchingProductForOffer,
  checkCatalogPriceElements,
  checkCheckoutLinkTextPrices,
} = require('../scripts/price-audit.js');

test('findOffers locates nested Offer structures recursively', () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': 'GAMSAT Tutoring',
    'offers': [
      {
        '@type': 'Offer',
        'name': 'Single Session',
        'price': '119',
        'priceCurrency': 'AUD'
      },
      {
        '@type': 'Offer',
        'name': '10-Class Pack',
        'price': '1070',
        'priceCurrency': 'AUD'
      }
    ],
    'hasCourseInstance': {
      '@type': 'CourseInstance',
      'offers': {
        '@type': 'Offer',
        'price': '500',
        'priceCurrency': 'AUD'
      }
    }
  };

  const offers = findOffers(jsonLd);
  assert.equal(offers.length, 3);
  assert.equal(offers[0].price, '119');
  assert.equal(offers[1].price, '1070');
  assert.equal(offers[2].price, '500');
});

test('findMatchingProductForOffer associates an offer by URL or by price', () => {
  const pageProducts = [
    { slug: 'mentoring-single', priceCents: 11900 },
    { slug: 'mentoring-pack', priceCents: 107000 }
  ];

  // Match by URL product param
  const offerWithUrl = {
    '@type': 'Offer',
    'price': '119',
    'url': '/checkout/?product=mentoring-single'
  };
  const matchedByUrl = findMatchingProductForOffer(offerWithUrl, pageProducts);
  assert.equal(matchedByUrl?.slug, 'mentoring-single');

  // Match by price
  const offerWithPrice = {
    '@type': 'Offer',
    'price': '1070'
  };
  const matchedByPrice = findMatchingProductForOffer(offerWithPrice, pageProducts);
  assert.equal(matchedByPrice?.slug, 'mentoring-pack');

  // No match
  const offerUnmatched = {
    '@type': 'Offer',
    'price': '999'
  };
  const unmatched = findMatchingProductForOffer(offerUnmatched, pageProducts);
  assert.equal(unmatched, null);
});

test('checkCatalogPriceElements catches canonical visible price drift', () => {
  const errors = [];
  checkCatalogPriceElements(
    '<span class="value-summary__now">$999</span><span class="bundle-card__total-was">$408 AUD</span>',
    [{ slug: 'comprehensive', priceCents: 169900 }],
    errors,
    'courses/comprehensive.html'
  );

  assert.deepEqual(errors, [
    '[Visible Price] In courses/comprehensive.html: "$999" does not match page catalog prices (comprehensive=$1699)'
  ]);
});

test('checkCheckoutLinkTextPrices catches CTA price drift by product slug', () => {
  const errors = [];
  checkCheckoutLinkTextPrices(
    '<a href="/checkout/?product=blueprint" class="btn">Get the Blueprint for $499 AUD</a>',
    { blueprint: { slug: 'blueprint', priceCents: 59900 } },
    errors,
    'courses/blueprint.html'
  );

  assert.deepEqual(errors, [
    '[CTA Price] In courses/blueprint.html: /checkout/?product=blueprint link says $499, catalog has $599'
  ]);
});

test('runPriceAudit executes clean and reports no drift in the main codebase', () => {
  const result = runPriceAudit();
  if (!result.success) {
    console.error('Price audit errors:', result.errors);
  }
  assert.ok(result.success, 'Expected zero drift error in the default codebase configurations');
  assert.equal(result.errors.length, 0);
});
