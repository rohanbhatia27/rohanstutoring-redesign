const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const quizHtml = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
const quizCss = fs.readFileSync(path.join(ROOT, 'css', 'quiz.css'), 'utf8');
const quizJs = fs.readFileSync(path.join(ROOT, 'js', 'quiz.js'), 'utf8');

test('quiz page does not load the unused GSAP bundle', () => {
  assert.doesNotMatch(quizHtml, /cdnjs\.cloudflare\.com\/ajax\/libs\/gsap/i);
});

test('quiz focus styles use a defined shared token', () => {
  assert.doesNotMatch(quizCss, /var\(--electric\)/);
  assert.match(
    quizCss,
    /\.quiz__answer:focus-visible,[\s\S]*outline:\s*2px solid var\(--blue-light\);/
  );
});

test('quiz mobile start and resume flows account for the fixed header', () => {
  assert.match(quizCss, /padding-top:\s*calc\(var\(--header-height\)\s*\+/);
  assert.match(quizJs, /window\.scrollTo\(/);
});
