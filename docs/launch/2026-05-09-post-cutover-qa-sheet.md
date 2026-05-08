# Post-Cutover QA Sheet

Canonical domain assumed: `https://www.rohanstutoring.com`

Use this as a pass/fail sheet immediately after the domain points at Vercel.

## Routing and SSL

- `[ ]` `https://www.rohanstutoring.com` loads correctly
- `[ ]` `http://www.rohanstutoring.com` redirects to HTTPS
- `[ ]` apex host redirects to canonical host
- `[ ]` SSL certificate is valid with no browser warning

## Core pages

- `[ ]` Home
- `[ ]` Courses
- `[ ]` About
- `[ ]` Contact
- `[ ]` Webinar
- `[ ]` Webinar thank-you
- `[ ]` Quiz
- `[ ]` Blog

## Revenue pages

- `[ ]` Comprehensive
- `[ ]` Mastery
- `[ ]` Blueprint
- `[ ]` Advanced
- `[ ]` Essay Collection
- `[ ]` Essay Marking
- `[ ]` Private Mentoring
- `[ ]` Starter Pack

## Checkout

- `[ ]` `/checkout/?product=comprehensive`
- `[ ]` `/checkout/?product=mastery`
- `[ ]` `/checkout/?product=blueprint`
- `[ ]` `/checkout/?product=advanced`
- `[ ]` `/checkout/?product=essay-marking`
- `[ ]` `/checkout/?product=private-mentoring`
- `[ ]` Stripe Elements loads
- `[ ]` Terms checkbox gating works
- `[ ]` Instalment option appears only where expected
- `[ ]` PayPal visibility matches the intended launch state

## Success destinations

- `[ ]` Stripe success route loads
- `[ ]` Instalment success route loads
- `[ ]` Essay-marking success route shows Tally CTA
- `[ ]` Private mentoring success route preserves package context
- `[ ]` PayPal success route verifies correctly if PayPal is live

## Lead-gen and forms

- `[ ]` Contact form submits
- `[ ]` Webinar form submits and redirects to `/webinar/thanks`
- `[ ]` Quiz lead gate submits
- `[ ]` Section 1 tracker form submits
- `[ ]` S1 mock form submits
- `[ ]` Calendly link opens

## Email and fulfillment

- `[ ]` Google Workspace inbox receives mail
- `[ ]` Payment confirmation email sends from `noreply@rohanstutoring.com`
- `[ ]` Essay-marking fallback email address is correct
- `[ ]` No SPF, DKIM, or DMARC issues observed in test messages

## Redirects

- `[ ]` Launch redirect audit returns `bad rows: 0`
- `[ ]` Legacy `/store/*` routes land correctly
- `[ ]` Legacy `.html` routes land correctly
- `[ ]` Webinar legacy paths land correctly

## Analytics and tracking

- `[ ]` GA requests fire
- `[ ]` PostHog requests fire
- `[ ]` checkout submission event fires
- `[ ]` newsletter or webinar signup event fires

## SEO and metadata

- `[ ]` `robots.txt` is reachable
- `[ ]` `sitemap.xml` is reachable
- `[ ]` homepage canonical is correct
- `[ ]` course page canonicals are correct

## Final status

- Launch QA owner: `_____`
- Time started: `_____`
- Time completed: `_____`
- Overall status: `pass / pass with follow-ups / rollback`
