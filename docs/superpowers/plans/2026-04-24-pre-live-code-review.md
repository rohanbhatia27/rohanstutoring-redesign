# Pre-Live Code Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a full pre-live review of the `site/` repo and produce a prioritized launch-readiness report with any required fixes clearly separated from nice-to-have polish.

**Architecture:** The site is a static HTML/CSS/vanilla JS project served from `site/`, with Vercel configuration in `site/vercel.json` and a small Node API surface under `site/api/` for Stripe checkout/webhook flows. The review should verify static routes, shared and page-level CSS/JS, payment behavior, redirects, metadata, accessibility, responsive quality, and deployment safety without introducing new frameworks or build tooling.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in test runner, Stripe Node SDK, Vercel static hosting/serverless functions, local preview via `python3 -m http.server 8000`.

---

## Current Repo Notes

- Actual app root: `site/`
- Current uncommitted files before review starts:
  - `site/quiz.html`
  - `site/css/quiz.css`
  - `site/js/quiz.js`
- Test command: `npm test` from `site/`
- Local preview command: `python3 -m http.server 8000` from `site/`
- Existing test files:
  - `site/tests/checkout.test.js`
  - `site/tests/stripe-webhook.test.js`
  - `site/tests/url-normalization.test.js`
- Important config:
  - `site/vercel.json`
  - `site/package.json`
  - `site/robots.txt`
  - `site/sitemap.xml`

## Review Output

Create a final report at `site/docs/pre-live-review-2026-04-24.md` with these sections:

- `Executive Summary`
- `Launch Blockers`
- `High Priority Fixes`
- `Medium Priority Fixes`
- `Low Priority Polish`
- `Validated Areas`
- `Skipped / Not Verified`
- `Recommended Go-Live Decision`

Do not change pricing, product availability, dates, enrolment status, or redirect intent unless there is clear source context in the repo or Rohan explicitly confirms it.

---

### Task 1: Establish Review Baseline

**Files:**
- Read: `site/package.json`
- Read: `site/vercel.json`
- Read: current git status and diff
- Create: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Record current worktree state**

Run from workspace root:

```bash
git -C site status --short
git -C site diff --stat
```

Expected: note any modified files in the review report. Do not revert or overwrite uncommitted user changes.

- [ ] **Step 2: Record repo shape**

Run:

```bash
rg --files site
```

Expected: list page families, shared assets, API files, tests, and Vercel config in the report.

- [ ] **Step 3: Create the review report skeleton**

Create `site/docs/pre-live-review-2026-04-24.md` with:

```markdown
# Pre-Live Review - 2026-04-24

## Executive Summary

Status: In progress.

## Launch Blockers

None recorded yet.

## High Priority Fixes

None recorded yet.

## Medium Priority Fixes

None recorded yet.

## Low Priority Polish

None recorded yet.

## Validated Areas

None recorded yet.

## Skipped / Not Verified

None recorded yet.

## Recommended Go-Live Decision

Pending review.
```

- [ ] **Step 4: Commit the report skeleton only if requested**

Default: do not commit. If Rohan asks for commits, use:

```bash
git -C site add docs/pre-live-review-2026-04-24.md
git -C site commit -m "docs: add pre-live review report"
```

---

### Task 2: Automated Test and Dependency Review

**Files:**
- Read: `site/package.json`
- Read: `site/package-lock.json`
- Read: `site/tests/*.test.js`
- Read: `site/api/*.js`
- Read: `site/api/lib/*.js`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Run existing test suite**

Run from `site/`:

```bash
npm test
```

Expected: all Node tests pass. If any fail, record exact failing test names and stack traces under `Launch Blockers` or `High Priority Fixes`.

- [ ] **Step 2: Review test coverage intent**

Read:

```bash
sed -n '1,240p' tests/checkout.test.js
sed -n '1,260p' tests/stripe-webhook.test.js
sed -n '1,220p' tests/url-normalization.test.js
```

Expected: identify whether checkout product validation, webhook signature handling, fulfillment idempotency, and URL normalization are covered.

- [ ] **Step 3: Check dependency risk**

Run from `site/`:

```bash
npm audit
```

Expected: no critical or high vulnerabilities. Record moderate vulnerabilities as `Medium Priority Fixes` unless they affect Stripe/payment or deploy-time safety.

- [ ] **Step 4: Review runtime dependency minimality**

Read:

```bash
sed -n '1,220p' package.json
```

