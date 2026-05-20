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

  assert.match(trackerHtml, /<script src="js\/free-resource-form\.js" defer><\/script>/);
  assert.match(mockHtml, /<script src="js\/free-resource-form\.js" defer><\/script>/);
  assert.match(trackerHtml, /data-resource-key="s1-tracker"/);
  assert.match(mockHtml, /data-resource-key="s1-mock"/);
});

test('Kit resource page scripts use the hardened internal submit flow instead of posting straight to Kit from fetch', () => {
  const trackerJs = read(path.join('js', 'tracker.js'));
  const mockJs = read(path.join('js', 's1-mock.js'));

  assert.match(trackerJs, /initFreeResourceForms/);
  assert.match(mockJs, /initFreeResourceForms/);
  assert.doesNotMatch(trackerJs, /fetch\(form\.action/);
  assert.doesNotMatch(mockJs, /fetch\(form\.action/);
});
