const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

test('repo hygiene: generated and local-only paths are ignored', () => {
  const ignoredPaths = [
    '.DS_Store',
    'assets/.DS_Store',
    'debug.log',
    'scratch.tmp',
    'tmp/redirect-report.csv',
    'coverage/lcov.info',
    '.cache/cache-entry',
    'redirect-audit-preview-output.csv',
  ];

  ignoredPaths.forEach((filePath) => {
    assert.doesNotThrow(
      () => git(['check-ignore', '--quiet', filePath]),
      `${filePath} should be ignored by .gitignore`
    );
  });
});

test('repo hygiene: generated clutter is not tracked', () => {
  const trackedFiles = git(['ls-files']).split('\n').filter(Boolean);
  const forbidden = trackedFiles.filter((filePath) => (
    filePath === '.DS_Store' ||
    filePath.includes('/.DS_Store') ||
    filePath.startsWith('node_modules/') ||
    filePath.startsWith('tmp/') ||
    filePath.startsWith('coverage/') ||
    filePath.startsWith('.cache/') ||
    /redirect-audit-.*-output\.csv$/.test(filePath)
  ));

  assert.deepEqual(forbidden, []);
});