Expected: confirm dependencies remain limited to intentional runtime needs. Record any unnecessary dependency as low priority unless it affects security.

---

### Task 3: Static Route, Link, and Asset Integrity

**Files:**
- Read: all `site/**/*.html`
- Read: `site/assets/**`
- Read: `site/sitemap.xml`
- Read: `site/robots.txt`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Inventory HTML routes**

Run:

```bash
find . -name "*.html" -print | sort
```

Expected: every important public page is known before manual review starts.

- [ ] **Step 2: Check local asset references**

Search:

```bash
rg -n "src=\"|href=\"" --glob "*.html" .
```

Expected: identify missing local CSS, JS, image, favicon, PDF, and internal page references. External URLs should be intentionally external.

- [ ] **Step 3: Check internal route consistency**

Compare:

```bash
sed -n '1,260p' vercel.json
sed -n '1,240p' sitemap.xml
```

Expected: sitemap URLs, clean URLs, old `.html` redirects, store redirects, and campaign redirects agree with the actual file structure.

- [ ] **Step 4: Review temporary or accidental assets**

Inspect suspicious assets:

```bash
ls -lh assets
```

Expected: confirm whether `assets/temp.pdf` is intentional. Record accidental files as `Medium Priority Fixes` before launch.

---

### Task 4: Security, Headers, and Configuration Review

**Files:**
- Read: `site/vercel.json`
- Read: `site/api/create-payment-intent.js`
- Read: `site/api/payment-intent-status.js`
- Read: `site/api/public-config.js`
- Read: `site/api/stripe-webhook.js`
- Read: `site/api/lib/fulfill-payment-intent.js`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Review CSP and security headers**

Read:

```bash
sed -n '1,220p' vercel.json
```

Expected: CSP allows only required services: Stripe, Kit/ConvertKit, Formspree, Cloudflare challenges, Google Fonts, and local assets. Record missing services as blockers only if they break real production flows.

- [ ] **Step 2: Search for secret leakage and dev URLs**

Run:

```bash
rg -n "sk_live|sk_test|pk_live|pk_test|whsec_|localhost|127\\.0\\.0\\.1|debugger|console\\.log" .
```

Expected: no committed Stripe secrets, webhook secrets, or debug-only code. Test fixtures are acceptable only inside tests.

- [ ] **Step 3: Review environment variable expectations**

Read each API file and list required env vars in the report.

Expected: every required production env var is known, including Stripe secret key, webhook secret, publishable key, and any fulfillment or email/list settings used by the code.

- [ ] **Step 4: Review error disclosure**

Inspect API responses.

Expected: user-facing errors should be helpful but should not expose secrets, stack traces, raw webhook internals, or payment implementation details.

---

### Task 5: Stripe Checkout and Fulfillment Review

**Files:**
- Read: `site/js/checkout.js`
- Read: `site/checkout/index.html`
- Read: `site/checkout/success.html`
- Read: `site/api/create-payment-intent.js`
- Read: `site/api/payment-intent-status.js`
- Read: `site/api/stripe-webhook.js`
- Read: `site/api/lib/fulfill-payment-intent.js`
- Read: `site/tests/checkout.test.js`
- Read: `site/tests/stripe-webhook.test.js`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Review product identifier flow**

Trace each product slug from CTA links to checkout JS to API validation.

Expected: product slugs are accepted only when intentionally configured, invalid slugs fail safely, and checkout copy matches the linked course/product.

- [ ] **Step 2: Review client-side payment states**

Read:

```bash
sed -n '1,280p' js/checkout.js
```

Expected: loading, validation, Stripe load failure, payment failure, success redirect, and disabled-button states are handled cleanly.

- [ ] **Step 3: Review webhook safety**

Read:

```bash
sed -n '1,260p' api/stripe-webhook.js
sed -n '1,280p' api/lib/fulfill-payment-intent.js
```

Expected: webhook signature verification, idempotency, paid-status checks, metadata use, and fulfillment failure handling are launch-ready.

- [ ] **Step 4: Manual payment smoke test in non-production mode**

Only after confirming environment safety, exercise checkout locally or on preview with Stripe test mode.

Expected: test payment creates an expected intent, reaches success page, and does not use live payment credentials during review.

---

### Task 6: JavaScript Behavior Review

**Files:**
- Read: `site/js/main.js`
- Read: `site/js/product.js`
- Read: `site/js/contact.js`
- Read: `site/js/blog.js`
- Read: `site/js/post.js`
- Read: `site/js/quiz.js`
- Read: `site/js/s2-slam-system.js`
- Read: `site/js/quote-generator.js`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Review shared interactions**

