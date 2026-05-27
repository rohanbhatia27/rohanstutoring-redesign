const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const INDEXABLE_PAGES = [
  { file: 'index.html', canonical: 'https://www.rohanstutoring.com' },
  { file: 'about.html', canonical: 'https://www.rohanstutoring.com/about' },
  { file: 'contact.html', canonical: 'https://www.rohanstutoring.com/contact' },
  { file: 'privacy.html', canonical: 'https://www.rohanstutoring.com/privacy' },
  { file: 'courses.html', canonical: 'https://www.rohanstutoring.com/courses' },
  { file: 'blog.html', canonical: 'https://www.rohanstutoring.com/blog' },
  { file: 's2-slam-system.html', canonical: 'https://www.rohanstutoring.com/s2-slam-system' },
  { file: 'courses/advanced.html', canonical: 'https://www.rohanstutoring.com/courses/advanced' },
  { file: 'courses/blueprint.html', canonical: 'https://www.rohanstutoring.com/courses/blueprint' },
  { file: 'courses/comprehensive.html', canonical: 'https://www.rohanstutoring.com/courses/comprehensive' },
  { file: 'courses/essay-collection.html', canonical: 'https://www.rohanstutoring.com/courses/essay-collection' },
  { file: 'courses/essay-marking.html', canonical: 'https://www.rohanstutoring.com/courses/essay-marking' },
  { file: 'courses/mastery.html', canonical: 'https://www.rohanstutoring.com/courses/mastery' },
  { file: 'courses/private-mentoring.html', canonical: 'https://www.rohanstutoring.com/courses/private-mentoring' },
  { file: 'courses/s1-rescue-sprint.html', canonical: 'https://www.rohanstutoring.com/courses/s1-rescue-sprint' },
  { file: 'courses/s2-rescue-sprint.html', canonical: 'https://www.rohanstutoring.com/courses/s2-rescue-sprint' },
  { file: 'courses/starter-pack.html', canonical: 'https://www.rohanstutoring.com/courses/starter-pack' },
  { file: 'blog/how-i-aced-section-1-gamsat.html', canonical: 'https://www.rohanstutoring.com/blog/how-i-aced-section-1-gamsat' },
  { file: 'blog/ideation.html', canonical: 'https://www.rohanstutoring.com/blog/ideation' },
  { file: 'blog/mastering-gamsat-s2-task-a-essay.html', canonical: 'https://www.rohanstutoring.com/blog/mastering-gamsat-s2-task-a-essay' },
  { file: 'blog/poetry-guide.html', canonical: 'https://www.rohanstutoring.com/blog/poetry-guide' },
  { file: 'blog/stop-falling-for-this-common-gamsat-section-1-trap.html', canonical: 'https://www.rohanstutoring.com/blog/stop-falling-for-this-common-gamsat-section-1-trap' },
  { file: 'blog/the-biggest-s2-mistake.html', canonical: 'https://www.rohanstutoring.com/blog/the-biggest-s2-mistake' },
];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('indexable pages declare a canonical tag that matches the clean public URL', () => {
  for (const page of INDEXABLE_PAGES) {
    const html = read(page.file);

    assert.match(
      html,
      new RegExp(`<link rel="canonical" href="${page.canonical.replaceAll('/', '\\/')}">`)
    );

    if (html.includes('property="og:url"')) {
      assert.match(
        html,
        new RegExp(`<meta property="og:url" content="${page.canonical.replaceAll('/', '\\/')}">`)
      );
    }
  }
});

test('course schema urls do not point at .html variants', () => {
  const courseFiles = [
    'courses/advanced.html',
    'courses/blueprint.html',
    'courses/comprehensive.html',
    'courses/essay-collection.html',
    'courses/essay-marking.html',
    'courses/mastery.html',
    'courses/private-mentoring.html',
    'courses/s1-rescue-sprint.html',
    'courses/s2-rescue-sprint.html',
    'courses/starter-pack.html',
  ];

  for (const file of courseFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /"url": "https:\/\/www\.rohanstutoring\.com\/courses\/[^"]+\.html"/);
  }
});

