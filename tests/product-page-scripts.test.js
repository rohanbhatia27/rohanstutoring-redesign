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

test('flagship course pages route visitors to checkout after enrolments reopen', () => {
  const masteryHtml = fs.readFileSync(path.join(__dirname, '..', 'courses', 'mastery.html'), 'utf8');
  const comprehensiveHtml = fs.readFileSync(path.join(__dirname, '..', 'courses', 'comprehensive.html'), 'utf8');

  assert.match(masteryHtml, /New Cohort Starts 15 June/);
  assert.match(masteryHtml, /href="\/checkout\/\?product=mastery"/);
  assert.match(masteryHtml, /href="\/checkout\/\?product=mastery(?:&amp;|&)paymentMode=instalments"/);
  assert.doesNotMatch(masteryHtml, /Sold Out|waitlist|formspree\.io/i);

  assert.match(comprehensiveHtml, /New cohort starts 15 June/);
  assert.match(comprehensiveHtml, /href="\/checkout\/\?product=comprehensive"/);
  assert.match(comprehensiveHtml, /href="\/checkout\/\?product=comprehensive(?:&amp;|&)paymentMode=instalments"/);
  assert.doesNotMatch(comprehensiveHtml, /Sold Out|waitlist|formspree\.io/i);
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
  assert.deepEqual(PRODUCTS.comprehensive.instalment, storefrontConfig.instalmentLinks.comprehensive);
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

test('comprehensive hero uses a June cohort access banner instead of a countdown', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses', 'comprehensive.html'), 'utf8');

  assert.match(html, /New cohort starts 15 June/);
  assert.match(html, /full library before Week 1/);
  assert.doesNotMatch(html, /\bdata-countdown-v3\b/);
  assert.doesNotMatch(html, /Cohort begins in/);
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
