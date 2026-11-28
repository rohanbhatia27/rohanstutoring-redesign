const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('courses page features March Intensive and hides the previous live offers', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');
  assert.match(html, /<h1[^>]*>GAMSAT March Intensive<\/h1>/);
  assert.doesNotMatch(html, /\/courses\/(?:comprehensive|mastery|s[12]-comprehensive)\b/);
});

test('courses page removes unused GSAP bundles and keeps above-the-fold course art sized and eager', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');

  assert.doesNotMatch(html, /gsap\.min\.js/, 'courses page should not load gsap');
  assert.doesNotMatch(html, /ScrollTrigger\.min\.js/, 'courses page should not load ScrollTrigger');

  const heroPromo = html.match(/<a href="\/courses\/march-intensive" class="hero-promo-card">[\s\S]*?<\/a>/);
  assert.ok(heroPromo, 'expected hero promo card in courses.html');
  assert.match(heroPromo[0], /<img\b[^>]*src="\/assets\/class-preview-s1\.webp"[^>]*width="1969"[^>]*height="1249"/);
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
});
