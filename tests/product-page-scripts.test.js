const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const storefrontConfig = require('../js/storefront-config.js');
const { PRODUCTS } = require('../js/checkout.js');
const { createStickyBarController, shouldShowStickyBar } = require('../js/product.js');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('mastery page instalment links are real hrefs in markup and match shared config', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses', 'mastery.html'), 'utf8');
  const masteryTags = Array.from(html.matchAll(/<a\b[^>]*data-mastery-instalment-link[^>]*>/g));

  assert.equal(masteryTags.length, 2);

  for (const [tag] of masteryTags) {
    const hrefMatch = tag.match(/\bhref="([^"]+)"/);
    assert.ok(hrefMatch, 'expected mastery instalment CTA to include an href');
    assert.equal(hrefMatch[1], storefrontConfig.instalmentLinks.mastery.url);
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
  assert.deepEqual(PRODUCTS.comprehensive.instalment, storefrontConfig.instalmentLinks.comprehensive);
  assert.deepEqual(PRODUCTS.mastery.instalment, storefrontConfig.instalmentLinks.mastery);
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
