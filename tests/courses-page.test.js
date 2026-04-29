const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mastery flagship card uses the dedicated featured image asset', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'courses.html'), 'utf8');
  const masteryCard = html.match(/<a href="\/courses\/mastery" class="flagship-card flagship-card--premium reveal">[\s\S]*?<\/a>/);

  assert.ok(masteryCard, 'expected mastery flagship card in courses.html');
  assert.match(masteryCard[0], /<img\b[^>]*src="\/assets\/courses\/mastery-course-card\.png"/);
  assert.match(masteryCard[0], /\balt="GAMSAT Mastery Program"/);
});
