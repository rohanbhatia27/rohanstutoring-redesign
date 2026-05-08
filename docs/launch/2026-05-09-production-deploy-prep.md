# Production Deploy Prep

Canonical domain assumed: `https://www.rohanstutoring.com`

## Current known-good checkpoints

- Local tests pass: `148/148`
- Fresh preview deploy completed:
  - `https://rohanstutoring-redesign-f9fcdf5l7.vercel.app`
- Production alias currently points at:
  - `https://rohanstutoring-redesign.vercel.app`

## Pre-prod safety checks

- `git status --short --branch` shows only intentional launch files
- `npm test` passes
- final canonical domain decision is locked
- `robots.txt`, sitemap, canonical tags, and webinar redirect target align with that domain
- payment env vars are confirmed live in Production
- DNS and Google Workspace cutover notes are ready
- rollback target commit or deployment ID is written down

## Production deploy command sequence

Run from `site/`:

```bash
git status --short --branch
npm test
vercel deploy --prod
```

If you want to inspect the resulting deployment:

```bash
vercel inspect rohanstutoring-redesign.vercel.app
```

## Immediately after production deploy, before DNS cutover

- Open the production Vercel alias
- Re-run the redirect audit against the alias if it reflects the new deployment
- Smoke-test the critical pages and checkout routes
- Confirm that no production-only integration is failing silently

## Production-only caveats to verify

- `RESEND_API_KEY` exists only in Production right now
- `PAYPAL_*` vars are present in Production right now
- `POSTHOG_*` vars are present in Production right now
- Preview results are not enough for those integrations

## Safe deploy gate

Do not point the domain until all are true:

- tests green
- preview smoke passed
- production Vercel deploy succeeded
- checkout loads on the production Vercel target
- redirect mapping is green on the production Vercel target
- rollback plan is documented

## Rollback shortcuts

- Vercel rollback command:
  - `vercel rollback <deployment-url-or-id>`
- DNS rollback:
  - restore previous web DNS records or nameservers
- Mail rollback:
  - restore previous `MX`, SPF, DKIM, and DMARC records