test('vercel redirects normalize .html public pages to clean URLs', () => {
  const config = JSON.parse(read('vercel.json'));
  const redirects = config.redirects.map(({ source, destination }) => `${source} -> ${destination}`);

  const expected = [
    '/about.html -> /about',
    '/contact.html -> /contact',
    '/privacy.html -> /privacy',
    '/courses.html -> /courses',
    '/blog.html -> /blog',
    '/s2-slam-system.html -> /s2-slam-system',
    '/courses/advanced.html -> /courses/advanced',
    '/courses/blueprint.html -> /courses/blueprint',
    '/courses/comprehensive.html -> /courses/comprehensive',
    '/courses/essay-collection.html -> /courses/essay-collection',
    '/courses/essay-marking.html -> /courses/essay-marking',
    '/courses/mastery.html -> /courses/mastery',
    '/courses/private-mentoring.html -> /courses/private-mentoring',
    '/courses/s1-rescue-sprint.html -> /courses/s1-rescue-sprint',
    '/courses/s2-rescue-sprint.html -> /courses/s2-rescue-sprint',
    '/courses/starter-pack.html -> /courses/starter-pack',
    '/blog/how-i-aced-section-1-gamsat.html -> /blog/how-i-aced-section-1-gamsat',
    '/blog/ideation.html -> /blog/ideation',
    '/blog/mastering-gamsat-s2-task-a-essay.html -> /blog/mastering-gamsat-s2-task-a-essay',
    '/blog/poetry-guide.html -> /blog/poetry-guide',
    '/blog/stop-falling-for-this-common-gamsat-section-1-trap.html -> /blog/stop-falling-for-this-common-gamsat-section-1-trap',
    '/blog/the-biggest-s2-mistake.html -> /blog/the-biggest-s2-mistake',
  ];

  for (const rule of expected) {
    assert.ok(redirects.includes(rule), `Missing redirect: ${rule}`);
  }
});

test('vercel cron targets are tracked API routes', () => {
  const config = JSON.parse(read('vercel.json'));
  const trackedFiles = new Set(
    execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  );

  for (const cron of config.crons || []) {
    const pathname = String(cron.path || '').split('?')[0];
    const routeFile = pathname.replace(/^\/+/, '') + '.js';
    assert.ok(trackedFiles.has(routeFile), `Vercel cron target is not tracked: ${cron.path}`);
  }
});

test('legacy booking path and lead magnet follow-up do not point to retired funnels', () => {
  const config = JSON.parse(read('vercel.json'));
  const bookingRedirect = config.redirects.find(({ source }) => source === '/book-your-gameplan');

  assert.equal(bookingRedirect, undefined);

  const mockSignupPage = read('s1-mock.html');
  assert.match(
    mockSignupPage,
    /action="https:\/\/app\.kit\.com\/forms\/8717603\/subscriptions"/,
    'S1 mock should keep the live Kit signup endpoint'
  );
  assert.doesNotMatch(
    mockSignupPage,
    /webinar/i,
    'S1 mock should not point post-signup follow-up toward the retired funnel'
  );
});

test('S2 Slam lead magnet CTAs point to the dedicated signup page instead of looping back to resources', () => {
  const files = [
    'index.html',
    'blog.html',
    'blog/ideation.html',
    'blog/mastering-gamsat-s2-task-a-essay.html',
    'blog/poetry-guide.html',
    'blog/stop-falling-for-this-common-gamsat-section-1-trap.html',
    'blog/the-biggest-s2-mistake.html',
  ];

  for (const file of files) {
    const html = read(file);
    assert.match(
      html,
      /href="(?:https:\/\/www\.rohanstutoring\.com)?\/s2-slam-system"/,
      `Expected S2 Slam CTA to point at the dedicated signup page in ${file}`
    );
    assert.doesNotMatch(
      html,
      /href="https:\/\/www\.rohanstutoring\.com\/#resources"/,
      `Expected S2 Slam CTA to stop looping back to resources in ${file}`
    );
  }
});

test('public forms do not ship placeholder Turnstile site keys', () => {
  const files = ['contact.html', 'courses/private-mentoring.html'];

  for (const file of files) {
    const html = read(file);
    assert.doesNotMatch(html, /REPLACE_WITH_TURNSTILE_SITE_KEY/, `Placeholder Turnstile key found in ${file}`);
  }
});

test('GA pages use external bootstrap script instead of inline GA code', () => {
  const htmlFiles = fs.readdirSync(ROOT, { recursive: true })
    .filter((file) => String(file).endsWith('.html'));

  for (const file of htmlFiles) {
    const html = read(file);
    if (html.includes('googletagmanager.com/gtag/js')) {
      assert.match(
        html,
        /<script src="\/js\/analytics\.js" defer><\/script>/,
        `Missing analytics bootstrap in ${file}`
      );
      assert.doesNotMatch(
        html,
        /function gtag\(\)\{dataLayer\.push\(arguments\);\}/,
        `Inline GA bootstrap remains in ${file}`
      );
    }
  }
});

