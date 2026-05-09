# Comprehensive Welcome Email Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a product-specific Resend welcome email from `noreply@rohanstutoring.com` after successful payment for `comprehensive`, `s1-comprehensive`, and `s2-comprehensive`, while keeping `mastery` ready for a different template later.

**Architecture:** Keep all outbound course onboarding emails inside the existing Stripe fulfillment path in `site/api/_lib/_fulfill-payment-intent.js`, which is already called by `site/api/stripe-webhook.js` after `payment_intent.succeeded`. Add a small product-template layer for course-specific onboarding copy, and first make sure the S1/S2 comprehensive product slugs are actually supported end-to-end by the checkout/frontend/backend metadata flow.

**Tech Stack:** Static HTML, vanilla JavaScript, Node.js serverless functions on Vercel, Stripe, Resend, Node test runner

---

## File Structure

- Modify: `site/js/checkout.js`
  - Add `s1-comprehensive` and `s2-comprehensive` to the checkout product catalog if they are not already present there in the same shape as existing products.
- Modify: `site/api/create-payment-intent.js`
  - Add server-side amount and fulfillment support for `s1-comprehensive` and `s2-comprehensive`.
- Modify: `site/api/_lib/_fulfill-payment-intent.js`
  - Add product-specific welcome email template selection, subject/content generation, and schedule-specific copy for full/S1 vs S2 comprehensive.
- Modify: `site/tests/checkout.test.js`
  - Add coverage proving checkout accepts the S1/S2 course slugs and builds valid API payloads.
- Modify: `site/tests/stripe-webhook.test.js`
  - Add coverage proving comprehensive variants map to the new welcome email behavior and `mastery` stays separate.

### Task 1: Support S1/S2 Comprehensive Products End-to-End

**Files:**
- Modify: `site/js/checkout.js`
- Modify: `site/api/create-payment-intent.js`
- Test: `site/tests/checkout.test.js`

- [ ] **Step 1: Write the failing checkout tests for the new slugs**

```js
test('getProductFromSearch resolves s1-comprehensive and s2-comprehensive', () => {
  assert.equal(getProductFromSearch('?product=s1-comprehensive').name, PRODUCTS['s1-comprehensive'].name);
  assert.equal(getProductFromSearch('?product=s2-comprehensive').name, PRODUCTS['s2-comprehensive'].name);
});

test('create-payment-intent accepts s1-comprehensive and s2-comprehensive', async () => {
  const slugs = ['s1-comprehensive', 's2-comprehensive'];

  for (const slug of slugs) {
    const req = {
      method: 'POST',
      headers: { origin: 'https://rohanstutoring.com' },
      body: {
        slug,
        email: 'jane@example.com',
        customerName: 'Jane Smith',
      },
    };
    const res = createJsonResponseRecorder();

    createPaymentIntentHandler.__setStripeFactory(() => ({
      paymentIntents: {
        create: async (payload) => ({ id: 'pi_test', client_secret: 'pi_test_secret', metadata: payload.metadata }),
      },
      promotionCodes: { list: async () => ({ data: [] }) },
    }));

    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    await createPaymentIntentHandler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.clientSecret, 'pi_test_secret');
  }
});
```

- [ ] **Step 2: Run the targeted checkout tests to verify they fail**

Run: `cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site && node --test tests/checkout.test.js`

Expected: FAIL because `s1-comprehensive` and `s2-comprehensive` are missing from one or more checkout/payment maps.

- [ ] **Step 3: Add the new product definitions in the checkout frontend**

```js
's1-comprehensive': {
  name: 'GAMSAT Section 1 Comprehensive Course (May 2026 Start)',
  tagline: '',
  price: 899,
  features: [
    'Section 1 live coaching classes',
    'Recorded strategy library',
    'Direct access to Rohan',
    '100% refund guarantee',
  ],
  isDigital: false,
  instalment: null,
  successType: 'cohort',
},
's2-comprehensive': {
  name: 'GAMSAT Section 2 Comprehensive Course (May 2026 Start)',
  tagline: '',
  price: 899,
  features: [
    'Section 2 live coaching classes',
    'Essay feedback and writing frameworks',
    'Direct access to Rohan',
    '100% refund guarantee',
  ],
  isDigital: false,
  instalment: null,
  successType: 'cohort',
},
```

