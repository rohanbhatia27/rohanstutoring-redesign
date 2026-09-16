const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('blog page removes unused GSAP bundles', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'blog.html'), 'utf8');

  assert.doesNotMatch(html, /gsap\.min\.js/);
  assert.doesNotMatch(html, /ScrollTrigger\.min\.js/);
});

test('S2 Slam hero renders one centered cover image', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 's2-slam-system.html'), 'utf8');

  const heroMockups = html.match(/<img class="slam-page-mockup__img"[\s\S]*?>/g) || [];
  assert.equal(heroMockups.length, 1, 'expected exactly one hero cover image');
  assert.match(heroMockups[0], /\bsrc="assets\/free-resources\/s2-slam-system-cover\.png"/);
  assert.match(heroMockups[0], /\bloading="eager"/);
  assert.match(heroMockups[0], /\bfetchpriority="high"/);

  assert.doesNotMatch(html, /slam-page-mockup__picture--(?:left|right)/);
  assert.doesNotMatch(html, /slam-page-mockup__img--(?:left|right)/);
});
