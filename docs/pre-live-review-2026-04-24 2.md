# Pre-Live Review - 2026-04-24

## Executive Summary

Status: No-go for production until launch blockers are fixed.

The subagent review found two payment/contact blockers and several high-priority launch risks. Existing checkout tests mostly pass, but the full suite is red, production CSP appears to block Google Analytics, the contact form still has a placeholder Turnstile key, and the Stripe webhook raw body handling is not safe enough for production signature verification.

No code fixes were made in this pass. Existing user changes remain untouched in:

- `quiz.html`
- `css/quiz.css`
- `js/quiz.js`

## Launch Blockers

1. Stripe webhook raw body is not reliably preserved before signature verification.
   - File: `api/stripe-webhook.js:27-45`, `api/stripe-webhook.js:76-77`
   - Risk: Stripe requires the exact raw request body for `constructEvent`. If Vercel provides a parsed body, the current fallback reserializes JSON, which can fail verification and prevent fulfillment.
   - Evidence: payment/security reviewer confirmed Buffer payload verification passes, parsed-body fallback fails signature verification.
   - Fix direction: configure Vercel/route handling so the webhook receives the raw body, then add a regression test covering parsed-body failure behavior.

2. Contact form Turnstile key is still a placeholder.
   - File: `contact.html:214`
   - Risk: main enquiry form may fail security verification in production if Formspree/Turnstile enforcement is active.
   - Current value: `REPLACE_WITH_TURNSTILE_SITE_KEY`
   - Fix direction: install the production Cloudflare Turnstile site key or remove/disable Turnstile intentionally if Formspree is not enforcing it.

## High Priority Fixes

1. Full test suite is red.
   - File: `tests/url-normalization.test.js:122`
   - Failing command: `npm test`
   - Result: 42 passed, 1 failed.
   - Failing case: `S2 Slam lead magnet CTAs point to the dedicated signup page instead of looping back to resources`
   - Current mismatch: test expects absolute `https://www.rohanstutoring.com/s2-slam-system`; pages use root-relative `/s2-slam-system`.
   - Fix direction: confirm route/link intent, then either update links to the expected absolute URL or update the test if root-relative links are intentional.

2. Webhook fulfillment marks PaymentIntents fulfilled without delivering the product.
   - File: `api/lib/fulfill-payment-intent.js:129-141`
   - Risk: metadata is updated to `fulfillment_status: fulfilled`, but there is no email delivery, Drive access grant, booking-link delivery, queue job, or durable fulfillment record.
   - Fix direction: either implement actual fulfillment side effects or rename/status this as `manual_fulfillment_pending` and document the manual operating process.

3. Production CSP appears to block Google Analytics.
   - File: `vercel.json:9`
   - Example usage: `index.html:7-12`
   - Risk: pages load `https://www.googletagmanager.com/gtag/js` and inline GA bootstrap, but CSP does not allow `googletagmanager.com`, GA collection domains, or inline scripts.
   - Fix direction: either remove GA snippets or update CSP safely with the required script/connect sources and a nonce/hash strategy if inline scripts remain.

4. Webinar thank-you page references a missing stylesheet.
   - File: `webinar/thanks.html:23`
   - Missing file: `css/webinar-thanks.css`
   - Risk: live post-registration page from `webinar.html` renders without intended page-level styling.
   - Fix direction: add the stylesheet, switch to an existing stylesheet if intentional, or remove the broken link after confirming layout.

5. Quiz lead gate loading/error states can remain hidden.
   - Files: `js/quiz.js:515-526`, `quiz.html:167`
   - Risk: `hidden` attributes are mixed with `style.display`, so failed lead submissions may not reveal errors and the disabled submit button can appear blank.
   - Fix direction: toggle `hidden` consistently, restore button state in all branches, and verify failure/success UI manually.

6. Saved quiz state can crash returning visitors.
   - File: `js/quiz.js:497-502`
   - Risk: stale localStorage can call `showResult(undefined)` or render an out-of-range question.
   - Fix direction: validate persisted `index`, `answers`, and `outcomeId`; reset state if invalid.

## Medium Priority Fixes

1. `vercel` is in runtime dependencies and drives audit noise/risk.
   - File: `package.json:7-10`
   - Command: `npm audit`
   - Result: 30 vulnerabilities, including high-severity transitive issues via Vercel CLI dependencies.
   - Fix direction: if Vercel CLI is only for deployment, move it to dev tooling or remove it from project dependencies and use external CLI.

2. Upsell success context is lost after checkout.
   - File: `js/checkout.js:365-370`, `js/checkout.js:933`, `js/checkout.js:939`
   - Risk: combined purchases like Blueprint plus essay pack may not show essay-pack instructions and analytics can under-report value/context.
   - Fix direction: fetch PaymentIntent metadata on success or include safe upsell context in the success route.