Use the exact features already present in the repo if they exist elsewhere; do not invent new business details during implementation.

- [ ] **Step 4: Add matching server-side amount support and metadata handling**

```js
const AMOUNTS = {
  // ...
  's1-comprehensive': 89900,
  's2-comprehensive': 89900,
};
```

No new upsell combinations are needed unless the existing product pages or checkout UX already advertise them.

- [ ] **Step 5: Re-run the targeted checkout tests**

Run: `cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site && node --test tests/checkout.test.js`

Expected: PASS for the new S1/S2 slug tests.

- [ ] **Step 6: Commit Task 1**

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add js/checkout.js api/create-payment-intent.js tests/checkout.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "feat: support s1 and s2 comprehensive checkout slugs"
```

### Task 2: Add Product-Specific Comprehensive Welcome Emails

**Files:**
- Modify: `site/api/_lib/_fulfill-payment-intent.js`
- Test: `site/tests/stripe-webhook.test.js`

- [ ] **Step 1: Write the failing fulfillment tests for comprehensive email variants**

```js
test('fulfillment helper chooses the comprehensive welcome email template', async () => {
  const sentEmails = [];
  process.env.RESEND_API_KEY = 're_test_123';

  fulfillPaymentIntent.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));

  await fulfillPaymentIntent.fulfillPaymentIntent({
    paymentIntent: {
      id: 'pi_123',
      metadata: {
        base_slug: 'comprehensive',
        customer_email: 'jane@example.com',
        customer_name: 'Jane Smith',
      },
    },
    stripeClient: {
      paymentIntents: {
        update: async () => ({}),
      },
    },
  });

  assert.equal(sentEmails[0].from, 'noreply@rohanstutoring.com');
  assert.equal(sentEmails[0].subject, "Welcome to the Comprehensive Course 👋 Let's get started.");
  assert.match(sentEmails[0].html, /Tuesday 26 May 6pm AEDT/);
});

test('fulfillment helper uses the S2-specific start time for s2-comprehensive', async () => {
  // same setup, but base_slug: 's2-comprehensive'
  assert.match(sentEmails[0].html, /Wednesday 27 May 7pm AEDT/);
});

test('fulfillment helper does not reuse the comprehensive template for mastery', async () => {
  // same setup, but base_slug: 'mastery'
  assert.doesNotMatch(sentEmails[0].subject, /Welcome to the Comprehensive Course/);
});
```

- [ ] **Step 2: Run the targeted webhook tests to verify they fail**

Run: `cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site && node --test tests/stripe-webhook.test.js`

Expected: FAIL because the current helper only sends one generic confirmation email for all products.

- [ ] **Step 3: Refactor fulfillment email generation behind a product-aware template selector**

```js
const COURSE_EMAIL_VARIANTS = {
  comprehensive: {
    subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
    startLine: 'before our first live class kicks off on Tuesday 26 May 6pm AEDT.',
  },
  's1-comprehensive': {
    subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
    startLine: 'before our first live class kicks off on Tuesday 26 May 6pm AEDT.',
  },
  's2-comprehensive': {
    subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
    startLine: 'before our first live class kicks off on Wednesday 27 May 7pm AEDT.',
  },
};
```

Add a helper that returns:
- the existing generic payment-confirmed email for non-course products
- the new comprehensive welcome email for `comprehensive`, `s1-comprehensive`, and `s2-comprehensive`
- the current generic confirmation for `mastery` until a separate mastery template is intentionally added

- [ ] **Step 4: Implement the comprehensive HTML and text bodies using the approved copy**

```txt
Subject: Welcome to the Comprehensive Course 👋 Let's get started.

Hey [first name],

Good to see your enrolment come through. I'm excited to have you in the cohort.

You should have just received a separate email with your link to access the Blueprint library via Google Drive. If you haven't seen it yet, just reply to this email and let me know.

