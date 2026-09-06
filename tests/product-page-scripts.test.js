const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storefrontConfig = require('../js/storefront-config.js');
const { CATALOG } = require('../js/catalog.js');
const { PRODUCTS } = require('../js/checkout.js');
const {
  createStickyBarController,
  getCountdownParts,
  padCountdownUnit,
  shouldShowStickyBar,
} = require('../js/product.js');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('flagship course pages are open and route visitors to checkout', () => {
  const masteryHtml = fs.readFileSync(path.join(__dirname, '..', 'courses', 'mastery.html'), 'utf8');
  const comprehensiveHtml = fs.readFileSync(path.join(__dirname, '..', 'courses', 'comprehensive.html'), 'utf8');

  assert.doesNotMatch(masteryHtml, /Sold Out/);
  assert.match(masteryHtml, /href="\/checkout\/\?product=mastery/);

  assert.doesNotMatch(comprehensiveHtml, /Sold Out/);
  assert.match(comprehensiveHtml, /href="\/checkout\/\?product=comprehensive/);
});

test('comprehensive page routes enrolment CTAs to checkout at the early bird price', () => {
  const comprehensiveHtml = fs.readFileSync(path.join(__dirname, '..', 'courses', 'comprehensive.html'), 'utf8');
  const checkoutLinks = comprehensiveHtml.match(/href="\/checkout\/\?product=comprehensive"/g) || [];

  assert.ok(checkoutLinks.length >= 3, 'open page should route visitors to checkout');
  assert.doesNotMatch(comprehensiveHtml, /Join the [Ww]aitlist/);
  assert.match(comprehensiveHtml, /\$1,599/);
  // The struck-through full price must stay outside the audited price element.
  assert.match(comprehensiveHtml, /<span class="sticky-bar__was">\$1,799<\/span>/);
});

test('split comprehensive pages route enrolment CTAs to checkout while live coaching is open', () => {
  const files = [
    ['s1-comprehensive.html', 's1-comprehensive'],
    ['s2-comprehensive.html', 's2-comprehensive'],
  ];

  for (const [file, slug] of files) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'courses', file), 'utf8');
    const checkoutLinks = html.match(new RegExp(`/checkout/\\?product=${slug}`, 'g')) || [];

    assert.ok(checkoutLinks.length >= 3, `${file} should route visitors to checkout`);
    assert.doesNotMatch(html, /Join the [Ww]aitlist|This cohort is full/i, `${file} should not still offer a waitlist`);
    // These sections have no instalment plan, so they must not advertise one.
    assert.doesNotMatch(html, /instalment/i, `${file} should not mention instalments`);
  }
});

test('product hero media keeps eager LCP hints and a shared aspect-ratio fallback', () => {
  const productCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'product.css'), 'utf8');
  const heroMedia = [
    ['courses/comprehensive.html', 'GAMSAT Live Comprehensive Course'],
    ['courses/blueprint.html', "Rohan's GAMSAT Blueprint"],
    ['courses/essay-collection.html', 'Expert Essay Collection'],
    ['courses/s1-rescue-sprint.html', 'Section 1 Rescue Sprint'],
    ['courses/s2-rescue-sprint.html', 'S2 Rescue Sprint'],
    ['courses/mastery.html', 'GAMSAT Mastery Program promotional artwork'],
  ];

  assert.match(
    productCss,
    /\.product-hero__card img\s*\{[\s\S]*aspect-ratio:\s*auto\s+var\(--product-hero-media-ratio,\s*16\s*\/\s*10\);/,
    'product hero images should reserve space with a shared aspect-ratio fallback'
  );

  for (const [file, alt] of heroMedia) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const heroImgTag = html.match(new RegExp(`<img\\b[^>]*alt="${escapeRegExp(alt)}"[^>]*>`));

    assert.ok(heroImgTag, `expected hero image markup in ${file}`);
    assert.match(heroImgTag[0], /\bwidth="\d+"/, `${file} hero image is missing width`);
    assert.match(heroImgTag[0], /\bheight="\d+"/, `${file} hero image is missing height`);
    assert.match(heroImgTag[0], /\bloading="eager"/, `${file} hero image should stay eager`);
    assert.match(heroImgTag[0], /\bfetchpriority="high"/, `${file} hero image should advertise high fetch priority`);
  }
});

