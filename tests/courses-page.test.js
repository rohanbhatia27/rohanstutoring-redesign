const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mastery flagship card uses the dedicated featured image asset', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');
  const masteryCard = html.match(/<a href="\/courses\/mastery" class="flagship-card flagship-card--premium reveal">[\s\S]*?<\/a>/);

  assert.ok(masteryCard, 'expected mastery flagship card in courses.html');
  assert.match(masteryCard[0], /<img\b[^>]*src="\/assets\/courses\/mastery-course-card\.webp"/);
  assert.match(masteryCard[0], /\balt="GAMSAT Mastery Program"/);
  assert.match(masteryCard[0], /\bwidth="960"/);
  assert.match(masteryCard[0], /\bheight="540"/);
});

test('courses page removes unused GSAP bundles and keeps above-the-fold course art sized and eager', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');

  assert.doesNotMatch(html, /gsap\.min\.js/, 'courses page should not load gsap');
  assert.doesNotMatch(html, /ScrollTrigger\.min\.js/, 'courses page should not load ScrollTrigger');

  const heroPromo = html.match(/<a href="\/courses\/comprehensive" class="hero-promo-card">[\s\S]*?<\/a>/);
  assert.ok(heroPromo, 'expected hero promo card in courses.html');
  assert.match(heroPromo[0], /<img\b[^>]*src="\/assets\/courses\/comprehensive-course-card\.webp"[^>]*width="960"[^>]*height="540"/);
  assert.doesNotMatch(heroPromo[0], /\bloading="lazy"/, 'above-the-fold promo image should not lazy load');
});

test('courses page course tiles declare intrinsic image dimensions for key card assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');
  const expectedImages = [
    ['/assets/courses/blueprint-course-card.webp', '960', '624'],
    ['/assets/courses/advanced-course-card.webp', '960', '960'],
  ];

  for (const [src, width, height] of expectedImages) {
    assert.match(
      html,
      new RegExp(`<img\\b[^>]*src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*width="${width}"[^>]*height="${height}"`)
    );
  }

  const comprehensiveCards = html.match(/<img\b[^>]*src="\/assets\/courses\/comprehensive-course-card\.webp"[^>]*>/g) || [];
  assert.ok(comprehensiveCards.length >= 3, 'expected three comprehensive course card images');
  for (const card of comprehensiveCards) {
    assert.match(card, /\bwidth="960"/);
    assert.match(card, /\bheight="540"/);
  }
});
