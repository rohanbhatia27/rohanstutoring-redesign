# Pre-Live Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear every issue listed in `site/docs/pre-live-review-2026-04-24.md` so the static site is ready for a Vercel preview smoke pass and a go-live decision.

**Architecture:** Keep the app as static HTML/CSS/vanilla JS with the existing Vercel serverless API functions. Fix launch blockers first, isolate payment/webhook behavior in tests, and avoid changing business claims until Rohan confirms the source of truth.

**Tech Stack:** Static HTML, CSS, vanilla JS, Node.js `node:test`, Stripe Node SDK, Vercel serverless functions, Formspree, Cloudflare Turnstile, Google Analytics 4.

---

## Pre-Flight Guardrails

- Work from the real repo root: `/Users/rohanbhatia/Desktop/rohanstutoring-redesign/site`.
- Existing user changes are present in `quiz.html`, `css/quiz.css`, and `js/quiz.js`. Read them before editing and preserve user intent.
- Do not guess pricing, dates, enrolment status, proof counts, webhook secrets, Turnstile keys, or fulfillment delivery operations.
- Use `git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site status --short` before every task and before each commit.
- External references checked while writing this plan:
  - Stripe webhook signature verification requires the exact raw request body: https://docs.stripe.com/webhooks/signature
  - Vercel Node.js functions expose `request.body` as a lazy parsed helper, so webhook code must avoid accessing it before reading the stream: https://vercel.com/docs/functions/runtimes/node-js

## File Map

- Modify: `api/stripe-webhook.js` for raw body handling.
- Modify: `api/lib/fulfill-payment-intent.js` for honest manual fulfillment metadata unless real delivery is confirmed.
- Modify: `api/payment-intent-status.js` to return safe metadata needed by checkout success.
- Modify: `tests/stripe-webhook.test.js` for webhook raw body and fulfillment status regressions.
- Modify: `tests/checkout.test.js` for payment status metadata.
- Modify: `tests/url-normalization.test.js` for canonical resource routes, sitemap coverage, and public preview noindex checks.
- Modify: `contact.html` and `courses/private-mentoring.html` for Turnstile placeholder handling.
- Create: `js/analytics.js` and modify all HTML pages that currently inline GA.
- Modify: `vercel.json` for CSP and, if chosen, preview redirects.
- Create: `css/webinar-thanks.css`.
- Modify: `quiz.html`, `js/quiz.js`, and only if needed `css/quiz.css` for state resilience and accessible progress.
- Modify: `js/blog.js` and `blog.html` for filter selected state.
- Modify: `js/checkout.js` for upsell-aware success URLs and purchase analytics.
- Modify: `sitemap.xml` for approved public pages.
- Modify or delete: `figtree-preview.html` based on Rohan's decision.
- Modify: `js/quote-generator.js` for clipboard rejection handling.
- Remove after confirmation: `assets/.DS_Store`, `assets/temp.pdf`.
- Create: `docs/ops/manual-fulfillment.md` if fulfillment remains manual.
- Create: `docs/go-live-confirmations-2026-04-24.md` to record Rohan's business confirmations.

---

### Task 1: Lock Required Decisions Before Risky Edits

**Files:**
- Create: `docs/go-live-confirmations-2026-04-24.md`

- [x] **Step 1: Record the required confirmations**

Create `docs/go-live-confirmations-2026-04-24.md` with this checklist:

```markdown
# Go-Live Confirmations - 2026-04-24

## Security And Integrations

- [ ] Contact Turnstile: production site key to use on `contact.html`.
- [ ] Private mentoring Turnstile: production site key to use on `courses/private-mentoring.html`, or confirmation to remove the widget.
- [ ] Google Analytics: keep GA4 ID `G-H1KDZ561ZE` live, or remove GA snippets.
- [ ] Stripe fulfillment: confirm whether delivery is automated now, or mark paid orders as `manual_fulfillment_pending` and follow the manual SOP.

## Routes And SEO

- [ ] S2 Slam CTAs: use absolute `https://www.rohanstutoring.com/s2-slam-system` links, or allow root-relative `/s2-slam-system` and update the test.
- [ ] Sitemap: confirm whether `/quiz`, `/quote-generator`, `/s1-mock`, `/s2-slam-system`, `/section-1-tracker`, and `/webinar` are launch-indexable.
- [ ] `figtree-preview.html`: delete, noindex, or redirect.
- [ ] `assets/temp.pdf`: keep and name intentionally, or remove before launch.

