# Native Instalment Checkout Design

Date: 2026-05-07
Status: Proposed
Scope: Checkout architecture for native on-page instalment selection on high-ticket courses

## Goal

Add a native-feeling instalment selector inside checkout for `comprehensive` and `mastery` so students can choose between paying in full or paying over 4 monthly payments without being pushed to a disconnected Stripe Payment Link before they make that decision.

The page should clearly communicate:

- the amount due today
- the remaining monthly payments
- that billing continues automatically each month
- that failed payments are retried automatically and Stripe emails the student to update their card

## Confirmed Product Decisions

- Eligible products at launch: `comprehensive`, `mastery`
- Instalment structure: 4 total monthly payments
- Add-ons: the `$99` comprehensive 1:1 order bump remains available on instalments
- Add-on treatment on instalments: charge the full `$99` with the first instalment only
- Failed recurring payments: Stripe retries automatically and emails the student to update payment details

## Recommended Architecture

Use a dual-path checkout:

1. `Pay in full` stays on the current custom Stripe Elements + PaymentIntent flow.
2. `Pay in 4 monthly payments` stays native on the page until the submit step, then redirects into a Stripe-hosted Checkout Session in `subscription` mode.

This keeps the current one-off checkout stable while moving recurring billing onto Stripe Billing, which is the correct system for:

- stored payment methods
- automatic monthly renewals
- invoice generation
- failed payment retries
- customer card update flows

## Why This Approach

### Recommended path: custom selector + Checkout Session for instalments

Pros:

- Native product choice happens on the existing checkout page
- Stripe owns recurring billing complexity
- Lower implementation risk than rebuilding the entire checkout around subscriptions
- Preserves the working full-payment path

Cons:

- Students still complete payment on a Stripe-hosted page after selecting instalments
- Success flow and webhook handling need a second fulfillment path

### Not recommended: fully custom recurring flow with PaymentIntents

Reasons:

- PaymentIntents are the wrong abstraction for scheduled monthly billing
- Would require custom subscription, retry, and payment-method management
- Higher operational risk and worse long-term maintainability

### Not recommended: migrate every checkout mode to Checkout Sessions now

Reasons:

- Bigger rewrite than required
- Unnecessary risk while the current pay-in-full flow already works

## Checkout Experience

### Payment mode selector

For `comprehensive` and `mastery`, the payment section will show a mode selector above payment details:

- `Pay in full`
- `Pay in 4 monthly payments`

Default selection:

- `Pay in full`

### Full-pay mode

When `Pay in full` is selected:

- show the current card form
- keep the existing payment button behavior
- keep the current payment intent submission path
- keep the existing instalment Payment Link hidden

### Instalment mode

When `Pay in 4 monthly payments` is selected:

- hide the card form
- hide direct one-off payment confirmation controls
- show an instalment summary card inside checkout
- change the primary CTA to `Continue to secure instalment checkout`

The instalment summary card should show:

- `Due today: $X`
- `Then 3 monthly payments of $Y`
- `Automatic monthly billing`
- `Missed payments are retried automatically. Stripe will email you to update your card if needed.`

### Order summary behavior

The left-hand order summary must update based on payment mode.

For full payment:

- continue showing `Total due today` as the full amount plus any selected upsell

For instalments:

- show `Due today` as the first instalment amount
- show a secondary line explaining remaining monthly payments
- include the `$99` 1:1 add-on inside the first-payment total when selected

This avoids ambiguity about whether the student is being charged the full total immediately.

## Pricing Model

Frontend config for each eligible course should define:

- `fullAmount`
- `instalmentCount`
- `instalmentInterval`
- `firstPaymentAmount`
- `recurringPaymentAmount`
- `ctaLabel`
- Stripe recurring price identifier for the subscription plan

Example conceptual structure:

- `comprehensive`
  - full amount: existing one-off price
  - first payment: first monthly instalment
  - recurring payment: 3 remaining monthly instalments
- `mastery`
  - same shape

For `comprehensive`, when the 1:1 add-on is selected in instalment mode:

- `firstPaymentAmount` increases by `$99`
- recurring payments remain unchanged

This means the add-on is not spread across later invoices.

## Backend Design

### Existing route retained

Keep:

- `/api/create-payment-intent`

Responsibility:

- pay-in-full purchases only

### New route

Add:

- `/api/create-instalment-session`

Responsibility:

