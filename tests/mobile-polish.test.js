const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('blog page removes unused GSAP bundles', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'blog.html'), 'utf8');

  assert.doesNotMatch(html, /gsap\.min\.js/);
  assert.doesNotMatch(html, /ScrollTrigger\.min\.js/);
});

test('S2 Slam hero only eagerly fetches the center mockup on mobile', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 's2-slam-system.html'), 'utf8');

  const centerMockup = html.match(/<img class="slam-page-mockup__img slam-page-mockup__img--center"[\s\S]*?>/);
  assert.ok(centerMockup, 'expected centered hero mockup');
  assert.match(centerMockup[0], /\bsrc="assets\/free-resources\/s2-slam-system-cover\.png"/);
  assert.match(centerMockup[0], /\bloading="eager"/);
  assert.match(centerMockup[0], /\bfetchpriority="high"/);

  const sideSourceMatches = html.match(/<source media="\((?:min|max)-width:[^"]+\)" srcset="assets\/free-resources\/s2-slam-system-cover\.png">/g) || [];
  assert.equal(sideSourceMatches.length, 2, 'expected side mockups to be desktop-only picture sources');

  const sidePictureImgs = html.match(/<img class="slam-page-mockup__img slam-page-mockup__img--(?:left|right)"[\s\S]*?>/g) || [];
  assert.equal(sidePictureImgs.length, 2, 'expected left and right mockup img fallbacks');
  for (const img of sidePictureImgs) {
    assert.doesNotMatch(img, /\bloading="eager"/);
    assert.doesNotMatch(img, /\bsrc="assets\/free-resources\/s2-slam-system-cover\.png"/);
  }
});