## Business Claims

- [ ] `courses.html`: September 2026 enrolments.
- [ ] `courses/comprehensive.html`: 26 May 2026 start date and early-bird details.
- [ ] `courses/comprehensive.html`: first-8-spots claim.
- [ ] `courses.html`: sold-out/March 2027 waitlist copy.
- [ ] `webinar.html`: Sunday 7pm AEST timing.
- [ ] `index.html`: proof/count claims such as `1,300+`.
```

- [x] **Step 2: Pause implementation points that need confirmation**

Do not edit Turnstile keys, fulfillment side effects, business copy, sitemap inclusion, `figtree-preview.html`, or `assets/temp.pdf` until the relevant checkbox has a confirmed value.

- [x] **Step 3: Commit the decision checklist**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add docs/go-live-confirmations-2026-04-24.md
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "docs: add go-live confirmation checklist"
```

Expected: commit succeeds, or skip commit if the user wants one final combined commit.

---

### Task 2: Fix Stripe Webhook Raw Body Handling

**Files:**
- Modify: `api/stripe-webhook.js`
- Modify: `tests/stripe-webhook.test.js`

- [x] **Step 1: Add failing regression tests first**

Add tests covering three webhook body states:

```js
test('stripe webhook accepts an untouched Buffer payload for signature verification', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  const seenPayloads = [];
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent(payload) {
        seenPayloads.push(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));
        return { type: 'payment_intent.succeeded', data: { object: { id: 'pi_123', metadata: { product_slug: 'blueprint' } } } };
      },
    },
    paymentIntents: { update: async () => undefined },
  }));
  stripeWebhookHandler.__setFulfillPaymentIntent(async () => ({ alreadyFulfilled: false }));

  const req = {
    method: 'POST',
    headers: { 'stripe-signature': 't=123,v1=abc' },
    body: Buffer.from('{"id":"evt_123","object":"event"}'),
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(seenPayloads, ['{"id":"evt_123","object":"event"}']);
  stripeWebhookHandler.__resetForTests();
});

test('stripe webhook rejects parsed object bodies because signature verification requires raw bytes', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

  let constructEventCalled = false;
  stripeWebhookHandler.__setStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        constructEventCalled = true;
        return { type: 'payment_intent.succeeded', data: { object: { id: 'pi_123', metadata: {} } } };
      },
    },
    paymentIntents: { update: async () => undefined },
  }));

  const req = {
    method: 'POST',
    headers: { 'stripe-signature': 't=123,v1=abc' },
    body: { id: 'evt_123', object: 'event' },
  };
  const res = createJsonResponseRecorder();

  await stripeWebhookHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid Stripe webhook.' });
  assert.equal(constructEventCalled, false);
  stripeWebhookHandler.__resetForTests();
});
```

- [x] **Step 2: Run the webhook tests and verify the new parsed-body test fails**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node --test tests/stripe-webhook.test.js
```

Expected before implementation: the parsed-object test fails because current code reserializes `req.body`.

- [x] **Step 3: Implement raw-body-only reading**

Update `readRawBody(req)` so it prefers explicit raw bytes and readable streams, and throws on parsed objects:

```js
async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');

  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');

  if (req && typeof req.on === 'function') {
    const chunks = [];

    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    if (chunks.length > 0) return Buffer.concat(chunks);
  }

  throw new Error('Raw Stripe webhook body unavailable.');
}
```

Keep the handler response public: `400` with `{ error: 'Invalid Stripe webhook.' }`.

- [x] **Step 4: Verify webhook tests pass**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node --test tests/stripe-webhook.test.js
```

Expected: all webhook tests pass.

