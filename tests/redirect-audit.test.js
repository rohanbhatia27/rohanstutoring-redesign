const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  analyzeRedirectResult,
  formatRequestError,
  parseArgs,
  parseAuditList,
  traceRedirects,
  toCsvRow,
} = require('../scripts/redirect-audit.js');

const ROOT = path.resolve(__dirname, '..');

test('parseAuditList supports simple newline-separated paths', () => {
  const entries = parseAuditList('/store\n/about.html\nhttps://www.rohanstutoring.com/contact-me\n', {
    baseOrigin: 'https://www.rohanstutoring.com',
  });

  assert.deepEqual(entries, [
    {
      source: 'https://www.rohanstutoring.com/store',
      expected: '',
      label: '',
    },
    {
      source: 'https://www.rohanstutoring.com/about.html',
      expected: '',
      label: '',
    },
    {
      source: 'https://www.rohanstutoring.com/contact-me',
      expected: '',
      label: '',
    },
  ]);
});

test('parseAuditList supports csv input with source and expected columns', () => {
  const entries = parseAuditList(
    'source,expected,label\n/store/p/comprehensive,/courses/comprehensive,legacy gumroad\nhttps://www.rohanstutoring.com/contact-me,https://www.rohanstutoring.com/contact,contact\n',
    { baseOrigin: 'https://www.rohanstutoring.com' }
  );

  assert.deepEqual(entries, [
    {
      source: 'https://www.rohanstutoring.com/store/p/comprehensive',
      expected: 'https://www.rohanstutoring.com/courses/comprehensive',
      label: 'legacy gumroad',
    },
    {
      source: 'https://www.rohanstutoring.com/contact-me',
      expected: 'https://www.rohanstutoring.com/contact',
      label: 'contact',
    },
  ]);
});

test('analyzeRedirectResult marks a clean single-hop redirect as ok', () => {
  const result = analyzeRedirectResult({
    source: 'https://www.rohanstutoring.com/about.html',
    expected: 'https://www.rohanstutoring.com/about',
    hops: [
      {
        url: 'https://www.rohanstutoring.com/about.html',
        status: 308,
        location: 'https://www.rohanstutoring.com/about',
      },
      {
        url: 'https://www.rohanstutoring.com/about',
        status: 200,
        location: '',
      },
    ],
  });

  assert.equal(result.ok, 'yes');
  assert.equal(result.hopCount, 1);
  assert.equal(result.finalStatus, 200);
  assert.equal(result.finalUrl, 'https://www.rohanstutoring.com/about');
  assert.equal(result.notes, '');
});

test('analyzeRedirectResult flags redirect chains and destination mismatches', () => {
  const result = analyzeRedirectResult({
    source: 'https://www.rohanstutoring.com/store',
    expected: 'https://www.rohanstutoring.com/courses',
    hops: [
      {
        url: 'https://www.rohanstutoring.com/store',
        status: 308,
        location: 'https://www.rohanstutoring.com/store/',
      },
      {
        url: 'https://www.rohanstutoring.com/store/',
        status: 308,
        location: 'https://www.rohanstutoring.com/courses',
      },
      {
        url: 'https://www.rohanstutoring.com/courses',
        status: 200,
        location: '',
      },
    ],
  });

  assert.equal(result.ok, 'no');
  assert.equal(result.hopCount, 2);
  assert.match(result.notes, /redirect_chain/);
});

test('toCsvRow escapes commas and quotes safely', () => {
  const row = toCsvRow({
    source: 'https://www.rohanstutoring.com/store/p/comprehensive',
    expected: 'https://www.rohanstutoring.com/courses/comprehensive',
    finalUrl: 'https://www.rohanstutoring.com/courses/comprehensive',
    finalStatus: 200,
    hopCount: 1,
    ok: 'yes',
    label: 'legacy "gumroad", primary',
    notes: '',
  });

  assert.equal(
    row,
    '"https://www.rohanstutoring.com/store/p/comprehensive","https://www.rohanstutoring.com/courses/comprehensive","https://www.rohanstutoring.com/courses/comprehensive","200","1","yes","legacy ""gumroad"", primary",""'
  );
});

test('parseArgs reads timeout and quiet flags for long-running audits', () => {
  const args = parseArgs([
    'redirect-audit.launch.csv',
    '--output=redirect-report.csv',
    '--timeout-ms=2500',
    '--quiet',
  ]);

  assert.deepEqual(args, {
    inputFile: 'redirect-audit.launch.csv',
    outputFile: 'redirect-report.csv',
    baseOrigin: 'https://www.rohanstutoring.com',
    maxHops: 5,
    timeoutMs: 2500,
    quiet: true,
  });
});

test('traceRedirects aborts stalled fetches after the configured timeout', async () => {
  const started = Date.now();

  await assert.rejects(
    traceRedirects('https://www.rohanstutoring.com/store', {
      timeoutMs: 25,
      fetchImpl(url, options) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error(`stalled request aborted for ${url}`);
            error.name = 'AbortError';
            reject(error);
          });
        });
      },
    }),
    /timeout_25ms/
  );

  assert.ok(Date.now() - started < 500, 'Timeout handling should fail fast');
});

test('formatRequestError keeps useful network cause details', () => {
  const error = new TypeError('fetch failed');
  error.cause = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND www.rohanstutoring.com' };

  assert.equal(
    formatRequestError(error),
    'fetch_failed:ENOTFOUND'
  );
});

test('launch redirect audit csv covers legacy redirects and high-risk money paths', () => {
  const csv = fs.readFileSync(path.join(ROOT, 'redirect-audit.launch.csv'), 'utf8');
  const entries = parseAuditList(csv, {
    baseOrigin: 'https://www.rohanstutoring.com',
  });

  assert.ok(entries.length >= 30, 'Expected a substantial launch checklist');

  const bySource = new Map(entries.map((entry) => [entry.source, entry]));

  assert.equal(
    bySource.get('https://www.rohanstutoring.com/store/p/comprehensive')?.expected,
    'https://www.rohanstutoring.com/courses/comprehensive'
  );
  assert.equal(bySource.has('https://www.rohanstutoring.com/book-your-gameplan'), false);
  assert.equal(
    bySource.get('https://www.rohanstutoring.com/checkout/?product=comprehensive')?.expected,
    'https://www.rohanstutoring.com/checkout/?product=comprehensive'
  );
  assert.equal(
    bySource.get('https://www.rohanstutoring.com/checkout/?product=mastery')?.expected,
    'https://www.rohanstutoring.com/checkout/?product=mastery'
  );
  assert.equal(
    bySource.get('https://www.rohanstutoring.com/checkout/?product=essay-marking')?.expected,
    'https://www.rohanstutoring.com/checkout/?product=essay-marking'
  );
  assert.equal(
    bySource.get('https://www.rohanstutoring.com/checkout/success?product=comprehensive')?.expected,
    'https://www.rohanstutoring.com/checkout/success?product=comprehensive'
  );
  assert.equal(bySource.has('https://www.rohanstutoring.com/webinar/thanks'), false);
  assert.equal(
    bySource.get('https://www.rohanstutoring.com/courses/private-mentoring')?.expected,
    'https://www.rohanstutoring.com/courses/private-mentoring'
  );
});