test('retired webinar funnel is absent from active site code', () => {
  const forbiddenPathFragments = [
    'webinar.html',
    'webinar/thanks.html',
    'css/webinar.css',
    'css/webinar-thanks.css',
    'js/webinar.js',
  ];

  for (const fragment of forbiddenPathFragments) {
    assert.equal(fs.existsSync(path.join(ROOT, fragment)), false, `${fragment} should be removed`);
  }

  const activeFiles = fs.readdirSync(ROOT, { recursive: true })
    .map(String)
    .filter((file) => !file.startsWith('docs/'))
    .filter((file) => !file.startsWith('tests/'))
    .filter((file) => !file.startsWith('node_modules/'))
    .filter((file) => !/redirect-audit-.*-output\.csv$/.test(file))
    .filter((file) => /\.(?:html|js|json|xml|txt|csv)$/.test(file));

  for (const file of activeFiles) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /webinar|Zoom link|2790583002|Sunday at 7pm|Sunday webinar|GAMSAT Strategy Session/i,
      `Retired webinar reference remains in ${file}`
    );
  }
});

test('local stylesheet links resolve on disk', () => {
  const htmlFiles = fs.readdirSync(ROOT, { recursive: true })
    .filter((file) => String(file).endsWith('.html'));

  for (const file of htmlFiles) {
    const html = read(file);
    const hrefs = Array.from(html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map((match) => match[1]);

    for (const href of hrefs) {
      if (/^https?:\/\//.test(href)) continue;
      const resolved = href.startsWith('/')
        ? path.join(ROOT, href.slice(1))
        : path.resolve(path.dirname(path.join(ROOT, file)), href);
      assert.ok(fs.existsSync(resolved), `Missing stylesheet ${href} referenced by ${file}`);
    }
  }
});

test('CSP allows GA script and collection endpoints without unsafe inline scripts', () => {
  const config = JSON.parse(read('vercel.json'));
  const cspHeader = config.headers
    .flatMap((group) => group.headers || [])
    .find((header) => header.key === 'Content-Security-Policy');

  assert.ok(cspHeader, 'Missing Content-Security-Policy header');

  const csp = cspHeader.value;

  assert.match(csp, /script-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/us-assets\.i\.posthog\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/eu-assets\.i\.posthog\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypal\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/www\.paypalobjects\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/us\.i\.posthog\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/eu\.i\.posthog\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.paypal\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/\*\.paypalobjects\.com/);
  assert.match(csp, /script-src[^;]*https:\/\/connect\.facebook\.net/);
  assert.match(csp, /img-src[^;]*https:\/\/www\.facebook\.com/);
  assert.match(csp, /img-src[^;]*https:\/\/connect\.facebook\.net/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.facebook\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/connect\.facebook\.net/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});

test('essay marking page keeps page-specific CSS out of inline style blocks', () => {
  const html = read('courses/essay-marking.html');

  assert.doesNotMatch(html, /<style>[\s\S]*?essay-preview[\s\S]*?<\/style>/);
  assert.doesNotMatch(html, /style="display:flex;gap:12px;width:100%;max-width:560px;margin:0 auto;"/);
  assert.match(html, /class="essay-marking-cta-row"/);
});

test('public-page links no longer point at .html paths', () => {
  const files = [
    'index.html',
    'about.html',
    'blog.html',
    'blog/how-i-aced-section-1-gamsat.html',
    'blog/ideation.html',
    'blog/mastering-gamsat-s2-task-a-essay.html',
    'blog/poetry-guide.html',
    'blog/stop-falling-for-this-common-gamsat-section-1-trap.html',
    'blog/the-biggest-s2-mistake.html',
    'checkout/index.html',
    'checkout/success.html',
    'courses/advanced.html',
    'courses/blueprint.html',
    'courses/comprehensive.html',
    'courses/essay-collection.html',
    'courses/essay-marking.html',
    'courses/mastery.html',
    'courses/private-mentoring.html',
    'courses/s1-rescue-sprint.html',
    'courses/s2-rescue-sprint.html',
    'courses/starter-pack.html',
  ];

  for (const file of files) {
    const html = read(file);
    assert.doesNotMatch(
      html,
      /href="(?:\.\.\/)?(?:about|contact|courses|blog)(?:\/[^"]+)?\.html(?:[#?][^"]*)?"/,
      `Found non-canonical page link in ${file}`
    );
  }
});

test('sitemap includes all confirmed indexable public pages', () => {
  const sitemap = read('sitemap.xml');
  const expectedUrls = [
    'https://www.rohanstutoring.com/quiz',
    'https://www.rohanstutoring.com/quote-generator',
    'https://www.rohanstutoring.com/s1-mock',
    'https://www.rohanstutoring.com/s2-slam-system',
    'https://www.rohanstutoring.com/section-1-tracker',
    'https://www.rohanstutoring.com/privacy',
  ];

  for (const url of expectedUrls) {
    assert.match(sitemap, new RegExp(`<loc>${url.replaceAll('/', '\\/')}<\\/loc>`));
  }
});

test('figtree preview page is removed from the public site', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'figtree-preview.html')), false);
});