- [x] **Step 5: Commit**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add api/stripe-webhook.js tests/stripe-webhook.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: require raw Stripe webhook body"
```

---

### Task 3: Make Fulfillment Status Honest

**Files:**
- Modify: `api/lib/fulfill-payment-intent.js`
- Modify: `tests/stripe-webhook.test.js`
- Create: `docs/ops/manual-fulfillment.md`

- [x] **Step 1: Choose the confirmed fulfillment path**

If Rohan confirms real automated delivery, implement that confirmed provider. If not confirmed, use the manual path below.

- [x] **Step 2: Add tests for manual-pending metadata**

Replace assertions expecting `fulfillment_status: 'fulfilled'` with:

```js
assert.equal(updates[0].payload.metadata.fulfillment_status, 'manual_fulfillment_pending');
assert.equal(updates[0].payload.metadata.manual_fulfillment_required, 'true');
assert.equal(updates[0].payload.metadata.fulfillment_requested_at, '2026-04-19T12:00:00.000Z');
assert.equal(updates[0].payload.metadata.fulfillment_source, 'stripe-webhook');
```

Keep duplicate handling for both `fulfilled` and `manual_fulfillment_pending`:

```js
for (const status of ['fulfilled', 'manual_fulfillment_pending']) {
  // create one subtest per status and assert paymentIntents.update is not called
}
```

- [x] **Step 3: Update the fulfillment helper**

Change the metadata write in `fulfillPaymentIntent` to:

```js
fulfillment_status: 'manual_fulfillment_pending',
manual_fulfillment_required: 'true',
fulfillment_requested_at: now(),
fulfillment_source: 'stripe-webhook',
fulfillment_delivery_type: plan.deliveryType,
fulfillment_label: plan.fulfillmentLabel,
fulfillment_product_slugs: fulfillmentProductSlugs,
```

Treat already-final statuses as idempotent:

```js
const finalFulfillmentStatuses = new Set(['fulfilled', 'manual_fulfillment_pending']);
if (finalFulfillmentStatuses.has(metadata.fulfillment_status)) {
  return {
    alreadyFulfilled: true,
    plan: getFulfillmentPlan(baseSlug, upsellSlug),
  };
}
```

- [x] **Step 4: Document manual operations**

Create `docs/ops/manual-fulfillment.md`:

```markdown
# Manual Fulfillment SOP

When Stripe webhook metadata shows `fulfillment_status=manual_fulfillment_pending`, fulfill the order before marking it `fulfilled`.

## Required Stripe Metadata

- `customer_email`
- `base_slug`
- `upsell_slug`, when present
- `fulfillment_delivery_type`
- `fulfillment_label`
- `fulfillment_product_slugs`
- `fulfillment_requested_at`

## Product Actions

- `digital-access`: send the relevant Google Drive/download access email.
- `essay-submission`: send essay submission instructions.
- `booking-link`: send the mentoring booking link.
- `cohort-onboarding`: send cohort onboarding details.

## Close Out

After delivery, update the PaymentIntent metadata in Stripe:

- `fulfillment_status=fulfilled`
- `fulfilled_at=<ISO timestamp>`
- `fulfilled_by=<operator name or email>`
```

- [x] **Step 5: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node --test tests/stripe-webhook.test.js
```

Expected: all webhook tests pass.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add api/lib/fulfill-payment-intent.js tests/stripe-webhook.test.js docs/ops/manual-fulfillment.md
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: mark payments pending manual fulfillment"
```

---

### Task 4: Resolve Turnstile Placeholders

**Files:**
- Modify: `contact.html`
- Modify: `courses/private-mentoring.html`
- Modify: `tests/url-normalization.test.js`

- [x] **Step 1: Add a static regression test for placeholder keys**

Add to `tests/url-normalization.test.js`:

```js
test('public forms do not ship placeholder Turnstile site keys', () => {
  const files = ['contact.html', 'courses/private-mentoring.html'];

  for (const file of files) {
    const html = read(file);
    assert.doesNotMatch(html, /REPLACE_WITH_TURNSTILE_SITE_KEY/, `Placeholder Turnstile key found in ${file}`);
  }
});
```

- [x] **Step 2: Run test and confirm failure**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node --test tests/url-normalization.test.js
```

Expected before implementation: failure for placeholder Turnstile keys.

- [x] **Step 3: Apply the confirmed Turnstile decision**

If production keys are confirmed, replace only the placeholder values:

```html
data-sitekey="<confirmed Cloudflare Turnstile site key>"
```

If Turnstile is intentionally disabled, remove the `.cf-turnstile` block and the Cloudflare script from each affected page.

