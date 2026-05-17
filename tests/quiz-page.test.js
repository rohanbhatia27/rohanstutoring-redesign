const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const quizHtml = fs.readFileSync(path.join(ROOT, 'quiz.html'), 'utf8');
const quizCss = fs.readFileSync(path.join(ROOT, 'css', 'quiz.css'), 'utf8');
const quizJs = fs.readFileSync(path.join(ROOT, 'js', 'quiz.js'), 'utf8');
const quizQuestionsBlock = quizJs.split("const STORAGE_KEY = 'rt_quiz_v1';")[0];

function loadQuizRouter() {
  const cutoff = quizJs.indexOf('// Expose for console testing');
  assert.notEqual(cutoff, -1, 'expected quiz router test hook comment');
  const snippet = `${quizJs.slice(0, cutoff)}\nwindow.__QUESTIONS = QUESTIONS; window.__ROUTE = routeAnswers;`;
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox);
  return sandbox.window.__ROUTE;
}

test('quiz page does not load the unused GSAP bundle', () => {
  assert.doesNotMatch(quizHtml, /cdnjs\.cloudflare\.com\/ajax\/libs\/gsap/i);
});

test('quiz lead gate submits to the internal Kit sync endpoint and removes webinar copy', () => {
  assert.match(quizHtml, /<form class="result__gate" id="resultForm" action="\/api\/quiz-lead"/);
  assert.doesNotMatch(quizHtml, /Sunday webinar invite/i);
  assert.match(quizHtml, /relevant course recommendations/i);
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

test('quiz only exposes the four current outcomes', () => {
  assert.match(quizJs, /MASTERY_CALL:\s*{/);
  assert.match(quizJs, /COMPREHENSIVE:\s*{/);
  assert.match(quizJs, /BLUEPRINT:\s*{/);
  assert.match(quizJs, /START_HERE:\s*{/);
  assert.doesNotMatch(quizJs, /ELITE_EXCELLENCE:\s*{/);
  assert.doesNotMatch(quizJs, /ESSAY_ACCELERATOR:\s*{/);
});

test('quiz reroutes advanced resitters and essay-only pain into current outcomes', () => {
  assert.doesNotMatch(quizJs, /return OUTCOMES\.ELITE_EXCELLENCE/);
  assert.doesNotMatch(quizJs, /return OUTCOMES\.ESSAY_ACCELERATOR/);
  assert.match(quizJs, /return OUTCOMES\.MASTERY_CALL/);
  assert.match(quizJs, /return OUTCOMES\.BLUEPRINT/);
});

test('quiz pushes qualified leads into comprehensive and mastery under the stronger sales posture', () => {
  const route = loadQuizRouter();

  assert.equal(
    route({
      timeline: 'sep-2026',
      attempts: 'first',
      current: 'new',
      target: 'realistic',
      section: 's1',
      hours: 'sub5',
      blocker: 'materials',
    }).id,
    'BLUEPRINT'
  );

  assert.equal(
    route({
      timeline: 'sep-2026',
      attempts: 'once',
      current: 'new',
      target: 'realistic',
      section: 's2',
      hours: '5-10',
      blocker: 'essays',
    }).id,
    'COMPREHENSIVE'
  );

  assert.equal(
    route({
      timeline: 'mar-2027',
      attempts: 'once',
      current: 'exam-ready',
      target: 'maximise',
      section: 'strategy',
      hours: '5-10',
      blocker: 'materials',
    }).id,
    'COMPREHENSIVE'
  );

  assert.equal(
    route({
      timeline: 'mar-2027',
      attempts: 'multi',
      current: 'mocked',
      target: 'competitive',
      section: 's1',
      hours: '10-20',
      blocker: 'timing',
    }).id,
    'MASTERY_CALL'
  );

  assert.equal(
    route({
      timeline: 'mar-2027',
      attempts: 'first',
      current: 'new',
      target: 'realistic',
      section: 'strategy',
      hours: '10-20',
      blocker: 'materials',
    }).id,
    'BLUEPRINT'
  );
});
