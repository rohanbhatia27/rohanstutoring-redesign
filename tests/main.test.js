const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getCheckoutProductTrackingPayload,
  getFloatingQuizCtaRevealThreshold,
  isFloatingQuizCtaAllowedForPage,
  shouldHideFloatingQuizCtaForPath,
  shouldTrackNewsletterSignup,
} = require('../js/main.js');

test('floating quiz CTA stays hidden on excluded routes and intent-heavy pages', () => {
  const hiddenPaths = [
    '/quiz',
    '/quiz.html',
    '/quiz/',
    '/checkout',
    '/checkout/success',
    '/section-1-tracker',
    '/section-1-tracker.html',
    '/section-1-tracker/',
    '/contact',
    '/contact.html',
    '/blog',
    '/blog.html',
    '/blog/some-post',
    '/courses',
    '/courses.html',
    '/mocks',
    '/quote-generator',
    '/lead-magnets',
  ];

  for (const pathname of hiddenPaths) {
    assert.equal(
      shouldHideFloatingQuizCtaForPath(pathname),
      true,
      `Expected floating quiz CTA to stay hidden on ${pathname}`
    );
  }
});

test('floating quiz CTA stays hidden on paid course product pages', () => {
  const hiddenPaths = [
    '/courses/advanced',
    '/courses/blueprint',
    '/courses/comprehensive',
    '/courses/essay-collection',
    '/courses/essay-marking',
    '/courses/mastery',
    '/courses/private-mentoring',
    '/courses/s1-comprehensive',
    '/courses/s1-comprehensive.html',
    '/courses/s1-rescue-sprint',
    '/courses/s2-comprehensive',
    '/courses/s2-comprehensive.html',
    '/courses/s2-rescue-sprint',
    '/courses/starter-pack',
    '/courses/blueprint.html',
    '/courses/mastery/',
  ];

  for (const pathname of hiddenPaths) {
    assert.equal(
      shouldHideFloatingQuizCtaForPath(pathname),
      true,
      `Expected floating quiz CTA to stay hidden on ${pathname}`
    );
  }
});

test('floating quiz CTA is only eligible on a small allowlist of discovery pages', () => {
  const visiblePaths = ['/', '/about', '/about.html', '/uk-gamsat', '/ireland-gamsat', '/404'];

  for (const pathname of visiblePaths) {
    assert.equal(
      shouldHideFloatingQuizCtaForPath(pathname),
      false,
      `Expected floating quiz CTA to remain visible on ${pathname}`
    );
  }
});

test('floating quiz CTA page-level hook can disable an otherwise eligible page', () => {
  assert.equal(
    isFloatingQuizCtaAllowedForPage({
      pathname: '/',
      bodyDataset: { floatingQuizCta: 'off' },
    }),
    false
  );

  assert.equal(
    isFloatingQuizCtaAllowedForPage({
      pathname: '/about',
      bodyDataset: {},
      bodyClassList: { contains: () => false },
    }),
    true
  );

  assert.equal(
    isFloatingQuizCtaAllowedForPage({
      pathname: '/about',
      bodyDataset: {},
      bodyClassList: { contains: (className) => className === 'floating-quiz-cta-off' },
    }),
    false
  );
});

test('floating quiz CTA reveal threshold waits for hero CTA when present', () => {
  assert.equal(
    getFloatingQuizCtaRevealThreshold({
      heroQuizCtaBottom: 640,
      viewportHeight: 800,
    }),
    640
  );
});

test('floating quiz CTA reveal threshold falls back to a conservative viewport threshold', () => {
  assert.equal(
    getFloatingQuizCtaRevealThreshold({
      heroQuizCtaBottom: 0,
      viewportHeight: 900,
    }),
    540
  );

  assert.equal(
    getFloatingQuizCtaRevealThreshold({
      viewportHeight: 0,
    }),
    480
  );
});

test('newsletter signup analytics skip invalid form submissions', () => {
  assert.equal(
    shouldTrackNewsletterSignup({
      checkValidity: () => false,
    }),
    false
  );
});

test('newsletter signup analytics still track valid or non-validating forms', () => {
  assert.equal(
    shouldTrackNewsletterSignup({
      checkValidity: () => true,
    }),
    true
  );

  assert.equal(shouldTrackNewsletterSignup({}), true);
  assert.equal(shouldTrackNewsletterSignup(null), false);
});

test('checkout product CTA tracking payload identifies comprehensive course clicks', () => {
  const payload = getCheckoutProductTrackingPayload({
    href: '/checkout/?product=comprehensive&paymentMode=instalments',
    linkText: 'or pay $499 x 4 instalments',
    pathname: '/courses/comprehensive',
    origin: 'https://www.rohanstutoring.com',
  });

  assert.equal(payload.product_slug, 'comprehensive');
  assert.equal(payload.payment_mode, 'instalments');
  assert.equal(payload.cta_text, 'or pay $499 x 4 instalments');
  assert.equal(payload.page_path, '/courses/comprehensive');
  assert.equal(payload.destination_path, '/checkout/?product=comprehensive&paymentMode=instalments');
  assert.equal(payload.currency, 'AUD');
  assert.equal(payload.value, 1699);
  assert.deepEqual(payload.items, [{
    item_id: 'comprehensive',
    item_name: 'Comprehensive Course',
    price: 1699,
    quantity: 1,
  }]);
});

test('checkout product CTA tracking ignores unknown products and non-checkout links', () => {
  assert.equal(getCheckoutProductTrackingPayload({ href: '/courses/comprehensive' }), null);
  assert.equal(getCheckoutProductTrackingPayload({ href: '/checkout/?product=unknown' }), null);
});
