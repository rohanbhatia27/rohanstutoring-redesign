# Lead-Gen Integration Audit

Canonical domain assumed in this audit: `https://www.rohanstutoring.com`

## Formspree

### Shared contact form endpoint

- Endpoint:
  - `https://formspree.io/f/mvzvldzo`
- Used on:
  - `/contact.html`
  - `/s2-slam-system.html`
  - `/courses/private-mentoring.html`

### Quiz lead gate endpoint

- Endpoint:
  - `https://formspree.io/f/xyklpvlp`
- Used on:
  - `/quiz.html`

Dashboard check:

- Both Formspree forms should allow submissions from the final live domain
- Notification emails should go to the right inbox
- Spam filtering or domain allowlists should not still reference an old domain

## Kit

### Webinar form

- Endpoint:
  - `https://app.kit.com/forms/9341394/subscriptions`
- Page:
  - `/webinar.html`
- Hardcoded redirect target:
  - `https://www.rohanstutoring.com/webinar/thanks`

### Section 1 tracker form

- Endpoint:
  - `https://app.kit.com/forms/8683298/subscriptions`
- Page:
  - `/section-1-tracker.html`

### S1 mock form

- Endpoint:
  - `https://app.kit.com/forms/8717603/subscriptions`
- Page:
  - `/s1-mock.html`

### Kit script

- Script source used on Kit-powered pages:
  - `https://f.convertkit.com/ckjs/ck.5.js`

Dashboard check:

- Webinar form redirect still points to the canonical domain
- Embedded Kit forms are set to live and mapped to the intended subscriber destinations
- Any welcome automation or tagging still references the correct post-signup experience

## Tally

### Essay upload form

- Base form URL:
  - `https://tally.so/r/zxQdMR`
- Used by:
  - Stripe fulfillment metadata
  - Checkout success flow for essay-marking purchases

The site appends parameters such as:

- `payment_intent`
- `product`
- `upsell`
- `upload_token`
- `source`

Dashboard check:

- Form is still published
- Hidden-field or URL-param handling still works
- Notification and response-routing emails go to the correct inbox

## Calendly

- URL:
  - `https://calendly.com/rohansgamsat/gamsat-strategy-consultation`
- Used by:
  - `/quiz.html` flow via `js/quiz.js`

Dashboard check:

- Event type is still active
- Availability is open enough for launch traffic
- Confirmation emails and reminders come from the intended Calendly setup

## Thank-you and destination URLs

### Webinar thank-you page

- Final URL:
  - `https://www.rohanstutoring.com/webinar/thanks`
- Legacy redirect sources already mapped in Vercel:
  - `/webinar-join`
  - `/webinar-thanks`

### Quiz result path

- Quiz does not use a separate thank-you page
- Lead capture happens inside `/quiz.html`

### Checkout success page

- Base success URL:
  - `https://www.rohanstutoring.com/checkout/success`

This is payment-related rather than lead-gen, but it is a major post-conversion destination to include in launch QA.

## Public-facing email addresses referenced in lead and support flows

- `hello@rohanstutoring.com`
- `rohan@rohanstutoring.com`
- `essays@rohanstutoring.com`

## Launch QA checklist

- Submit the contact form
- Submit the quiz lead gate
- Submit the webinar form and confirm redirect to `/webinar/thanks`
- Submit the tracker form
- Submit the S1 mock form
- Open the Tally essay upload form from a generated purchase flow link
- Open the Calendly booking link from the quiz flow
- Confirm every thank-you or next-step destination stays on the canonical domain