- [ ] **Step 4: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node --test tests/url-normalization.test.js
```

Expected: Turnstile placeholder test passes.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add contact.html courses/private-mentoring.html tests/url-normalization.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: remove Turnstile placeholders"
```

---

### Task 5: Make GA Compatible With CSP

**Files:**
- Create: `js/analytics.js`
- Modify: every HTML file that contains `googletagmanager.com/gtag/js`
- Modify: `vercel.json`
- Modify: `tests/url-normalization.test.js`

- [x] **Step 1: Add a static CSP/GA test**

Add:

```js
test('GA pages use external bootstrap script instead of inline GA code', () => {
  const htmlFiles = fs.readdirSync(ROOT, { recursive: true })
    .filter((file) => String(file).endsWith('.html'));

  for (const file of htmlFiles) {
    const html = read(file);
    if (html.includes('googletagmanager.com/gtag/js')) {
      assert.match(html, /<script src="(?:\.\.\/)?js\/analytics\.js" defer><\/script>|<script src="\/js\/analytics\.js" defer><\/script>/, `Missing analytics bootstrap in ${file}`);
      assert.doesNotMatch(html, /function gtag\(\)\{dataLayer\.push\(arguments\);\}/, `Inline GA bootstrap remains in ${file}`);
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
```

- [x] **Step 2: Create external GA bootstrap**

Create `js/analytics.js`:

```js
window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
window.gtag('js', new Date());
window.gtag('config', 'G-H1KDZ561ZE');
```

- [x] **Step 3: Replace inline GA snippets**

For every HTML page with GA, keep:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-H1KDZ561ZE"></script>
<script src="/js/analytics.js" defer></script>
```

Remove the inline `<script>` block that defines `dataLayer`, `gtag`, and `gtag('config', ...)`.

- [x] **Step 4: Update CSP**

Change the CSP in `vercel.json` so it includes:

```text
script-src 'self' https://cdnjs.cloudflare.com https://js.stripe.com https://f.convertkit.com https://challenges.cloudflare.com https://www.googletagmanager.com;
connect-src 'self' https://api.stripe.com https://r.stripe.com https://m.stripe.network https://q.stripe.com https://formspree.io https://app.kit.com https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com;
```

Do not add `script-src 'unsafe-inline'`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Expected: URL/static tests pass after all dependent static fixes in this task are complete.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add js/analytics.js vercel.json tests/url-normalization.test.js '*.html' blog/*.html courses/*.html checkout/*.html webinar/*.html
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: move analytics bootstrap out of inline scripts"
```

---

### Task 6: Fix S2 Slam CTA Test Mismatch

**Files:**
- Modify either HTML CTA links or `tests/url-normalization.test.js`

- [x] **Step 1: Apply the confirmed route intent**

If the confirmation says absolute production URLs are required, replace lead magnet CTA links in these files with:

```html
href="https://www.rohanstutoring.com/s2-slam-system"
```

Files:

```text
index.html
blog.html
blog/ideation.html
blog/mastering-gamsat-s2-task-a-essay.html
blog/poetry-guide.html
blog/stop-falling-for-this-common-gamsat-section-1-trap.html
blog/the-biggest-s2-mistake.html
```

If root-relative links are confirmed as intentional, update the test regex to:

```js
assert.match(
  html,
  /href="(?:https:\/\/www\.rohanstutoring\.com)?\/s2-slam-system"/,
  `Expected S2 Slam CTA to point at the dedicated signup page in ${file}`
);
```

