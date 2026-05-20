const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('Kit resource pages load the shared hardening script and declare resource keys', () => {
  const trackerHtml = read('section-1-tracker.html');
  const mockHtml = read('s1-mock.html');
  const slamHtml = read('s2-slam-system.html');

  assert.match(trackerHtml, /<script src="js\/free-resource-form\.js" defer><\/script>/);
  assert.match(mockHtml, /<script src="js\/free-resource-form\.js" defer><\/script>/);
  assert.match(trackerHtml, /data-resource-key="s1-tracker"/);
  assert.match(mockHtml, /data-resource-key="s1-mock"/);
  assert.match(slamHtml, /action="https:\/\/app\.kit\.com\/forms\/8526774\/subscriptions"/);
  assert.match(slamHtml, /data-resource-key="s2-slam-system"/);
  assert.doesNotMatch(slamHtml, /formspree\.io/);
  assert.doesNotMatch(slamHtml, /s2-slam-system-form/);
});

test('Kit resource page scripts use the hardened internal submit flow instead of posting straight to Kit from fetch', () => {
  const trackerJs = read(path.join('js', 'tracker.js'));
  const mockJs = read(path.join('js', 's1-mock.js'));
  const slamJs = read(path.join('js', 's2-slam-system.js'));

  assert.match(trackerJs, /initFreeResourceForms/);
  assert.match(mockJs, /initFreeResourceForms/);
  assert.doesNotMatch(trackerJs, /fetch\(form\.action/);
  assert.doesNotMatch(mockJs, /fetch\(form\.action/);
  assert.match(slamJs, /fetch\('\/api\/leads'/);
  assert.doesNotMatch(slamJs, /formspree\.io/);
  assert.doesNotMatch(slamJs, /fetch\(form\.action/);
});