Read:

```bash
sed -n '1,280p' js/main.js
```

Expected: navigation, menu toggles, scroll behavior, and shared progressive enhancements work without assuming missing DOM nodes.

- [ ] **Step 2: Review page-specific scripts**

Read each page script and check for:

```text
Missing null guards
State reset bugs
Keyboard traps
Uncaught promise errors
Storage assumptions
Network failure handling
Mobile-only interaction gaps
```

Expected: scripts fail gracefully on pages where their target elements are absent.

- [ ] **Step 3: Review current quiz changes carefully**

Read the uncommitted files:

```bash
git diff -- quiz.html css/quiz.css js/quiz.js
```

Expected: quiz behavior, accessibility, and responsive layout remain correct. Since these are existing uncommitted changes, do not overwrite them without explicit approval.

---

### Task 7: CSS, Responsive, and Visual System Review

**Files:**
- Read: `site/css/style.css`
- Read: all `site/css/*.css`
- Read: representative HTML pages
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Review global design tokens and shared styles**

Read:

```bash
sed -n '1,320p' css/style.css
```

Expected: typography, colors, spacing, buttons, nav, footer, and layout primitives are consistent and not overloaded with page-specific rules.

- [ ] **Step 2: Review page-level CSS ownership**

Read each `site/css/*.css`.

Expected: page-specific selectors live in page CSS files; shared patterns live globally only when they are genuinely reused.

- [ ] **Step 3: Run desktop and mobile visual QA**

Start local server from `site/`:

```bash
python3 -m http.server 8000
```

Open these pages at `http://127.0.0.1:8000/` and inspect at `390x844`, `768x1024`, `1440x1000`:

```text
/
/courses
/courses/blueprint
/courses/comprehensive
/courses/private-mentoring
/checkout
/quiz
/blog
/blog/how-i-aced-section-1-gamsat
/contact
/webinar
/s2-slam-system
```

Expected: no overlapping text, broken nav, horizontal scrolling, cropped CTAs, invisible focus states, broken images, or layout jumps.

- [ ] **Step 4: Record screenshots for any issue**

For every visual defect, capture the route, viewport, browser, and exact reproduction steps in the report.

---

### Task 8: Accessibility and Usability Review

**Files:**
- Read: all public HTML files
- Read: all CSS files affecting focus/contrast/layout
- Read: all JS files affecting interaction
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Check semantic page structure**

For each key page, verify:

```text
One meaningful h1
Logical heading order
Useful page title
Landmark structure
No important content only in images
```

Expected: screen reader users can understand each page structure.

- [ ] **Step 2: Check forms and inputs**

Review contact, checkout, quiz, webinar, S1 mock, quote generator, and Kit/Formspree embeds.

Expected: labels or accessible names exist, validation states are understandable, required fields are clear, and submit buttons communicate progress.

- [ ] **Step 3: Keyboard-only pass**

Manual test each key interactive flow using Tab, Shift+Tab, Enter, Escape, and Space.

Expected: every interactive control is reachable, focus is visible, menus can be closed, and no component traps focus.

- [ ] **Step 4: Motion and readability pass**

Check CSS and JS for animation.

Expected: animations are not disruptive; if significant motion exists, confirm `prefers-reduced-motion` handling or record a fix.

---

### Task 9: SEO, Metadata, and Content Integrity Review

**Files:**
- Read: all public HTML files
- Read: `site/sitemap.xml`
- Read: `site/robots.txt`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Review metadata completeness**

For each public page, check:

```text
title
meta description
canonical URL
Open Graph title
Open Graph description
Open Graph image where relevant
favicon links
schema where already present
```

Expected: no missing core metadata on key conversion pages.

- [ ] **Step 2: Review indexability**

Compare `robots.txt`, `sitemap.xml`, and public route list.

Expected: launch pages are discoverable, obsolete pages redirect, and no private/test pages are accidentally promoted in sitemap.

- [ ] **Step 3: Review business-sensitive copy**

Search for prices, dates, enrolment status, guarantees, deadlines, and offer claims.

```bash
rg -n "\\$|price|pricing|enrol|enroll|deadline|guarantee|limited|cohort|starts|start date|sold out|closed|open" --glob "*.html" .
```

Expected: record anything requiring Rohan confirmation. Do not edit these facts without confirmation.

---

### Task 10: Performance and Asset Review

