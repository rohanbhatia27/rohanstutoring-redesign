<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Rohan's GAMSAT static site.

## What was done

- **`js/posthog-init.js`** (new): Loads the posthog-js CDN snippet and initialises PostHog by fetching the project key and host from `/api/public-config` at runtime. Skips initialisation on `localhost`/`127.0.0.1` to prevent dev noise.
- **`api/public-config.js`** (edited): Extended to expose `posthogPublicKey` and `posthogHost` from environment variables alongside the existing Stripe key.
- **All 34 HTML pages** (edited): `<script src="/js/posthog-init.js" defer></script>` added after the existing analytics script tag — consistent with how Google Analytics is already loaded.
- **`js/contact.js`** (edited): `posthog.capture('contact_form_submitted')` fires on successful form submission, alongside the existing `gtag` call.
- **`js/checkout.js`** (edited): Four events added — `checkout_payment_submitted` (on form submit), `checkout_completed` (on payment success with product and value metadata), `checkout_order_bump_toggled` (when the upsell checkbox changes), and `essay_upload_started` (on Tally button click).
- **`js/quiz.js`** (edited): The existing `track()` helper now also calls `window.posthog.capture()` in parallel with `gtag`, automatically covering all four quiz events already in the codebase.
- **`.env`** (created): `POSTHOG_PUBLIC_KEY` and `POSTHOG_HOST` stored as server-side environment variables. You will need to add these to your Vercel project settings.

## Events

| Event | Description | File |
|---|---|---|
| `contact_form_submitted` | User successfully submits the contact form | `js/contact.js` |
| `checkout_payment_submitted` | User submits the payment form (attempt begins) | `js/checkout.js` |
| `checkout_completed` | Payment confirmed; includes product, value, and upsell metadata | `js/checkout.js` |
| `checkout_order_bump_toggled` | User toggles the order bump checkbox; includes product and selection state | `js/checkout.js` |
| `essay_upload_started` | User clicks the Tally essay upload button on the success page | `js/checkout.js` |
| `quiz_started` | User clicks to start the path-finder quiz | `js/quiz.js` |
| `quiz_question_answered` | User selects an answer; includes question key, answer value, and index | `js/quiz.js` |
| `quiz_completed` | User finishes all questions; includes recommended outcome ID | `js/quiz.js` |
| `quiz_email_captured` | User submits their email to unlock the full quiz result | `js/quiz.js` |

## Vercel setup required

Add these two environment variables in your Vercel project settings before deploying:

```
POSTHOG_PUBLIC_KEY=<your PostHog project token — find it in PostHog > Project Settings>
POSTHOG_HOST=<your PostHog host, e.g. https://us.i.posthog.com>
```

The values are already set in your local `.env` file via the wizard.

## Next steps

We've built a dashboard and five insights to keep an eye on the most important user behaviour:

- **Dashboard** — [Analytics basics](https://us.posthog.com/project/406490/dashboard/1535964)
- **Checkout conversion funnel** (payment submitted → completed) — [View insight](https://us.posthog.com/project/406490/insights/4dTJ2ouf)
- **Quiz engagement funnel** (started → completed → email captured) — [View insight](https://us.posthog.com/project/406490/insights/QwXi9WMR)
- **Checkout completions over time** — [View insight](https://us.posthog.com/project/406490/insights/McGlLzYO)
- **Contact form submissions over time** — [View insight](https://us.posthog.com/project/406490/insights/bam4lMuq)
- **Quiz outcome breakdown** (which path students are recommended most) — [View insight](https://us.posthog.com/project/406490/insights/ES33BMh4)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_web/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
