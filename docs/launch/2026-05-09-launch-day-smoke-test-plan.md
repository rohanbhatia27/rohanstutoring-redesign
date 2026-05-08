# Launch-Day Smoke Test Plan

Canonical domain assumed: `https://www.rohanstutoring.com`

## Must-pass public pages

- `/`
- `/about`
- `/courses`
- `/contact`
- `/webinar`
- `/webinar/thanks`
- `/quiz`
- `/section-1-tracker`
- `/s1-mock`
- `/s2-slam-system`
- `/uk-gamsat`
- `/ireland-gamsat`
- `/blog`

## Must-pass product pages

- `/courses/comprehensive`
- `/courses/mastery`
- `/courses/blueprint`
- `/courses/advanced`
- `/courses/essay-collection`
- `/courses/essay-marking`
- `/courses/private-mentoring`
- `/courses/starter-pack`
- `/courses/s1-comprehensive`
- `/courses/s2-comprehensive`
- `/courses/s1-rescue-sprint`
- `/courses/s2-rescue-sprint`

## Must-pass checkout entry routes

- `/checkout/?product=comprehensive`
- `/checkout/?product=mastery`
- `/checkout/?product=blueprint`
- `/checkout/?product=advanced`
- `/checkout/?product=essay-collection`
- `/checkout/?product=essay-marking`
- `/checkout/?product=essay-pack-10`
- `/checkout/?product=private-mentoring`
- `/checkout/?product=starter-pack`
- `/checkout/?product=s1-comprehensive`
- `/checkout/?product=s2-comprehensive`

## High-risk conversion flows

### Stripe card flow

- Open checkout for `blueprint`
- Complete form validation
- Confirm Stripe Elements loads
- Confirm pay button enables only after terms acceptance
- Complete a real or controlled live transaction
- Confirm success route lands on `/checkout/success`

### Instalment flow

- Open checkout for `comprehensive`
- Switch to instalment mode
- Confirm instalment copy and amount are correct
- Continue to Stripe Checkout
- Confirm cancel returns to `/checkout/?product=comprehensive`
- Confirm success returns to `/checkout/success?product=comprehensive&session_id=...`

### Essay-marking flow

- Open checkout for `essay-marking`
- Complete payment
- Confirm success page shows Tally upload CTA
- Confirm fallback email `essays@rohanstutoring.com` is visible

### Private mentoring flow

- Open checkout for `private-mentoring`
- Confirm package selection defaults correctly
- Complete payment path or at minimum validate package-specific success URL handling

### PayPal

- If PayPal remains intentionally disabled, explicitly confirm it is absent and card checkout still works
- If PayPal is re-enabled before launch, test:
  - order creation
  - capture
  - success redirect with `paypal_order`
  - order verification on success page

## Lead-gen flows

- Submit contact form
- Submit webinar form and confirm redirect to `/webinar/thanks`
- Submit quiz gate form
- Submit Section 1 tracker form
- Submit S1 mock form
- Open Calendly from quiz flow

## Redirect smoke

Run:

```bash
npm run audit:redirects -- redirect-audit.launch.csv --origin=https://www.rohanstutoring.com --output=redirect-audit-live-output.csv --timeout-ms=3000
```

Pass criteria:

- `bad rows: 0`
- no checkout-path failures
- no success-page failures

## Device coverage

- Desktop Chrome
- Mobile Safari
- Mobile Chrome

## Basic acceptance rules

- No broken layout above the fold
- No missing hero image on primary pages
- No JS errors that block checkout or forms
- No dead CTA on revenue pages
- No incorrect domain in redirects or thank-you flows