test('mastery hero uses the dedicated mastery artwork asset', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses', 'mastery.html'), 'utf8');
  const heroImgTag = html.match(/<img\b[^>]*src="\.\.\/assets\/courses\/mastery-course-card\.webp"[^>]*>/);

  assert.ok(heroImgTag, 'expected mastery hero image to use the dedicated course artwork');
  assert.match(heroImgTag[0], /\bwidth="960"/);
  assert.match(heroImgTag[0], /\bheight="540"/);
});

test('checkout instalment links use shared storefront config', () => {
  // Comprehensive is full-payment only during the early bird window, so it
  // must be absent from both the catalog and the shared storefront config.
  assert.equal(PRODUCTS.comprehensive.instalment, null);
  assert.equal(storefrontConfig.instalmentLinks.comprehensive, undefined);
  assert.deepEqual(PRODUCTS.mastery.instalment, storefrontConfig.instalmentLinks.mastery);
});

test('checkout pages load catalog before checkout logic', () => {
  const pages = [
    path.join(__dirname, '..', 'checkout', 'index.html'),
    path.join(__dirname, '..', 'checkout', 'success.html'),
  ];

  pages.forEach((filePath) => {
    const html = fs.readFileSync(filePath, 'utf8');
    const catalogIndex = html.indexOf('/js/catalog.js');
    const checkoutIndex = html.indexOf('js/checkout.js');

    assert.ok(catalogIndex !== -1, `${path.basename(filePath)} should load /js/catalog.js`);
    assert.ok(checkoutIndex !== -1, `${path.basename(filePath)} should load checkout.js`);
    assert.ok(catalogIndex < checkoutIndex, `${path.basename(filePath)} should load catalog before checkout.js`);
  });
});

test('course product pages share the product stylesheet and script shell', () => {
  const coursePageSlugs = new Set(
    Object.values(CATALOG)
      .map((entry) => entry.pageSlug)
      .filter(Boolean)
  );

  coursePageSlugs.forEach((pageSlug) => {
    const filePath = path.join(__dirname, '..', 'courses', `${pageSlug}.html`);
    const html = fs.readFileSync(filePath, 'utf8');
    const styleIndex = html.indexOf('../css/style.css');
    const productCssIndex = html.indexOf('../css/product.css');
    const mainJsIndex = html.indexOf('../js/main.js');
    const productJsIndex = html.indexOf('../js/product.js');

    assert.ok(styleIndex !== -1, `${pageSlug} should load shared style.css`);
    assert.ok(productCssIndex !== -1, `${pageSlug} should load shared product.css`);
    assert.ok(styleIndex < productCssIndex, `${pageSlug} should load style.css before product.css`);
    assert.ok(mainJsIndex !== -1, `${pageSlug} should load shared main.js`);
    assert.ok(productJsIndex !== -1, `${pageSlug} should load shared product.js`);
    assert.ok(mainJsIndex < productJsIndex, `${pageSlug} should load main.js before product.js`);
  });
});

test('comprehensive hero counts down to the early bird deadline, not an expired cohort start', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses', 'comprehensive.html'), 'utf8');

  assert.doesNotMatch(html, /Sold Out/);
  assert.doesNotMatch(html, /This cohort is full/);
  assert.doesNotMatch(html, /1 Seat Left/);
  assert.doesNotMatch(html, /data-countdown-v3-target="2026-06-15T18:00:00\+10:00"/);
  assert.doesNotMatch(html, /Cohort begins in/);

  // The countdown must target the 1 October early bird cutoff and carry every
  // unit the hero countdown script writes into.
  assert.match(html, /data-countdown-v3-target="2026-10-01T23:59:59\+10:00"/);
  for (const unit of ['data-cd-days', 'data-cd-hours', 'data-cd-mins', 'data-cd-secs']) {
    assert.match(html, new RegExp(unit), `hero countdown should include ${unit}`);
  }
});

