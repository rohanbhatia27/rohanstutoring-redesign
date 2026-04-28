const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldHideFloatingQuizCtaForPath,
  shouldTrackNewsletterSignup,
} = require('../js/main.js');

test('floating quiz CTA stays hidden on existing excluded routes', () => {
  const hiddenPaths = [
    '/quiz',
    '/quiz.html',
    '/quiz/',
    '/checkout',
    '/checkout/success',
    '/webinar',
    '/webinar.html',
    '/webinar/thanks',
    '/section-1-tracker',
    '/section-1-tracker.html',
    '/section-1-tracker/',
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
    '/courses/s1-rescue-sprint',
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

test('floating quiz CTA still shows on non-product pages', () => {
  const visiblePaths = [
    '/',
    '/about',
    '/blog',
    '/courses',
    '/courses.html',
    '/contact',
  ];

  for (const pathname of visiblePaths) {
    assert.equal(
      shouldHideFloatingQuizCtaForPath(pathname),
      false,
      `Expected floating quiz CTA to remain visible on ${pathname}`
    );
  }
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
