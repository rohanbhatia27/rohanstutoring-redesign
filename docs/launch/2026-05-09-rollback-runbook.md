# Rollback Runbook

Canonical domain assumed: `https://www.rohanstutoring.com`

Use this only if the live launch is materially broken and you need the fastest safe path back.

## Rollback principle

Rollback the smallest layer that fixes the problem.

- If code is broken but DNS is fine: rollback Vercel first
- If routing is broken because DNS is wrong: rollback DNS first
- If email breaks after nameserver changes: restore mail records first
- If a single integration breaks but the site is otherwise healthy: keep the site live and isolate that integration

## Inputs to have ready before launch

- previous stable commit SHA
- previous stable Vercel deployment URL or deployment ID
- current production deployment URL or deployment ID
- current and previous DNS records
- current and previous nameservers

## Scenario 1: new code deployment is broken

Symptoms:

- page rendering broken
- checkout JS broken
- API endpoints returning `5xx`

Action:

1. Roll back the production deployment in Vercel:
   - `vercel rollback <deployment-url-or-id>`
2. Re-test homepage, money pages, and checkout
3. Keep DNS unchanged if the previous deployment fixes the issue

## Scenario 2: domain cutover is broken

Symptoms:

- live domain does not resolve
- SSL warnings
- wrong host serving
- redirect loops between apex and `www`

Action:

1. Restore the previous web DNS records or nameservers
2. Wait for propagation on the critical host records
3. Keep the Vercel deployment intact while DNS is reverted
4. Re-test the old live site

## Scenario 3: Google Workspace email breaks

Symptoms:

- inbound mail stops
- outbound mail bounces
- SPF, DKIM, or DMARC failures

Action:

1. Restore the last known-good mail records immediately:
   - `MX`
   - SPF `TXT`
   - DKIM `TXT`
   - DMARC `TXT`
2. If nameservers changed, verify the full mail record set exists at the active DNS host
3. Re-test inbound and outbound mail

## Scenario 4: Stripe checkout breaks

Symptoms:

- card form loads but payment fails
- instalment redirect fails
- Stripe webhook deliveries fail

Action:

1. Check Vercel function logs for:
   - `/api/create-payment-intent`
   - `/api/create-instalment-session`
   - `/api/stripe-webhook`
2. Verify live Stripe env vars in Production
3. If the break was introduced by the current code deployment, roll back Vercel
4. If standard checkout works but instalments are broken, temporarily steer traffic to full-pay paths while fixing instalments

## Scenario 5: PayPal breaks

Symptoms:

- order creation fails
- capture fails
- success page verification fails

Action:

1. Check Vercel function logs for:
   - `/api/create-paypal-order`
   - `/api/capture-paypal-order`
   - `/api/paypal-order-status`
   - `/api/paypal-webhook`
2. Verify live `PAYPAL_*` vars and webhook ID
3. If PayPal is optional at launch, keep the site live and disable or hide PayPal rather than rolling back the whole site
4. If PayPal was re-enabled by code and is causing broad checkout confusion, roll back to the card-only deployment

## Scenario 6: confirmation emails stop sending

Symptoms:

- successful payment but no confirmation email
- Resend errors after cutover

Action:

1. Check Resend dashboard and Vercel logs
2. Verify `RESEND_API_KEY` still exists in Production
3. Verify DNS records needed by Resend domain verification still exist
4. If payments are otherwise succeeding, keep the site live and handle confirmations manually while fixing email

## Scenario 7: redirects or canonicals are wrong on the live domain

Symptoms:

- legacy links 404
- wrong destination pages
- canonical mismatch on major pages

Action:

1. Run the redirect audit on the live domain
2. If the issue is severe and widespread, roll back Vercel
3. If the issue is isolated, patch `vercel.json` or metadata and redeploy instead of doing a full rollback

## Fast triage matrix

- Site down or checkout down:
  - rollback Vercel first
- Domain not resolving:
  - rollback DNS first
- Email down:
  - restore mail DNS first
- One payment method down:
  - isolate that method, keep the rest live
- Analytics down:
  - do not rollback the site for that alone unless it masks checkout failures

## Minimum re-test after any rollback

- homepage
- `/courses`
- `/courses/comprehensive`
- `/checkout/?product=blueprint`
- `/checkout/?product=comprehensive`
- one legacy redirect
- inbound test email

## Rollback log

- Time rollback started:
- Trigger:
- Layer rolled back:
- Command or DNS change used:
- Validation result:
- Follow-up owner:
