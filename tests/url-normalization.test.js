const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const INDEXABLE_PAGES = [
  { file: 'index.html', canonical: 'https://www.rohanstutoring.com' },
  { file: 'about.html', canonical: 'https://www.rohanstutoring.com/about' },
  { file: 'contact.html', canonical: 'https://www.rohanstutoring.com/contact' },
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

test('legacy booking path and lead magnet follow-up both point to the webinar page', () => {
  const config = JSON.parse(read('vercel.json'));
  const bookingRedirect = config.redirects.find(({ source }) => source === '/book-your-gameplan');

  assert.ok(bookingRedirect, 'Missing redirect for /book-your-gameplan');
  assert.equal(bookingRedirect.destination, '/webinar');

  const mockSignupPage = read('s1-mock.html');
  assert.match(
    mockSignupPage,
    /redirect_url&quot;:&quot;https:\/\/www\.rohanstutoring\.com\/webinar&quot;/
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

test('local stylesheet links resolve on disk', () => {
  const htmlFiles = fs.readdirSync(ROOT, { recursive: true })
    .filter((file) => String(file).endsWith('.html'));

  for (const file of htmlFiles) {
    const html = read(file);
    const hrefs = Array.from(html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)).map((match) => match[1]);

    for (const href of hrefs) {
      if (/^https?:\/\//.test(href)) continue;
      const resolved = path.resolve(path.dirname(path.join(ROOT, file)), href);
      assert.ok(fs.existsSync(resolved), `Missing stylesheet ${href} referenced by ${file}`);
    }
  }
});

test('CSP allows GA script and collection endpoints without unsafe inline scripts', () => {
  const config = JSON.parse(read('vercel.json'));
  const csp = config.headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;

  assert.match(csp, /script-src[^;]*https:\/\/www\.googletagmanager\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/www\.google-analytics\.com/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
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