test('public cohort surfaces do not advertise expired June 2026 starts', () => {
  const files = [
    'index.html',
    'courses.html',
    'courses/comprehensive.html',
    'courses/s1-comprehensive.html',
    'courses/s2-comprehensive.html',
    'courses/mastery.html',
  ];
  const expiredActiveCohortPatterns = [
    /New cohort starts 15 June/i,
    /same June cohort/i,
    /Live\s+June\s+Cohort/i,
    /June cohort starts 15 June 2026/i,
    /starting 15 June/i,
    /starting 18 June/i,
    /starts? 15 June/i,
    /starts? 18 June/i,
    /"startDate":\s*"2026-06-\d{2}"/,
    /June 2026 Start/i,
    /<span>Cohort<\/span>\s*<strong>June 2026<\/strong>/i,
    /Mondays?\s*(?:,|at|\s).*6pm AEST/i,
    /Thursdays?\s*(?:,|at|\s).*6pm AEST/i,
    /S1 Mondays,\s*S2 Thursdays at 6pm AEST/i,
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const pattern of expiredActiveCohortPatterns) {
      assert.doesNotMatch(source, pattern, `Expired active cohort copy remains in ${file}: ${pattern}`);
    }
  }
});

test('getCountdownParts returns days, hours, and minutes until 26 May', () => {
  const target = new Date('2026-05-26T00:00:00+10:00');
  const now = new Date('2026-05-14T20:27:00+10:00');

  assert.deepEqual(getCountdownParts(target, now), {
    isComplete: false,
    days: 11,
    hours: 3,
    minutes: 33,
  });
});

test('getCountdownParts completes cleanly after the target date arrives', () => {
  const target = new Date('2026-05-26T00:00:00+10:00');
  const now = new Date('2026-05-26T00:01:00+10:00');

  assert.deepEqual(getCountdownParts(target, now), {
    isComplete: true,
    days: 0,
    hours: 0,
    minutes: 0,
  });
});

test('padCountdownUnit keeps hour and minute values stable in the compact UI', () => {
  assert.equal(padCountdownUnit(3), '03');
  assert.equal(padCountdownUnit(12), '12');
});

test('shouldShowStickyBar uses the live hero position', () => {
  assert.equal(shouldShowStickyBar({ bottom: 220 }), false);
  assert.equal(shouldShowStickyBar({ bottom: 100 }), true);
  assert.equal(shouldShowStickyBar({ bottom: 36 }), true);
  assert.equal(shouldShowStickyBar(null), false);
});

test('createStickyBarController updates from live hero geometry and cleans up listeners', () => {
  const toggles = [];
  const listeners = new Map();
  const observedHeroes = [];
  let disconnected = false;
  let heroBottom = 220;
  let pendingAnimationFrame = null;

  const stickyBar = {
    classList: {
      toggle(className, isVisible) {
        toggles.push({ className, isVisible });
      },
    },
  };
  const hero = {
    getBoundingClientRect() {
      return { bottom: heroBottom };
    },
  };
  const fakeWindow = {
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName) {
      listeners.delete(eventName);
    },
    requestAnimationFrame(callback) {
      pendingAnimationFrame = callback;
      return 1;
    },
    cancelAnimationFrame() {
      pendingAnimationFrame = null;
    },
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe(target) {
        observedHeroes.push(target);
      }
      disconnect() {
        disconnected = true;
      }
    },
  };

  const controller = createStickyBarController(stickyBar, hero, {
    revealOffset: 100,
    windowObject: fakeWindow,
  });
  pendingAnimationFrame();

  assert.deepEqual(
    Array.from(listeners.keys()).sort(),
    ['load', 'resize', 'scroll']
  );
  assert.deepEqual(observedHeroes, [hero]);
  assert.deepEqual(toggles[0], { className: 'visible', isVisible: false });

  heroBottom = 80;
  controller.update();
  pendingAnimationFrame();
  assert.deepEqual(toggles.at(-1), { className: 'visible', isVisible: true });

  controller.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(disconnected, true);
});