You can use the link here to book your 1-on-1 consultation for us to chat, as part of your early bird bonus! https://calendly.com/rohansgamsat/gamsat-strategy-consultation

I can walk you through the next few months and how to best prepare before our first live class kicks off on Tuesday 26 May 6pm AEDT.

Talk soon,

Rohan
```

For `s2-comprehensive`, only change the final sentence to:

```txt
I can walk you through the next few months and how to best prepare before our first live class kicks off on Wednesday 27 May 7pm AEDT.
```

- [ ] **Step 5: Keep webhook fulfillment non-blocking if Resend is unavailable or rejects**

```js
if (!apiKey) {
  console.warn('[fulfill-payment-intent] RESEND_API_KEY not set — skipping confirmation email');
  return;
}

try {
  await sendConfirmationEmail({ customerName, customerEmail, baseSlug, upsellSlug });
} catch (emailErr) {
  console.error('[fulfill-payment-intent] Confirmation email failed:', emailErr.message);
}
```

Preserve this behavior while renaming helpers if needed.

- [ ] **Step 6: Re-run the webhook tests**

Run: `cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site && node --test tests/stripe-webhook.test.js`

Expected: PASS with comprehensive template selection covered for full/S1/S2 and mastery still using the generic fallback.

- [ ] **Step 7: Commit Task 2**

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add api/_lib/_fulfill-payment-intent.js tests/stripe-webhook.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "feat: add comprehensive onboarding email automation"
```

### Task 3: Final Verification and Launch Readiness

**Files:**
- Modify: `site/tests/checkout.test.js` (only if a final assertion is still missing)
- Modify: `site/tests/stripe-webhook.test.js` (only if a final assertion is still missing)

- [ ] **Step 1: Run the full relevant automated test suite**

Run: `cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site && node --test tests/checkout.test.js tests/stripe-webhook.test.js`

Expected: PASS

- [ ] **Step 2: Do a local webhook smoke check with a representative comprehensive payload**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
node -e "const fulfill=require('./api/_lib/_fulfill-payment-intent.js'); process.env.RESEND_API_KEY='re_test'; fulfill.fulfillPaymentIntent({ paymentIntent:{ id:'pi_manual', metadata:{ base_slug:'s1-comprehensive', customer_email:'jane@example.com', customer_name:'Jane Smith' } }, stripeClient:{ paymentIntents:{ update: async ()=>({}) } } }).then(()=>console.log('ok')).catch((err)=>{ console.error(err); process.exit(1); });"
```

Expected: `ok` plus either a mocked/stubbed send in test mode or a clear Resend failure log if live credentials are not supplied.

- [ ] **Step 3: Confirm production env prerequisites before deploy**

Check:
- `RESEND_API_KEY` exists in Vercel
- `noreply@rohanstutoring.com` is verified as an allowed Resend sender
- `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` remain unchanged

- [ ] **Step 4: Commit any final assertion cleanups**

```bash
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site add tests/checkout.test.js tests/stripe-webhook.test.js
git -C /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site commit -m "test: lock comprehensive onboarding email coverage"
```

- [ ] **Step 5: Manual post-deploy verification**

1. Complete a test-mode purchase for `comprehensive`
2. Complete a test-mode purchase for `s1-comprehensive`
3. Complete a test-mode purchase for `s2-comprehensive`
4. Confirm each email arrives from `noreply@rohanstutoring.com`
5. Confirm the subject is identical across all three
6. Confirm the start-date sentence is Tuesday for full/S1 and Wednesday for S2
7. Confirm `mastery` still sends the generic fallback until its dedicated template is defined

## Self-Review

- Spec coverage: covered trigger path, sender, subject, approved copy, S1/full Tuesday timing, S2 Wednesday timing, and future-safe separation for `mastery`
- Placeholder scan: no unresolved placeholders remain; S1/S2 pricing and schedule details were confirmed from `site/courses/s1-comprehensive.html` and `site/courses/s2-comprehensive.html`
- Type consistency: plan uses existing `base_slug`, `customer_email`, `customer_name`, and `paymentIntent` metadata shapes already present in the codebase
