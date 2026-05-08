# Launch Day Master Checklist

Canonical launch domain: `https://www.rohanstutoring.com`

## Before touching DNS

- `[ ]` Final canonical domain is confirmed as `https://www.rohanstutoring.com`
- `[ ]` Current DNS zone is exported or screenshotted
- `[ ]` Current `MX`, SPF, DKIM, and DMARC records are saved
- `[ ]` Resend verification records are saved
- `[ ]` Vercel has both apex and `www` domains configured
- `[ ]` Local tests pass: `npm test`
- `[ ]` Pre-launch git checkpoint is created
- `[ ]` Stripe live setup is confirmed
- `[ ]` PayPal launch state is decided
- `[ ]` Formspree, Kit, Tally, and Calendly settings are confirmed

## Preview check

- `[ ]` Fresh preview deploy exists
- `[ ]` Preview homepage looks correct
- `[ ]` Preview core course pages look correct
- `[ ]` Preview checkout pages load correctly
- `[ ]` Preview redirect audit passes on a real networked machine
- `[ ]` Preview smoke test is complete

## Production Vercel check

- `[ ]` `vercel deploy --prod` succeeds
- `[ ]` Production Vercel target loads before DNS cutover
- `[ ]` Homepage works on production Vercel target
- `[ ]` Core course pages work on production Vercel target
- `[ ]` Checkout works on production Vercel target
- `[ ]` Redirect audit passes on production Vercel target

## DNS cutover

- `[ ]` Google Workspace mail records are present at the active DNS host
- `[ ]` Resend verification records are present at the active DNS host
- `[ ]` Vercel web records are added correctly
- `[ ]` DNS or nameserver switch is performed

## Immediate post-cutover QA

- `[ ]` `https://www.rohanstutoring.com` loads the new site
- `[ ]` HTTP redirects to HTTPS
- `[ ]` apex redirects to the canonical host
- `[ ]` SSL certificate is valid
- `[ ]` Homepage works
- `[ ]` `/courses` works
- `[ ]` `/courses/comprehensive` works
- `[ ]` `/courses/mastery` works
- `[ ]` `/checkout/?product=blueprint` works
- `[ ]` `/checkout/?product=comprehensive` works
- `[ ]` Webinar form works
- `[ ]` Contact form works
- `[ ]` Quiz lead capture works
- `[ ]` Redirect audit passes on `https://www.rohanstutoring.com`

## Payments and email

- `[ ]` Stripe card checkout works
- `[ ]` Instalment flow works if launching with instalments
- `[ ]` PayPal works if launching with PayPal
- `[ ]` Essay-marking success page shows Tally CTA
- `[ ]` Payment confirmation email sends from `noreply@rohanstutoring.com`
- `[ ]` Inbound Google Workspace email works
- `[ ]` Outbound Google Workspace email works

## Search Console

- `[ ]` `robots.txt` is reachable
- `[ ]` `sitemap.xml` is reachable
- `[ ]` Sitemap is submitted in Search Console
- `[ ]` Homepage is inspected and indexing requested
- `[ ]` Main course pages are inspected and indexing requested

## First 24 hours

- `[ ]` Vercel logs checked
- `[ ]` Stripe events and webhooks checked
- `[ ]` PayPal events checked if PayPal is live
- `[ ]` Resend delivery checked
- `[ ]` PostHog events checked
- `[ ]` Google Analytics checked
- `[ ]` No major 404 or redirect issues detected

## If something breaks

- `[ ]` Roll back Vercel if code is broken
- `[ ]` Roll back DNS if domain routing is broken
- `[ ]` Restore mail records if email breaks
- `[ ]` Keep the site live and isolate one broken integration if possible

## Reference docs

- `docs/launch/2026-05-09-dns-email-cutover-checklist.md`
- `docs/launch/2026-05-09-preview-deploy-prep.md`
- `docs/launch/2026-05-09-launch-day-smoke-test-plan.md`
- `docs/launch/2026-05-09-production-deploy-prep.md`
- `docs/launch/2026-05-09-post-cutover-qa-sheet.md`
- `docs/launch/2026-05-09-search-console-indexing-checklist.md`
- `docs/launch/2026-05-09-first-24-hours-monitoring-sheet.md`
- `docs/launch/2026-05-09-rollback-runbook.md`