- [ ] **Step 2: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Expected: the S2 Slam CTA test passes.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add index.html blog.html blog/*.html tests/url-normalization.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: align S2 Slam CTA routing"
```

---

### Task 7: Add Webinar Thank-You Styling

**Files:**
- Create: `css/webinar-thanks.css`
- Modify: `tests/url-normalization.test.js`

- [ ] **Step 1: Add broken stylesheet scan test**

Add:

```js
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
```

- [ ] **Step 2: Create `css/webinar-thanks.css`**

Add page-level styles for the existing `wt-*` classes. Keep it self-contained and use the existing tokens from `css/style.css`. Minimum selectors:

```css
.wt-body {}
.wt-logo-bar {}
.wt-logo-bar__link {}
.wt-logo-bar__img {}
.wt-hero {}
.wt-hero__bg {}
.wt-hero__inner {}
.wt-confirm-badge {}
.wt-headline {}
.wt-sub {}
.wt-hero__vsl {}
.wt-vsl__placeholder {}
.wt-zoom-btn {}
.wt-trust-row {}
.wt-steps {}
.wt-steps__grid {}
.wt-step {}
.wt-footer-cta {}
@media (max-width: 760px) {}
```

Do not introduce decorative orb-heavy styling; keep the page premium, clear, and mobile-stable.

- [ ] **Step 3: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/webinar/thanks.html` and verify desktop and mobile layout.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add css/webinar-thanks.css tests/url-normalization.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: add webinar thank-you styling"
```

---

### Task 8: Harden Quiz State, Lead Gate, And Progress Accessibility

**Files:**
- Modify: `quiz.html`
- Modify: `js/quiz.js`
- Modify only if visual state requires it: `css/quiz.css`

- [ ] **Step 1: Read current user changes**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site diff -- quiz.html css/quiz.css js/quiz.js
```

Preserve unrelated user edits.

- [ ] **Step 2: Make progress accessible**

In `renderQuestion()`, change progress calculation to current-question progress and update ARIA:

```js
const pct = Math.round(((state.index + 1) / total) * 100);
el.progressBar.style.setProperty('--progress', pct + '%');
el.progressBar.setAttribute('aria-valuenow', String(pct));
el.progressBar.setAttribute('aria-valuetext', `Question ${state.index + 1} of ${total}`);
el.progressLabel.textContent = `Question ${state.index + 1} of ${total}`;
```

- [ ] **Step 3: Validate persisted state before resume**

Add helpers:

```js
function isValidOutcomeId(outcomeId) {
  return Boolean(outcomeId && OUTCOMES[outcomeId]);
}

function isValidQuestionIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < QUESTIONS.length;
}

function sanitizeState() {
  if (!isValidQuestionIndex(state.index)) {
    resetState();
    return;
  }

  if (state.completed && !isValidOutcomeId(state.outcomeId)) {
    resetState();
    return;
  }

  const validQuestionKeys = new Set(QUESTIONS.map((question) => question.key));
  for (const key of Object.keys(state.answers)) {
    if (!validQuestionKeys.has(key)) delete state.answers[key];
  }
}
```

Call `sanitizeState()` immediately after `loadState()`.

- [ ] **Step 4: Guard result rendering**

At the top of `showResult(outcome)`:

```js
if (!outcome) {
  resetState();
  el.result.hidden = true;
  el.hero.style.display = '';
  el.quizSection.hidden = true;
  return;
}
```

- [ ] **Step 5: Toggle lead gate hidden states consistently**

Replace mixed `style.display` toggles with:

```js
const setSubmitLoading = (isLoading) => {
  if (btnText) btnText.hidden = isLoading;
  if (btnLoading) btnLoading.hidden = !isLoading;
  if (submitBtn) submitBtn.disabled = isLoading;
};

const showError = (msg) => {
  if (errorText) errorText.textContent = msg;
  if (errorBox) errorBox.hidden = false;
};

const hideError = () => {
  if (errorBox) errorBox.hidden = true;
};
```

Use `setSubmitLoading(true)` before fetch, `hideError()` before fetch, and `setSubmitLoading(false)` in `finally`.

- [ ] **Step 6: Manually verify failure, success, stale state, and mobile**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
python3 -m http.server 8000
```

Manual checks:

- Visit `http://127.0.0.1:8000/quiz.html`.
- Answer questions until the lead gate appears.
- Disable network or temporarily use an invalid form endpoint in dev tools, submit, and confirm the error becomes visible and button text returns.
- Set `localStorage.rohanQuizState` to `{"completed":true,"outcomeId":"missing","index":999,"answers":{"bad":"value"}}`, reload, and confirm the page does not crash.
- Confirm `aria-valuenow` changes from question to question in the Elements panel.

- [ ] **Step 7: Commit**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add quiz.html js/quiz.js css/quiz.css
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: harden quiz state and lead gate"
```

---

### Task 9: Move Vercel CLI Out Of Runtime Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Remove runtime Vercel dependency**

Change `package.json` from:

```json
"dependencies": {
  "stripe": "^17.0.0",
  "vercel": "^51.7.0"
}
```

to:

```json
"dependencies": {
  "stripe": "^17.0.0"
}
```

- [ ] **Step 2: Regenerate lockfile**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm install --package-lock-only
npm audit
```

Expected: lockfile updates; audit count drops because Vercel CLI transitive packages leave the production dependency graph.

- [ ] **Step 3: Verify tests and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add package.json package-lock.json
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "chore: remove Vercel CLI runtime dependency"
```

---

### Task 10: Preserve Upsell Context On Checkout Success

**Files:**
- Modify: `js/checkout.js`
- Modify: `api/payment-intent-status.js`
- Modify: `tests/checkout.test.js`

- [x] **Step 1: Extend payment status response safely**

In `api/payment-intent-status.js`, return only safe metadata:

```js
const metadata = intent.metadata && typeof intent.metadata === 'object' ? intent.metadata : {};
return res.status(200).json({
  status: intent.status,
  metadata: {
    base_slug: metadata.base_slug || metadata.product_slug || '',
    upsell_slug: metadata.upsell_slug || '',
  },
});
```

- [x] **Step 2: Add status endpoint test**

In `tests/checkout.test.js`, add a test that stubs Stripe retrieve and asserts:

```js
assert.deepEqual(res.body, {
  status: 'succeeded',
  metadata: {
    base_slug: 'blueprint',
    upsell_slug: 'essay-pack-10',
  },
});
```

- [x] **Step 3: Update checkout success fetch handling**

Change `fetchPaymentIntentStatus` to return the response object:

```js
async function fetchPaymentIntentStatus(paymentIntentId) {
  const response = await fetch(`/api/payment-intent-status?payment_intent=${encodeURIComponent(paymentIntentId)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Payment verification failed.');
  return payload;
}
```

In `initSuccessPage()`, derive success context from metadata:

```js
const paymentState = await fetchPaymentIntentStatus(paymentIntentId);
const status = paymentState.status;
const metadata = paymentState.metadata || {};
const successProductSlug = metadata.base_slug || productSlug;
const upsellSlug = metadata.upsell_slug || params.get('upsell') || '';
renderState(getSuccessState(status, successProductSlug));
```

- [x] **Step 4: Include upsell analytics item**

When `status === 'succeeded'`, build GA items with base and upsell:

```js
const items = [{ item_id: successProductSlug, item_name: p ? p.name : successProductSlug, price: p ? p.price : undefined, quantity: 1 }];
if (upsellSlug) {
  const upsell = PRODUCTS[upsellSlug] || ORDER_BUMPS[upsellSlug];
  items.push({ item_id: upsellSlug, item_name: upsell ? upsell.name : upsellSlug, price: upsell ? upsell.price : undefined, quantity: 1 });
}
```

- [x] **Step 5: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add js/checkout.js api/payment-intent-status.js tests/checkout.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: preserve checkout upsell success context"
```

---

### Task 11: Update Sitemap And Public Preview Handling

**Files:**
- Modify: `sitemap.xml`
- Modify: `tests/url-normalization.test.js`
- Modify, delete, or redirect: `figtree-preview.html`
- Modify if redirect chosen: `vercel.json`

- [x] **Step 1: Add sitemap coverage tests for confirmed indexable pages**

After Rohan confirms indexable pages, add:

```js
test('sitemap includes all confirmed indexable public pages', () => {
  const sitemap = read('sitemap.xml');
  const expectedUrls = [
    'https://www.rohanstutoring.com/quiz',
    'https://www.rohanstutoring.com/quote-generator',
    'https://www.rohanstutoring.com/s1-mock',
    'https://www.rohanstutoring.com/s2-slam-system',
    'https://www.rohanstutoring.com/section-1-tracker',
    'https://www.rohanstutoring.com/webinar',
  ];

  for (const url of expectedUrls) {
    assert.match(sitemap, new RegExp(`<loc>${url.replaceAll('/', '\\/')}<\\/loc>`));
  }
});
```

Remove any URLs from `expectedUrls` that Rohan confirms are not launch-indexable.

- [x] **Step 2: Add preview noindex/redirect test**

If keeping the file, require noindex:

```js
test('figtree preview is not indexable', () => {
  const html = read('figtree-preview.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});
```

If redirecting, add a `vercel.json` assertion for `/figtree-preview`.

- [x] **Step 3: Update sitemap and preview route**

Add confirmed sitemap entries with clean URLs. For `figtree-preview.html`, apply the confirmed choice:

- Delete the file if not needed.
- Add `<meta name="robots" content="noindex, nofollow">` if it must stay available.
- Add a redirect in `vercel.json` if it needs to point somewhere else.

- [x] **Step 4: Verify and commit**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add sitemap.xml tests/url-normalization.test.js figtree-preview.html vercel.json
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: align launch sitemap and preview indexing"
```

---

### Task 12: Improve Blog Filter Accessibility

**Files:**
- Modify: `blog.html`
- Modify: `js/blog.js`

- [x] **Step 1: Add ARIA state to initial buttons**

Change filters to:

```html
<button class="blog-filter active" data-filter="all" aria-pressed="true">All Posts</button>
<button class="blog-filter" data-filter="s1" aria-pressed="false">Section 1</button>
<button class="blog-filter" data-filter="s2" aria-pressed="false">Section 2</button>
<button class="blog-filter" data-filter="strategy" aria-pressed="false">Strategy</button>
```

- [x] **Step 2: Update JS selected state**

Replace:

```js
filters.forEach(f => f.classList.remove('active'));
btn.classList.add('active');
```

with:

```js
filters.forEach((filterButton) => {
  const isSelected = filterButton === btn;
  filterButton.classList.toggle('active', isSelected);
  filterButton.setAttribute('aria-pressed', String(isSelected));
});
```

- [x] **Step 3: Verify manually and commit**

Run local server and click each filter. Confirm `aria-pressed` moves with the visible active state.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add blog.html js/blog.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: expose blog filter selected state"
```

---

### Task 13: Fix Clipboard Failure Feedback

**Files:**
- Modify: `js/quote-generator.js`

- [ ] **Step 1: Add a reusable button feedback helper**

Add near `copyOutput()`:

```js
function setCopyFeedback(label, className) {
  els.copy.classList.add(className);
  els.copy.textContent = label;
  setTimeout(() => {
    els.copy.classList.remove(className);
    els.copy.textContent = 'Copy';
  }, 1500);
}
```

- [ ] **Step 2: Catch Clipboard API rejection**

Change `copyOutput()` to:

```js
function copyOutput() {
  const quotes = els.out.querySelectorAll('.qg-quote__text');
  if (!quotes.length) return;

  const text = Array.from(quotes).map((quote, index) => `${index + 1}. ${quote.textContent}`).join('\n');

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    setCopyFeedback('Copy failed', 'qg-btn--error');
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => setCopyFeedback('Copied!', 'qg-btn--copied'))
    .catch(() => setCopyFeedback('Copy failed', 'qg-btn--error'));
}
```

If `qg-btn--error` needs visual styling, add it to `css/quote-generator.css`.

- [ ] **Step 3: Verify and commit**

Run `python3 -m http.server 8000`, open `/quote-generator.html`, temporarily deny clipboard permission, and confirm the button shows failure feedback.

Commit:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add js/quote-generator.js css/quote-generator.css
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "fix: show quote copy failures"
```

---

### Task 14: Clean Accidental Assets And Review Large Files

**Files:**
- Remove: `assets/.DS_Store`
- Remove after confirmation: `assets/temp.pdf`
- Modify: `.gitignore` if `.DS_Store` is not ignored
- Create: `docs/asset-review-2026-04-24.md`

- [ ] **Step 1: Remove `.DS_Store` and prevent recurrence**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site rm --ignore-unmatch assets/.DS_Store
```

Ensure `.gitignore` contains:

```gitignore
.DS_Store
```

- [ ] **Step 2: Apply confirmed `temp.pdf` decision**

If confirmed accidental, run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site rm assets/temp.pdf
```

If confirmed intentional, rename it to a descriptive launch-safe filename and update all references.

- [ ] **Step 3: Record large asset review**

Create `docs/asset-review-2026-04-24.md`:

```markdown
# Asset Review - 2026-04-24

Files over 500 KB to review before final performance pass:

- `assets/rohan/rohan-profile-5394.webp`
- `assets/teaching-session.png`
- `assets/blog/task-a-essay-hero.webp`
- `assets/blog/poetry-guide-hero.webp`
- `assets/courses/advanced-course-card.webp`
- `assets/courses/blueprint-course-card.webp`
- `assets/courses/comprehensive-course-card.webp`
- `assets/s1-mock-cover.pdf`
- `assets/temp.pdf`, if retained

Decision: keep current assets for launch unless visual smoke or Lighthouse flags a specific blocker.
```

- [ ] **Step 4: Commit**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add .gitignore docs/asset-review-2026-04-24.md
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add -u assets
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "chore: clean launch assets"
```

---

### Task 15: Apply Confirmed Business Copy Updates

**Files:**
- Modify as confirmed: `courses.html`
- Modify as confirmed: `courses/comprehensive.html`
- Modify as confirmed: `webinar.html`
- Modify as confirmed: `index.html`
- Modify: `docs/go-live-confirmations-2026-04-24.md`

- [ ] **Step 1: Edit only confirmed claims**

Use `docs/go-live-confirmations-2026-04-24.md` as the source. Update only confirmed lines:

```text
courses.html: September 2026 enrolments
courses/comprehensive.html: 26 May 2026 start date and early-bird details
courses/comprehensive.html: first-8-spots claim
courses.html: sold-out/March 2027 waitlist copy
webinar.html: Sunday 7pm AEST timing
index.html: proof/count claims such as 1,300+
```

- [ ] **Step 2: Verify no placeholders remain**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
rg -n "REPLACE_WITH|coming shortly|Video arriving shortly|early-bird|first 8|March 2027|September 2026|1,300\\+" .
```

Expected: each result is either confirmed launch copy or an intentional non-production note documented in the confirmation file.

- [ ] **Step 3: Commit**

Run:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add courses.html courses/comprehensive.html webinar.html index.html docs/go-live-confirmations-2026-04-24.md
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "copy: apply confirmed go-live claims"
```

---

### Task 16: Full Verification And Preview Smoke Pass

**Files:**
- No planned source edits unless verification finds regressions.

- [ ] **Step 1: Run full tests**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run syntax checks for page scripts**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
for file in js/*.js api/*.js api/lib/*.js tests/*.js; do node --check "$file"; done
```

Expected: no syntax errors.

- [ ] **Step 3: Run local browser smoke**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
python3 -m http.server 8000
```

Check:

```text
/
/contact
/courses
/courses/comprehensive
/checkout/success?product=blueprint&payment_intent=pi_fake_for_ui
/quiz
/quote-generator
/webinar
/webinar/thanks.html
```

Expected: no broken layout, missing CSS, stuck loading states, or console errors caused by local code.

- [ ] **Step 4: Run Vercel preview deploy**

Run from `site/`:

```bash
vercel deploy
```

Expected: preview URL is created.

- [ ] **Step 5: Smoke preview deployment**

On the preview URL:

- Contact page renders Turnstile or intentionally has no Turnstile.
- GA script is not blocked by CSP in the console.
- Stripe checkout API endpoints respond only to allowed origins.
- Webinar thanks page loads CSS.
- Quiz lead gate error and stale localStorage checks still pass.
- Sitemap and robots are reachable.

- [ ] **Step 6: Final go-live gate**

Do not run production deploy until all of these are true:

```text
Webhook raw body tests pass.
Turnstile placeholders are gone or intentionally removed.
npm test passes.
CSP supports the chosen analytics strategy.
Webinar thanks CSS exists and renders.
Quiz lead gate and stale state are manually verified.
Business-sensitive claims are confirmed.
Preview deployment smoke pass is complete.
```

Commit any verification-only doc updates:

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add docs
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "docs: record launch verification"
```

---

## Coverage Check

- Launch blockers: covered by Tasks 2, 3, 4, 5, 7, 8, 15, and 16.
- High priority fixes: covered by Tasks 2, 3, 5, 6, 7, 8, and 15.
- Medium priority fixes: covered by Tasks 9, 10, 11, 12, and 15.
- Low priority polish: covered by Tasks 13 and 14.
- Skipped review items: covered by the preview smoke and final go-live gate in Task 16.