**Files:**
- Read: `site/assets/**`
- Read: HTML files using large images/PDFs
- Read: CSS files loading fonts/images
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Identify large assets**

Run from `site/`:

```bash
find assets -type f -size +500k -print
```

Expected: list large files and whether they are required on launch-critical pages.

- [ ] **Step 2: Check image loading behavior**

Inspect image tags on key pages.

Expected: below-the-fold images use lazy loading where appropriate, hero images are not accidentally lazy-loaded, dimensions/aspect-ratio are stable enough to avoid layout shift.

- [ ] **Step 3: Check third-party scripts**

Search:

```bash
rg -n "<script|cdnjs|stripe|formspree|kit|convertkit|cloudflare" --glob "*.html" .
```

Expected: every third-party script is required, allowed by CSP, and loaded only on pages that need it where practical.

---

### Task 11: Deployment and Redirect Readiness

**Files:**
- Read: `site/vercel.json`
- Read: `site/package.json`
- Read: `site/sitemap.xml`
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Verify Vercel routing assumptions**

Review:

```bash
sed -n '1,260p' vercel.json
```

Expected: clean URLs, permanent redirects, temporary Zoom/webinar redirect, headers, and checkout/API paths work together.

- [ ] **Step 2: Validate old URL behavior**

Manually test a sample of old URLs locally where possible and on Vercel preview before production:

```text
/store
/store/p/rohans-gamsat-blueprint-the-full-package
/private-mentoring
/book-your-gameplan
/about.html
/courses/blueprint.html
/blog/ideation.html
/webinar-thanks
```

Expected: redirects land on intentional destinations. Do not change redirect intent without confirmation.

- [ ] **Step 3: Preview deployment check**

Only when local blockers are fixed, deploy a preview from `site/`:

```bash
vercel deploy
```

Expected: preview deploy succeeds. Record preview URL and any Vercel warnings in the report.

- [ ] **Step 4: Production readiness gate**

Before `vercel deploy --prod`, confirm:

```text
No launch blockers remain
High priority fixes are either resolved or explicitly accepted
Payment smoke test passed in test mode
Critical pages passed mobile review
Vercel production env vars are confirmed
Redirects are approved
Sitemap and robots are approved
```

Expected: final report says either `Go`, `Go with accepted risks`, or `No-go`.

---

### Task 12: Fix Pass and Final Verification

**Files:**
- Modify only files needed to resolve confirmed issues
- Update: `site/docs/pre-live-review-2026-04-24.md`

- [ ] **Step 1: Prioritize issues**

Use this severity rule:

```text
Launch Blocker: breaks purchase, lead capture, core navigation, deploy, security, or legal/business truth.
High Priority: materially hurts conversion, trust, mobile use, accessibility, SEO, or payment confidence.
Medium Priority: visible quality issue or maintainability risk that does not block launch.
Low Priority: polish that can wait until after launch.
```

- [ ] **Step 2: Fix blockers first**

Make the smallest safe change per issue. After each fix, update the report with:

```text
Issue
Files changed
Verification command or manual route
Result
Residual risk
```

- [ ] **Step 3: Re-run verification**

Run from `site/`:

```bash
npm test
npm audit
```

Then repeat manual checks for any route touched by fixes.

Expected: all tests pass, no critical/high audit findings, fixed pages verified at mobile and desktop sizes.

- [ ] **Step 4: Final report update**

Set `Recommended Go-Live Decision` to one of:

```text
Go
Go with accepted risks
No-go
```

Include a concise reason and the remaining issue list.

---

## Suggested Execution Order

1. Task 1: baseline and report skeleton
2. Task 2: tests and dependencies
3. Task 4: security/config
4. Task 5: Stripe checkout and fulfillment
5. Task 3: routes, links, assets
6. Task 6: JavaScript behavior
7. Task 7: responsive/visual QA
8. Task 8: accessibility/usability
9. Task 9: SEO/content integrity
10. Task 10: performance/assets
11. Task 11: deployment/redirect readiness
12. Task 12: fixes and final verification

## Self-Review

- Spec coverage: The plan covers code, tests, dependencies, static routes, redirects, Vercel config, Stripe/API behavior, JavaScript, CSS, visual QA, accessibility, SEO, content risk, assets, and deployment readiness.
- Placeholder scan: No task uses `TBD`, vague edge-case instructions, or unspecified test expectations.
- Scope control: The plan does not authorize changes to pricing, enrolment status, product facts, or redirect intent without confirmation.
