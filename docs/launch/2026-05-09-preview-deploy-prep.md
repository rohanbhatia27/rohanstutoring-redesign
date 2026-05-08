# Preview Deploy Prep

Date: `2026-05-09`
Canonical domain assumed: `https://www.rohanstutoring.com`

## Current Vercel state

- Production alias currently inspected:
  - `https://rohanstutoring-redesign.vercel.app`
- Current production deployment behind that alias at inspection time:
  - `https://rohanstutoring-redesign-e7wd6mrzg.vercel.app`
- Fresh preview deployment created from the current local worktree:
  - `https://rohanstutoring-redesign-f9fcdf5l7.vercel.app`
- Fresh preview inspect URL:
  - `https://vercel.com/rohanbhatia2709-8101s-projects/rohanstutoring-redesign/yBw5L6NY9KWBrkUYjVPnzgLc2afU`

## Important preview caveat

The project's `rohanstutoring-redesign.vercel.app` alias is currently a production target, not a disposable preview slot. Use the fresh preview URL when testing unreleased changes.

## Current verification state

- `npm test` passes locally: `148/148`
- Fresh preview deploy completed successfully
- Redirect audit against the fresh preview URL could not be verified from this sandbox because DNS resolution returned `ENOTFOUND`
- Earlier user-side audit against the public Vercel alias returned `bad rows: 0`

## Preview environment variable coverage

Present in Preview:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_COMPREHENSIVE_INSTALMENT`
- `STRIPE_PRICE_MASTERY_INSTALMENT`

Not visible in Preview from `vercel env ls`:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_API_BASE`
- `RESEND_API_KEY`
- `POSTHOG_PUBLIC_KEY`
- `POSTHOG_HOST`
- `ESSAY_UPLOAD_TOKEN_SECRET`

Implication:

- Preview is good for page QA, routing QA, checkout rendering, and Stripe-path validation
- Preview is not a faithful environment for PayPal, Resend, or analytics verification unless those vars are added to Preview first

## Preview deploy command sequence

Run from `site/`:

```bash
git status --short --branch
npm test
vercel deploy
```

After Vercel returns a preview URL:

```bash
npm run audit:redirects -- redirect-audit.launch.csv --origin=https://YOUR-PREVIEW-URL --output=redirect-audit-preview-output.csv --timeout-ms=3000
```

## What must be checked on the preview URL

- Homepage loads and primary CTA buttons work
- All core course pages load
- Legacy redirect list resolves cleanly
- Checkout renders for every major product slug
- Checkout success pages render base states cleanly
- Contact, webinar, quiz, and tracker pages load with no layout breakage
- Forms render and submit UX is sane, even if downstream integrations are environment-limited

## Recommended preview test URL set

- `/`
- `/courses`
- `/courses/comprehensive`
- `/courses/mastery`
- `/courses/blueprint`
- `/courses/advanced`
- `/courses/essay-collection`
- `/courses/essay-marking`
- `/courses/private-mentoring`
- `/webinar`
- `/webinar/thanks`
- `/quiz`
- `/contact`
- `/checkout/?product=comprehensive`
- `/checkout/?product=mastery`
- `/checkout/?product=blueprint`
- `/checkout/?product=essay-marking`
- `/checkout/?product=private-mentoring`

## Preview signoff

- Latest preview URL: `_____`
- Tests passed before deploy: `yes / no`
- Redirect audit passed on a real networked machine: `yes / no`
- Preview smoke test passed: `yes / no`
