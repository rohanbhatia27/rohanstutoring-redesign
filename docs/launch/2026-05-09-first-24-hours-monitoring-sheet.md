# First 24 Hours Monitoring Sheet

Canonical domain assumed: `https://www.rohanstutoring.com`

## Monitoring cadence

- First 30 minutes: check every 5 to 10 minutes
- First 4 hours: check every 30 to 60 minutes
- First 24 hours: check at least morning, afternoon, and evening

## Vercel

Watch for:

- deployment errors
- function failures on checkout APIs
- spikes in `4xx` or `5xx`
- domain or SSL warnings

Check these surfaces:

- latest production deployment status
- function logs for:
  - `/api/create-payment-intent`
  - `/api/create-instalment-session`
  - `/api/stripe-webhook`
  - `/api/create-paypal-order`
  - `/api/capture-paypal-order`
  - `/api/paypal-order-status`
  - `/api/paypal-webhook`
  - `/api/public-config`

## Stripe

Watch for:

- failed payment intents
- failed checkout session creation
- webhook delivery failures
- mismatched live/test mode mistakes

Check:

- successful charges
- successful Checkout Sessions for instalments
- webhook deliveries to `/api/stripe-webhook`
- event handling for:
  - `payment_intent.succeeded`
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`

## PayPal

Watch for:

- order creation failures
- capture failures
- webhook verification failures
- wrong webhook ID or endpoint

Check:

- live API order creation
- live capture success
- webhook deliveries to `/api/paypal-webhook`
- `PAYMENT.CAPTURE.COMPLETED` events

If PayPal is intentionally hidden at launch:

- verify no visible PayPal regression is confusing users
- skip live buyer-facing PayPal monitoring unless re-enabled

## Resend

Watch for:

- confirmation email send failures
- domain verification problems
- bounce or complaint spikes

Check:

- successful sends from `noreply@rohanstutoring.com`
- no sudden failures after DNS cutover
- at least one successful real confirmation email after launch

## Google Workspace / mail continuity

Watch for:

- inbound mail failures
- outbound delivery issues
- SPF, DKIM, or DMARC failures after DNS change

Check:

- inbound test to `rohan@rohanstutoring.com`
- outbound reply from the Google Workspace inbox
- message headers on a test mail if anything looks off

## PostHog

Watch for:

- missing pageview or event ingestion
- checkout events not appearing
- form submission events not appearing

Key events in this repo:

- `contact_form_submitted`
- `checkout_payment_submitted`
- `checkout_order_bump_toggled`
- `checkout_completed`
- `essay_upload_started`
- quiz events from `js/quiz.js`

## Google Analytics

Watch for:

- live traffic arriving on the new host
- purchase events firing
- no obvious source/medium loss

Key signals in this repo:

- `begin_checkout`
- `contact_form_submit`
- `purchase`
- `essay_upload_started`
- quiz-related events

GA property ID in markup:

- `G-H1KDZ561ZE`

## Redirects and crawl

Check:

- redirect audit on the live domain returns `bad rows: 0`
- `robots.txt` fetches cleanly
- `sitemap.xml` fetches cleanly
- Search Console accepts the sitemap

## What counts as a launch blocker in the first 24 hours

- checkout APIs returning errors
- Stripe payments not completing
- PayPal failures if PayPal is intended to be live
- confirmation emails not sending
- live domain not resolving correctly
- canonical or redirect failures on money pages

## Incident log

- Time:
- Surface:
- Symptom:
- Impact:
- Action taken:
- Resolved:
