const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('courses page features March Intensive and hides the previous live offers', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');
  assert.match(html, /<h1[^>]*>GAMSAT <span>March Intensive<\/span><\/h1>/);
  assert.doesNotMatch(html, /\/courses\/(?:comprehensive|mastery|s[12]-comprehensive)\b/);
});

test('courses page removes unused GSAP bundles and keeps above-the-fold course art sized and eager', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');

  assert.doesNotMatch(html, /gsap\.min\.js/, 'courses page should not load gsap');
  assert.doesNotMatch(html, /ScrollTrigger\.min\.js/, 'courses page should not load ScrollTrigger');

  const portrait = html.match(/<img\b[^>]*src="\/assets\/homepage\/rohan-hero-720\.webp"[^>]*>/);
  assert.ok(portrait, 'expected a portrait of Rohan in the course hero');
  assert.match(portrait[0], /width="720"[^>]*height="720"/);
  assert.match(portrait[0], /loading="eager"/);
  assert.doesNotMatch(html, /class-preview-s1\.webp/);
});

test('March Intensive hero links to the enrolment options and timetable', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'courses.html'), 'utf8');
  const landing = fs.readFileSync(path.join(root, 'courses', 'march-intensive.html'), 'utf8');
  const hero = html.match(/<section class="courses-hero"[\s\S]*?<\/section>/)?.[0] ?? '';

  for (const id of ['pricing', 'timetable']) {
    assert.ok(hero.includes(`href="/courses/march-intensive#${id}"`), id);
    assert.ok(landing.includes(`id="${id}"`), id);
  }
  assert.match(hero, /A\$1,699/);
  assert.match(hero, /full refund/);
  assert.match(hero, /10 December/);
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
