# Payment URL Audit

Canonical domain assumed in this audit: `https://www.rohanstutoring.com`

## Launch-critical finding

PayPal is wired in the backend, but the checkout frontend is currently card-only because `paypalClientId` is intentionally not activated in `js/checkout.js`. If you want PayPal visible at launch, this needs to be re-enabled after merchant verification is complete.

## Stripe server endpoints

- Webhook endpoint expected by code:
  - `https://www.rohanstutoring.com/api/stripe-webhook`
- Payment intent creation:
  - `https://www.rohanstutoring.com/api/create-payment-intent`
- Instalment checkout session creation:
  - `https://www.rohanstutoring.com/api/create-instalment-session`
- Public checkout config:
  - `https://www.rohanstutoring.com/api/public-config`

## Stripe success and cancel URLs

### Native instalment Checkout Sessions

These are created dynamically from the request origin:

- Success:
  - `https://www.rohanstutoring.com/checkout/success?product=comprehensive&session_id={CHECKOUT_SESSION_ID}`
  - `https://www.rohanstutoring.com/checkout/success?product=mastery&session_id={CHECKOUT_SESSION_ID}`
- Cancel:
  - `https://www.rohanstutoring.com/checkout/?product=comprehensive`
  - `https://www.rohanstutoring.com/checkout/?product=mastery`

If the request originates from apex instead of `www`, the code will use that origin instead. Pick one canonical host and make sure the dashboard flow matches it.

## Stripe hosted payment links in live page markup

- Comprehensive instalments:
  - `https://buy.stripe.com/8x25kDeDWdUC2u1eaMeEo0m`
- Mastery instalments:
  - `https://buy.stripe.com/cNi8wP53m5o69Wt7MoeEo0o`
- S1 Comprehensive instalments:
  - `https://buy.stripe.com/28EcN5cvO03M2u1eaMeEo0r`
- S2 Comprehensive instalments:
  - `https://buy.stripe.com/fZu7sL1RadUC3y5giUeEo0s`

Dashboard check:

- Each hosted link should be in live mode
- Each hosted link should land on the correct product
- Any post-payment redirect configured in Stripe should point back to the canonical domain

## Stripe webhook events handled by code

- `payment_intent.succeeded`
  - This is the only Stripe event that currently triggers fulfillment and confirmation emails.
- `checkout.session.completed`
  - Acknowledged for instalments.
- `invoice.paid`
  - Acknowledged for instalments.
- `invoice.payment_failed`
  - Acknowledged for instalments.

Dashboard check:

- Your Stripe webhook endpoint should deliver at least those event types.

## PayPal server endpoints

- Create order:
  - `https://www.rohanstutoring.com/api/create-paypal-order`
- Capture order:
  - `https://www.rohanstutoring.com/api/capture-paypal-order`
- Order status lookup:
  - `https://www.rohanstutoring.com/api/paypal-order-status`
- Webhook endpoint expected by code:
  - `https://www.rohanstutoring.com/api/paypal-webhook`
- Public checkout config currently exposes:
  - `paypalClientId`

## PayPal success behavior

There is no dashboard-level PayPal return URL in the repo code. The frontend handles this after capture and redirects the browser to:

- `https://www.rohanstutoring.com/checkout/success?product=<slug>&paypal_order=<ORDER_ID>`

Optional parameters added by the frontend:

- `package=<apiSlug>` for private mentoring package selection
- `upsell=<upsellSlug>` when an upsell is attached

Examples:

- `https://www.rohanstutoring.com/checkout/success?product=blueprint&paypal_order=ORDER123`
- `https://www.rohanstutoring.com/checkout/success?product=private-mentoring&package=mentoring-pack&paypal_order=ORDER123`
- `https://www.rohanstutoring.com/checkout/success?product=essay-marking&paypal_order=ORDER123&upsell=essay-collection`

## PayPal webhook event handled by code

- `PAYMENT.CAPTURE.COMPLETED`

Dashboard check:

- The PayPal webhook should point at `/api/paypal-webhook`
- The configured PayPal webhook ID must match `PAYPAL_WEBHOOK_ID` in Vercel production

## Origin allowlist baked into the APIs

These origins are accepted by the checkout APIs:

- `https://rohanstutoring.com`
- `https://www.rohanstutoring.com`
- `https://rohanstutoring-redesign.vercel.app`
- matching preview hosts under `rohanstutoring-redesign-*.vercel.app`
- local `http://localhost:*`
- local `http://127.0.0.1:*`

## Fulfillment-linked URLs and email behavior

- Confirmation sender:
  - `noreply@rohanstutoring.com`
- Support address in confirmation email:
  - `hello@rohanstutoring.com`
- Essay upload destination link:
  - `https://tally.so/r/zxQdMR`
- Essay upload fallback email:
  - `essays@rohanstutoring.com`

## Dashboard comparison checklist

- Stripe publishable key is live
- Stripe secret key is live
- Stripe instalment price IDs are live and active
- Stripe webhook endpoint is the canonical production domain
- Stripe webhook includes the expected event types
- Stripe hosted payment links are all live-mode links
- PayPal API base is live
- PayPal client ID and secret are live
- PayPal webhook endpoint is the canonical production domain
- PayPal webhook ID in dashboard matches `PAYPAL_WEBHOOK_ID`
- If PayPal should launch visibly, re-enable `paypalClientId` usage in checkout frontend
