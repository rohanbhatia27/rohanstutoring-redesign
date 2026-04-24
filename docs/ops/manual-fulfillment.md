# Manual Fulfillment SOP

When Stripe webhook metadata shows `fulfillment_status=manual_fulfillment_pending`, fulfill the order before marking it `fulfilled`.

## Required Stripe Metadata

- `customer_email`
- `base_slug`
- `upsell_slug`, when present
- `fulfillment_delivery_type`
- `fulfillment_label`
- `fulfillment_product_slugs`
- `fulfillment_requested_at`

## Product Actions

- `digital-access`: send the relevant Google Drive/download access email.
- `essay-submission`: send essay submission instructions.
- `booking-link`: send the mentoring booking link.
- `cohort-onboarding`: send cohort onboarding details.

## Close Out

After delivery, update the PaymentIntent metadata in Stripe:

- `fulfillment_status=fulfilled`
- `manual_fulfillment_required=false`
- `fulfilled_at=<ISO timestamp>`
- `fulfilled_by=<operator name or email>`
