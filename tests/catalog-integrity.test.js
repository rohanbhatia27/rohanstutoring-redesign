const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CATALOG } = require('../js/catalog.js');
const { SERVER_CATALOG, SERVER_EXTENSIONS } = require('../api/_lib/catalog.server.js');

// ─── Catalog integrity ───────────────────────────────────────────────────────

test('catalog: all slugs have required fields with valid values', () => {
  const REQUIRED = ['slug', 'name', 'title', 'available', 'successType', 'isDigital'];
  Object.entries(CATALOG).forEach(([slug, entry]) => {
    REQUIRED.forEach((field) => {
      assert.notEqual(entry[field], undefined, `${slug} missing field: ${field}`);
    });
    assert.equal(entry.slug, slug, `${slug} entry.slug must equal its key`);
    if (entry.priceCents !== null) {
      assert.ok(typeof entry.priceCents === 'number' && entry.priceCents > 0,
        `${slug} priceCents must be a positive number`);
    }
  });
});

test('catalog: every allowedUpsell target exists and has a price', () => {
  Object.entries(CATALOG).forEach(([slug, entry]) => {
    (entry.allowedUpsells || []).forEach((upsellSlug) => {
      assert.ok(CATALOG[upsellSlug],
        `${slug} upsell target '${upsellSlug}' not found in catalog`);
      assert.ok(CATALOG[upsellSlug].priceCents > 0,
        `${slug} upsell target '${upsellSlug}' has no priceCents`);
    });
    Object.keys(entry.upsellPriceOverrides || {}).forEach((upsellSlug) => {
      assert.ok((entry.allowedUpsells || []).includes(upsellSlug),
        `${slug} upsellPriceOverride for '${upsellSlug}' is not in allowedUpsells`);
      assert.ok(entry.upsellPriceOverrides[upsellSlug] > 0,
        `${slug} upsellPriceOverride for '${upsellSlug}' must be positive`);
    });
  });
});

test('catalog: every orderBump target exists in catalog', () => {
  Object.entries(CATALOG).forEach(([slug, entry]) => {
    if (!entry.orderBump) return;
    assert.ok(entry.orderBump.slug,
      `${slug} orderBump missing slug field`);
    assert.ok(CATALOG[entry.orderBump.slug],
      `${slug} orderBump target '${entry.orderBump.slug}' not found in catalog`);
  });
});

test('catalog: instalment entries have required plan fields', () => {
  Object.entries(CATALOG).forEach(([slug, entry]) => {
    if (!entry.instalmentEligible) return;
    assert.ok(entry.instalment, `${slug} marked instalmentEligible but has no instalment object`);
    assert.ok(entry.instalment.url, `${slug} instalment missing url`);
    assert.ok(entry.instalment.plan, `${slug} instalment missing plan`);
    assert.ok(entry.instalment.plan.priceEnvKey, `${slug} instalment.plan missing priceEnvKey`);
    assert.ok(entry.instalment.plan.count > 0, `${slug} instalment.plan.count must be positive`);
  });
});

// ─── Server catalog integrity ────────────────────────────────────────────────

test('server catalog: all catalog slugs have server extensions with required fields', () => {
  const SERVER_REQUIRED = ['deliveryType', 'fulfillmentLabel', 'fulfillmentSlug'];
  Object.keys(CATALOG).forEach((slug) => {
    const ext = SERVER_EXTENSIONS[slug];
    assert.ok(ext, `${slug} missing server extension`);
    SERVER_REQUIRED.forEach((field) => {
      assert.notEqual(ext[field], undefined, `${slug} server extension missing: ${field}`);
    });
  });
});

// ─── Page coverage: catalog pageSlug ↔ courses/ directory ───────────────────

test('every live courses/*.html maps 1:1 to a catalog entry with a matching pageSlug', () => {
  const coursesDir = path.join(__dirname, '../courses');
  const htmlFiles = fs.readdirSync(coursesDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace('.html', ''));

  // Build set of pageSlugs defined in the catalog
  const catalogPageSlugs = new Set(
    Object.values(CATALOG)
      .map((e) => e.pageSlug)
      .filter(Boolean)
  );

  htmlFiles.forEach((fileSlug) => {
    assert.ok(catalogPageSlugs.has(fileSlug),
      `courses/${fileSlug}.html exists on disk but no catalog entry has pageSlug: '${fileSlug}'`);
  });
});

test('every catalog pageSlug has a corresponding courses/*.html file', () => {
  const coursesDir = path.join(__dirname, '../courses');
  const existingFiles = new Set(
    fs.readdirSync(coursesDir)
      .filter((f) => f.endsWith('.html'))
      .map((f) => f.replace('.html', ''))
  );

  // Unique pageSlugs (multiple slugs can share a page, e.g. mentoring-single + mentoring-pack)
  const pageSlugs = new Set(
    Object.values(CATALOG)
      .map((e) => e.pageSlug)
      .filter(Boolean)
  );

  pageSlugs.forEach((pageSlug) => {
    assert.ok(existingFiles.has(pageSlug),
      `catalog pageSlug '${pageSlug}' has no corresponding courses/${pageSlug}.html`);
  });
});

// ─── HTML schema prices match catalog ────────────────────────────────────────
// Guard: JSON-LD offers.price in each course page must match catalog priceCents.
// This catches drift when prices change — update catalog.js, not the HTML.

test('course page JSON-LD prices match catalog priceCents', () => {
  const coursesDir = path.join(__dirname, '../courses');
  const htmlFiles = fs.readdirSync(coursesDir).filter((f) => f.endsWith('.html'));

  // Build a map from pageSlug → expected prices (multiple slugs can share a page)
  const pageExpectedPrices = {};
  Object.values(CATALOG).forEach((entry) => {
    if (!entry.pageSlug || entry.priceCents === null) return;
    const expected = entry.priceCents / 100;
    if (!pageExpectedPrices[entry.pageSlug]) pageExpectedPrices[entry.pageSlug] = new Set();
    pageExpectedPrices[entry.pageSlug].add(expected);
  });

  htmlFiles.forEach((file) => {
    const pageSlug = file.replace('.html', '');
    const expectedSet = pageExpectedPrices[pageSlug];
    if (!expectedSet) return; // no price in catalog for this page (e.g. private-mentoring has sub-slugs)

    const html = fs.readFileSync(path.join(coursesDir, file), 'utf8');

    // Extract all JSON-LD price values from the page
    const scriptMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    const foundPrices = new Set();
    scriptMatches.forEach((match) => {
      try {
        const json = JSON.parse(match[1]);
        const extractPrices = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj['@type'] === 'Offer' || obj['@type'] === 'AggregateOffer') {
            const p = parseFloat(obj.price || obj.lowPrice || '');
            if (!isNaN(p)) foundPrices.add(p);
          }
          Object.values(obj).forEach((v) => {
            if (Array.isArray(v)) v.forEach(extractPrices);
            else if (v && typeof v === 'object') extractPrices(v);
          });
        };
        extractPrices(json);
      } catch (_) { /* non-JSON script */ }
    });

    expectedSet.forEach((expectedPrice) => {
      assert.ok(foundPrices.has(expectedPrice),
        `courses/${file}: expected JSON-LD price $${expectedPrice} (from catalog) but found: [${[...foundPrices].join(', ')}]`
      );
    });
  });
});
