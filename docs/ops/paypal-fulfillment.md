# PayPal Fulfillment

## Required Vercel Environment Variables

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- Optional for sandbox testing only: `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`

Production should use live PayPal credentials with the default `https://api-m.paypal.com` API base.

## Required PayPal Webhook

Create a PayPal app webhook for:

- `PAYMENT.CAPTURE.COMPLETED`

Webhook URL:

```txt
https://rohanstutoring.com/api/paypal-webhook
```

Copy the webhook ID into Vercel as `PAYPAL_WEBHOOK_ID`.

## Manual Fulfillment Check

PayPal purchases should be treated as paid only when either:

- `/api/capture-paypal-order` validates and returns `status: "succeeded"`, or
- PayPal sends a verified `PAYMENT.CAPTURE.COMPLETED` webhook.

The durable source of truth is PayPal's merchant dashboard. Use the PayPal order ID to find the transaction if a customer reaches out and the browser redirect did not complete.

## Pre-Live Smoke Test

1. Confirm production env vars exist:

```bash
cd site
vercel env ls
```

2. Confirm PayPal button loads on `/checkout?product=blueprint`.
3. Complete one PayPal sandbox or live low-value test order, depending on the active credentials.
4. Confirm `/checkout/success?product=blueprint&paypal_order=<ORDER_ID>` verifies server-side before showing success.
5. Confirm a PayPal `PAYMENT.CAPTURE.COMPLETED` webhook delivery appears in PayPal developer dashboard.