3. Sitemap omits several indexable public pages.
   - File: `sitemap.xml`
   - Omitted examples: `/quiz`, `/quote-generator`, `/s1-mock`, `/s2-slam-system`, `/section-1-tracker`, `/webinar`
   - Fix direction: decide which are launch-indexable and update sitemap accordingly.

4. `figtree-preview.html` appears publicly indexable.
   - File: `figtree-preview.html:6`
   - Risk: dev preview route can be live at `/figtree-preview` with no noindex/canonical/description.
   - Fix direction: delete, noindex, or redirect before launch.

5. Quiz progress is visual-only for assistive tech.
   - Files: `js/quiz.js:381-383`, `quiz.html:123`
   - Risk: `aria-valuenow` remains `0`.
   - Fix direction: update `aria-valuenow` and related accessible progress text on every question render.

6. Blog filters do not expose selected state.
   - Files: `blog.html:118-121`, `js/blog.js:42`
   - Risk: active category is visual only.
   - Fix direction: add/update `aria-pressed` or equivalent state on filter changes.

7. Business-sensitive claims need Rohan confirmation before go-live.
   - `courses.html:118`: September 2026 enrolments
   - `courses/comprehensive.html:222`: 26 May 2026 start date and early-bird details
   - `courses/comprehensive.html:237`: first-8-spots claim
   - `courses.html:258`: sold-out/March 2027 waitlist copy
   - `webinar.html:123`: Sunday 7pm AEST timing
   - `index.html:238`: proof/count claims such as `1,300+`

## Low Priority Polish

1. Clipboard copy can fail silently.
   - File: `js/quote-generator.js:263`
   - Fix direction: catch Clipboard API rejection and show a fallback message.

2. Public assets include likely accidental files.
   - Files: `assets/temp.pdf`, `assets/.DS_Store`
   - Fix direction: confirm whether `temp.pdf` is intentional; remove `.DS_Store`.

3. Large assets should be reviewed before final launch performance pass.
   - Files over 500 KB include:
     - `assets/rohan/rohan-profile-5394.webp`
     - `assets/teaching-session.png`
     - `assets/blog/task-a-essay-hero.webp`
     - `assets/blog/poetry-guide-hero.webp`
     - `assets/courses/advanced-course-card.webp`
     - `assets/courses/blueprint-course-card.webp`
     - `assets/courses/comprehensive-course-card.webp`
     - `assets/s1-mock-cover.pdf`
     - `assets/temp.pdf`

## Validated Areas

- Targeted checkout/webhook tests passed when run separately by the payment reviewer: 37/37.
- Existing checkout code validates product slugs and allowed upsell combinations server-side.
- PaymentIntent amount is determined server-side, not trusted from the client.
- Checkout, public config, and payment status endpoints share the same origin allow-list.
- Success URL does not leak the PaymentIntent client secret.
- JS syntax checks passed for shared/page scripts, including `main.js`, `product.js`, `contact.js`, `blog.js`, `post.js`, `quiz.js`, `s2-slam-system.js`, `quote-generator.js`, and `checkout.js`.
- Local HTML asset/link scan found one broken local stylesheet reference: `../css/webinar-thanks.css`.
- Redirect destinations in `vercel.json` resolve locally or externally.
- `robots.txt` points to the production sitemap.
- Checkout success, 404, and webinar thanks pages are marked `noindex`.

## Skipped / Not Verified

- No production Vercel deploy was run.
- No live Stripe payment smoke test was run.
- No browser screenshot pass was completed in this review.
- The visual/performance subagent did not finish; a local fallback scan covered missing CSS references, large assets, and responsive/focus CSS signals only.
- Production environment variables were not checked in Vercel.
- Business-sensitive dates, enrolment status, pricing, and proof claims were not edited because they need explicit confirmation.

## Commands Run

- `git -C site status --short`
- `git -C site diff --stat`
- `rg --files site`
- `npm test`
- `npm audit`
- `find . -name "*.html" -print`
- `rg -n "sk_live|sk_test|pk_live|pk_test|whsec_|localhost|127\\.0\\.0\\.1|debugger|console\\.log" .`
- `find assets -type f -size +500k -print`
- `find css -maxdepth 1 -type f -print`
- `rg -n "href=\"[^\"]*\\.css\"" --glob "*.html" --glob "**/*.html" .`

## Recommended Go-Live Decision

No-go until the launch blockers are fixed and verified.

Minimum go-live gate:

1. Stripe webhook raw body handling fixed and webhook tests pass.
2. Contact Turnstile key configured or intentionally removed.
3. `npm test` passes.
4. CSP either supports current analytics scripts or analytics snippets are removed.
5. Webinar thank-you stylesheet reference fixed.
6. Quiz lead gate hidden-state and stale-state bugs fixed.
7. Rohan confirms business-sensitive dates, availability, webinar timing, and proof claims.
8. Vercel preview deployment and mobile/browser smoke pass completed.