- validate allowed product slug
- validate allowed payment mode
- validate selected add-on combination
- create Stripe Checkout Session in `subscription` mode
- return a hosted checkout URL for redirect

### Session creation rules

The Checkout Session should:

- only allow `comprehensive` and `mastery`
- use recurring Stripe prices for the monthly plan
- attach metadata for:
  - `product_slug`
  - `base_slug`
  - `payment_mode=instalments`
  - `upsell_slug` when present
  - `customer_email`
  - `customer_name`
- use `subscription_data.metadata` so subscription webhooks retain course context

For the comprehensive add-on:

- the session should include a one-time line item for the `$99` 1:1 session
- that one-time amount is charged with the first invoice only
- recurring subscription invoices should not include the add-on

### Redirect behavior

The frontend CTA should:

- submit details to `/api/create-instalment-session`
- receive the Checkout Session URL
- redirect the browser immediately

## Webhook and Fulfillment Design

The existing webhook currently handles:

- `payment_intent.succeeded`

It should be extended to recognize recurring-billing events for instalment plans.

Minimum launch behavior:

- fulfill access when the first subscription invoice is paid
- avoid duplicate fulfillment on later recurring invoices

Recommended events to support:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`

### Fulfillment rules

On first successful instalment payment:

- provision course access the same way as a paid one-off purchase
- record enough metadata to avoid re-provisioning on invoice 2, 3, and 4

On recurring payment failure:

- do not build custom retry timing in code
- rely on Stripe Billing retry settings
- optionally log or notify internally later, but not required for initial launch

## Data and Config Requirements

Implementation needs Stripe-side recurring prices for:

- `comprehensive` monthly plan
- `mastery` monthly plan

The code should not hardcode Payment Link URLs for this new path.

Instead it should use either:

- Stripe price IDs in environment variables, or
- a server-side config map

Preferred structure:

- `STRIPE_PRICE_COMPREHENSIVE_INSTALMENT`
- `STRIPE_PRICE_MASTERY_INSTALMENT`

This keeps recurring billing configuration server-side and avoids exposing pricing infrastructure decisions in the browser.

## Frontend State Design

Checkout state needs one new axis:

- `paymentMode: 'full' | 'instalments'`

Existing selection state already covers:

- product slug
- package slug when relevant
- upsell selection
- total price

New derived values should include:

- amount due today
- future payment copy
- active CTA label
- whether Stripe card form is shown
- whether instalment summary card is shown

## Validation Rules

The frontend and backend should both enforce:

- only `comprehensive` and `mastery` may choose instalments
- non-eligible products continue to use the current one-off checkout only
- comprehensive upsell remains allowed in instalment mode
- mastery follows its own supported add-on rules

If a request violates these rules, the server should return a clear validation error and not create a session.

## Testing Plan

Add tests for:

- payment mode selector rendering for eligible products
- no selector on ineligible products
- summary text switching between full and instalment modes
- comprehensive add-on increasing first instalment only
- backend route rejecting unsupported slugs or modes
- backend route creating Checkout Sessions with expected metadata
- existing `create-payment-intent` behavior remaining unchanged

Manual verification should cover:

- `comprehensive` pay in full
- `comprehensive` instalments without add-on
- `comprehensive` instalments with add-on
- `mastery` pay in full
- `mastery` instalments

## Rollout Plan

1. Add frontend payment-mode selector and local summary behavior behind existing checkout UI.
2. Add backend Checkout Session creation route for instalments.
3. Wire redirect CTA for instalment mode.
4. Extend webhook handling for initial subscription fulfillment.
5. Test `comprehensive`.
6. Test `mastery`.

## Risks and Mitigations

### Risk: duplicate fulfillment on recurring invoices

Mitigation:

- only fulfill on the first successful payment event for the subscription lifecycle
- use metadata and existing fulfillment guards

### Risk: confusing due-today messaging

Mitigation:

- switch both CTA copy and order summary copy when payment mode changes

### Risk: add-on accidentally recurring

Mitigation:

- model the `$99` 1:1 class as a one-time line item on the first Checkout Session invoice only
- do not encode it into the recurring plan price

### Risk: live Stripe config mismatch

Mitigation:

- use explicit environment variables for recurring price IDs
- fail loudly when instalment config is missing

## Out of Scope

- migrating all products to subscriptions
- building a custom student billing portal
- pausing access automatically in code after failed recurring payments
- expanding instalment mode beyond `comprehensive` and `mastery`
