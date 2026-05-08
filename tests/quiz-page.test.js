const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const quizHtml = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
const quizCss = fs.readFileSync(path.join(ROOT, 'css', 'quiz.css'), 'utf8');
const quizJs = fs.readFileSync(path.join(ROOT, 'js', 'quiz.js'), 'utf8');
const quizQuestionsBlock = quizJs.split("const STORAGE_KEY = 'rt_quiz_v1';")[0];

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

test('quiz question copy avoids stale month offsets and misleading score bands', () => {
  assert.doesNotMatch(quizQuestionsBlock, /5 months out|11 months out/i);
  assert.doesNotMatch(quizQuestionsBlock, /Below 55|55 to 60|60 to 64|65 or above/i);
  assert.doesNotMatch(quizQuestionsBlock, /safe pass|top-tier|elite/i);
});
