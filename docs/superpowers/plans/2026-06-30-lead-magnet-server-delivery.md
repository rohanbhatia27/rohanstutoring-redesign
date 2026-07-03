# Lead Magnet Server Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the website deliver free lead magnets itself via Resend the instant someone signs up, instead of depending on a Kit form automation that silently fails.

**Architecture:** `/api/leads` sends the download email via Resend first (the guaranteed, testable path), then best-effort syncs the subscriber into Kit (list + nurture sequence) without letting Kit failures affect delivery. Kit nurture enrollment uses the deterministic v4 sequence-subscribe endpoint rather than the unreliable form-automation trigger.

**Tech Stack:** Node (CommonJS) Vercel serverless functions, Resend SDK, Kit v4 API, `node:test`.

**Scope:** `s1-tracker`, `s1-mock`, `s2-slam-system`. `interview-calculator` is out of scope (its form has zero traffic and no funnel; separate follow-up).

---

## File Structure

- **Modify** `api/_lib/_kit.js` — add `addSubscriberToSequence` (deterministic nurture enrollment) + export it.
- **Modify** `api/_lib/_free-resource.js` — add per-resource `downloadUrl` / `emailSubject` / `kitSequenceId`; replace the old Kit-primary `submitKitResourceLead` and `sendFallbackEmail` with `sendDeliveryEmail` (primary Resend send) + `syncKitForResource` (best-effort Kit sync); keep `getFreeResource` and `buildFallbackPayload`.
- **Modify** `api/leads.js` — rewire `handleResourceLead`: deliver first, sync Kit second, on-page fallback only when Resend fails.
- **Modify** `js/tracker.js` and `js/s1-mock.js` — the delivery-analytics gate changes from `status === 'kit'` to `status === 'delivered'`.
- **Modify** `tests/free-resource-lead.test.js` — rewrite around the new functions and the `delivered` status.

## Reference values (do not paraphrase)

Download links (verbatim):
- `s1-tracker`: `https://docs.google.com/spreadsheets/d/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/edit?gid=788264791#gid=788264791`
- `s1-mock`: `https://drive.google.com/file/d/12rRPRFxmef7Oe8FU2oTWP3Sp0jdnLztt/view?usp=sharing`
- `s2-slam-system`: `https://download.filekitcdn.com/d/2hU8i25SXZz1XsLtQta7Yr/9LJePVqF4moaNxMtw6K9uB`

Kit form IDs: s1-tracker `8683298`, s1-mock `8717603`, s2-slam-system `8526774`.
Kit nurture sequence IDs: s1-tracker `2723708`, s1-mock `2718570`, s2-slam-system `2786194`.

---

## Task 1: Deterministic Kit sequence enrollment

**Files:**
- Modify: `api/_lib/_kit.js`
- Test: `tests/kit-sequence.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/kit-sequence.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const kit = require('../api/_lib/_kit.js');

test('addSubscriberToSequence upserts then enrolls via the v4 sequence endpoint', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ subscriber: { id: 777, email_address: 'jane@example.com' } }),
    };
  });

  await kit.addSubscriberToSequence({
    sequenceId: '2723708',
    email: 'jane@example.com',
    firstName: 'Jane',
  });

  const upsertCall = calls.find((c) => c.url.endsWith('/v4/subscribers'));
  const seqCall = calls.find((c) => /\/v4\/sequences\/\d+\/subscribers$/.test(c.url));

  assert.ok(upsertCall, 'expected a subscriber upsert call');
  assert.equal(JSON.parse(upsertCall.options.body).first_name, 'Jane');

  assert.ok(seqCall, 'expected a sequence-subscribe call');
  assert.equal(seqCall.url, 'https://api.kit.com/v4/sequences/2723708/subscribers');
  assert.equal(seqCall.options.method, 'POST');
  assert.equal(seqCall.options.headers['X-Kit-Api-Key'], 'kit_test_123');
  assert.deepEqual(JSON.parse(seqCall.options.body), { email_address: 'jane@example.com' });

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('addSubscriberToSequence throws when the sequence id is missing', async () => {
  await assert.rejects(
    () => kit.addSubscriberToSequence({ sequenceId: '', email: 'jane@example.com' }),
    /Missing Kit sequence id/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && node --test tests/kit-sequence.test.js`
Expected: FAIL with `kit.addSubscriberToSequence is not a function`.

- [ ] **Step 3: Implement `addSubscriberToSequence`**

In `api/_lib/_kit.js`, add this function immediately after `addSubscriberToForm` (after its closing brace):

```javascript
async function addSubscriberToSequence({ sequenceId, email, firstName = '' }) {
  const safeSequenceId = String(sequenceId || '').trim();
  if (!safeSequenceId) {
    throw new Error('Missing Kit sequence id');
  }
  if (!isValidEmail(email)) {
    throw new Error('Invalid subscriber email address');
  }

  // Upsert first so the subscriber exists and carries their first name, then
  // enroll them into the sequence. Unlike the form-automation trigger, this
  // enrollment is deterministic, so the nurture series actually starts.
  await upsertSubscriber({ email, firstName });

  const data = await kitRequest(`/sequences/${encodeURIComponent(safeSequenceId)}/subscribers`, {
    method: 'POST',
    body: { email_address: String(email).trim() },
  });

  return data && data.subscriber ? data.subscriber : null;
}
```

Then add `addSubscriberToSequence,` to the `module.exports` object, right after the `addSubscriberToForm,` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd site && node --test tests/kit-sequence.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/_kit.js tests/kit-sequence.test.js
git commit -m "feat(kit): add deterministic sequence enrollment helper"
```

---

## Task 2: Add delivery fields to the resource registry

**Files:**
- Modify: `api/_lib/_free-resource.js:6-35` (the `FREE_RESOURCES` object)

This is a data-only change; it is covered by tests in Tasks 3-5. No standalone test.

- [ ] **Step 1: Add `downloadUrl`, `emailSubject`, and `kitSequenceId` to the three in-scope entries**

Replace the `s1-tracker`, `s1-mock`, and `s2-slam-system` entries in `FREE_RESOURCES` with:

```javascript
  's1-tracker': {
    key: 's1-tracker',
    name: 'S1 Question Tracker',
    kitFormId: '8683298',
    kitSequenceId: '2723708',
    downloadUrl: 'https://docs.google.com/spreadsheets/d/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/edit?gid=788264791#gid=788264791',
    emailSubject: 'Your free S1 Question Tracker is inside',
    backupUrlEnv: 'FREE_RESOURCE_S1_TRACKER_BACKUP_URL',
    backupLabel: 'Open the tracker backup link',
  },
  's1-mock': {
    key: 's1-mock',
    name: 'S1 Mini Mock',
    kitFormId: '8717603',
    kitSequenceId: '2718570',
    downloadUrl: 'https://drive.google.com/file/d/12rRPRFxmef7Oe8FU2oTWP3Sp0jdnLztt/view?usp=sharing',
    emailSubject: 'Your free S1 Mini Mock is inside',
    backupUrlEnv: 'FREE_RESOURCE_S1_MOCK_BACKUP_URL',
    backupLabel: 'Open the mini-mock backup link',
  },
  's2-slam-system': {
    key: 's2-slam-system',
    name: 'S2 Slam System',
    kitFormId: '8526774',
    kitSequenceId: '2786194',
    downloadUrl: 'https://download.filekitcdn.com/d/2hU8i25SXZz1XsLtQta7Yr/9LJePVqF4moaNxMtw6K9uB',
    emailSubject: 'Your free S2 Slam System is inside',
    backupUrlEnv: 'FREE_RESOURCE_S2_SLAM_SYSTEM_BACKUP_URL',
    backupLabel: 'Open the S2 Slam System backup link',
  },
```

Leave the `interview-calculator` entry unchanged (out of scope; it has no `downloadUrl` and will route to the on-page fallback if ever hit).

- [ ] **Step 2: Commit**

```bash
git add api/_lib/_free-resource.js
git commit -m "feat(leads): add download links and nurture sequence ids to resource registry"
```

---

## Task 3: Primary Resend delivery email

**Files:**
- Modify: `api/_lib/_free-resource.js` (add `buildDeliveryEmailHtml` + `sendDeliveryEmail`, export `sendDeliveryEmail`)
- Test: `tests/free-resource-lead.test.js`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/free-resource-lead.test.js` with the following. (It is rewritten wholesale because the old `submitKitResourceLead` path is being removed; later tasks add to this file.)

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const freeResourceLeadHandler = require('../api/leads.js');
const freeResource = require('../api/_lib/_free-resource.js');
const kit = require('../api/_lib/_kit.js');

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// Captures every Resend send so tests can assert subject/link/recipient.
function mockResend(sentEmails) {
  freeResource.__setResendFactory(() => ({
    emails: {
      send: async (payload) => {
        sentEmails.push(payload);
        return { id: 'email_123' };
      },
    },
  }));
}

// Kit v4 mock that records calls and always succeeds.
function mockKitApiOk(calls) {
  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ subscriber: { id: 777, email_address: 'jane@example.com' } }),
    };
  });
}

test('sendDeliveryEmail emails the tracker link with the resource subject', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  const result = await freeResource.sendDeliveryEmail({
    resourceKey: 's1-tracker',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, 'hello@rohanstutoring.com');
  assert.equal(sent[0].to, 'jane@example.com');
  assert.equal(sent[0].subject, 'Your free S1 Question Tracker is inside');
  assert.match(sent[0].html, /spreadsheets\/d\/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/);
  assert.match(sent[0].text, /spreadsheets\/d\/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('sendDeliveryEmail emails the S2 Slam System link', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  const sent = [];
  mockResend(sent);

  await freeResource.sendDeliveryEmail({
    resourceKey: 's2-slam-system',
    firstName: 'Krshna',
    email: 'krshna@example.com',
  });

  assert.equal(sent[0].subject, 'Your free S2 Slam System is inside');
  assert.match(sent[0].html, /download\.filekitcdn\.com\/d\/2hU8i25SXZz1XsLtQta7Yr\/9LJePVqF4moaNxMtw6K9uB/);

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
});

test('sendDeliveryEmail throws when RESEND_API_KEY is missing', async () => {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    () => freeResource.sendDeliveryEmail({ resourceKey: 's1-tracker', email: 'jane@example.com' }),
    /RESEND_API_KEY/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: FAIL with `freeResource.sendDeliveryEmail is not a function`.

- [ ] **Step 3: Implement `buildDeliveryEmailHtml` and `sendDeliveryEmail`; update imports/exports**

In `api/_lib/_free-resource.js`, change the top import line to also pull in the sequence helper (needed by Task 4):

```javascript
const { isValidEmail, addSubscriberToForm, addSubscriberToSequence } = require('./_kit.js');
```

Add these two functions (place them just above the existing `buildFallbackPayload`):

```javascript
function buildDeliveryEmailHtml({ firstName, resource }) {
  const safeFirstName = normaliseFirstName(firstName) || 'there';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0a0f1e;padding:28px 32px;">
          <p style="margin:0;color:#60a5fa;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">ROHAN'S GAMSAT</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0a0f1e;line-height:1.3;">Your ${resource.name} is ready</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${safeFirstName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Here is the ${resource.name} you asked for. Open it with the button below.</p>
          <p style="margin:0 0 28px;">
            <a href="${resource.downloadUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:6px;">Open your ${resource.name}</a>
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">If the button does not work, use this link: <a href="${resource.downloadUrl}" style="color:#2563eb;text-decoration:none;">${resource.downloadUrl}</a></p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Talk soon,<br>Rohan</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendDeliveryEmail({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    throw new Error('Unknown free resource');
  }
  if (!resource.downloadUrl) {
    throw new Error(`No download URL configured for ${resourceKey}`);
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const safeEmail = String(email || '').trim();
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }
  if (!isValidEmail(safeEmail)) {
    throw new Error('Invalid subscriber email address');
  }

  const resend = resendFactory(apiKey);
  const result = await resend.emails.send({
    from: SUPPORT_EMAIL,
    to: safeEmail,
    subject: resource.emailSubject || `Your free ${resource.name}`,
    html: buildDeliveryEmailHtml({ firstName, resource }),
    text: `Hi ${normaliseFirstName(firstName) || 'there'},\n\nHere is your ${resource.name}:\n${resource.downloadUrl}\n\nTalk soon,\nRohan\n`,
  });

  return { sent: true, id: result && result.id ? result.id : null };
}
```

In `module.exports`, add `sendDeliveryEmail,` and (temporarily leave `submitKitResourceLead` and `sendFallbackEmail` in place; they are removed in Task 5).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/_free-resource.js tests/free-resource-lead.test.js
git commit -m "feat(leads): send lead magnet via Resend as the primary delivery path"
```

---

## Task 4: Best-effort Kit sync (list + nurture)

**Files:**
- Modify: `api/_lib/_free-resource.js` (add `syncKitForResource`, export it)
- Test: `tests/free-resource-lead.test.js` (append)

- [ ] **Step 1: Write the failing test**

Append these tests to `tests/free-resource-lead.test.js`:

```javascript
test('syncKitForResource adds the subscriber to the form and enrolls them in the nurture sequence', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  const calls = [];
  mockKitApiOk(calls);

  const result = await freeResource.syncKitForResource({
    resourceKey: 's1-tracker',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.synced, true);
  const formCall = calls.find((c) => c.url === 'https://api.kit.com/v4/forms/8683298/subscribers');
  const seqCall = calls.find((c) => c.url === 'https://api.kit.com/v4/sequences/2723708/subscribers');
  assert.ok(formCall, 'expected the form-subscribe call');
  assert.ok(seqCall, 'expected the sequence-subscribe call');

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});

test('syncKitForResource swallows Kit failures and never throws', async () => {
  process.env.KIT_API_KEY = 'kit_test_123';
  kit.__setFetch(async () => {
    throw new Error('Kit network failure');
  });

  const result = await freeResource.syncKitForResource({
    resourceKey: 's1-mock',
    firstName: 'Jane',
    email: 'jane@example.com',
  });

  assert.equal(result.synced, true);

  kit.__resetForTests();
  delete process.env.KIT_API_KEY;
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: FAIL with `freeResource.syncKitForResource is not a function`.

- [ ] **Step 3: Implement `syncKitForResource`**

In `api/_lib/_free-resource.js`, add this function just below `sendDeliveryEmail`:

```javascript
// Best-effort Kit sync run AFTER delivery has already succeeded. Never throws:
// a Kit outage must not affect the student who already has their resource.
async function syncKitForResource({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    return { synced: false, reason: 'unknown_resource' };
  }

  try {
    await addSubscriberToForm({ formId: resource.kitFormId, email, firstName });
  } catch (error) {
    console.error(`[leads/resource] Kit form add failed for ${resourceKey}:`, error.message);
  }

  if (resource.kitSequenceId) {
    try {
      await addSubscriberToSequence({ sequenceId: resource.kitSequenceId, email, firstName });
    } catch (error) {
      console.error(`[leads/resource] Kit sequence enroll failed for ${resourceKey}:`, error.message);
    }
  }

  return { synced: true };
}
```

Add `syncKitForResource,` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/_free-resource.js tests/free-resource-lead.test.js
git commit -m "feat(leads): best-effort Kit list + nurture sync after delivery"
```

---

## Task 5: Rewire the leads handler + remove dead Kit-primary code

**Files:**
- Modify: `api/leads.js` (imports + `handleResourceLead`)
- Modify: `api/_lib/_free-resource.js` (remove `submitKitResourceLead` and `sendFallbackEmail` + their exports)
- Test: `tests/free-resource-lead.test.js` (append handler-level tests)

- [ ] **Step 1: Write the failing tests**

Append to `tests/free-resource-lead.test.js`:

```javascript
test('handler returns delivered even when Kit sync fails', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.KIT_API_KEY = 'kit_test_123';
  const sent = [];
  mockResend(sent);
  kit.__setFetch(async () => { throw new Error('Kit down'); }); // Kit sync fails

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 's1-tracker', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.status, 'delivered');
  assert.equal(res.body.resource.name, 'S1 Question Tracker');
  assert.equal(sent.length, 1);

  kit.__resetForTests();
  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.KIT_API_KEY;
});

test('handler falls back on-page when the delivery email fails', async () => {
  process.env.RESEND_API_KEY = 're_test_123';
  process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL = 'https://example.com/tracker-backup';
  freeResource.__setResendFactory(() => ({
    emails: { send: async () => { throw new Error('Resend down'); } },
  }));

  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 's1-tracker', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.status, 'fallback');
  assert.equal(res.body.fallback.kind, 'download');
  assert.equal(res.body.fallback.url, 'https://example.com/tracker-backup');

  freeResource.__resetForTests();
  delete process.env.RESEND_API_KEY;
  delete process.env.FREE_RESOURCE_S1_TRACKER_BACKUP_URL;
});

test('handler rejects an unknown resource key', async () => {
  const req = {
    method: 'POST',
    headers: { origin: 'https://www.rohanstutoring.com' },
    body: { resourceKey: 'not-a-real-resource', firstName: 'Jane', email: 'jane@example.com' },
  };
  const res = createJsonResponseRecorder();

  await freeResourceLeadHandler(req, res);

  assert.equal(res.statusCode, 400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: FAIL — the handler still returns `status: 'kit'` and imports the removed functions.

- [ ] **Step 3: Rewire `handleResourceLead` in `api/leads.js`**

Replace the import block (currently lines 6-11) with:

```javascript
const {
  getFreeResource,
  sendDeliveryEmail,
  syncKitForResource,
  buildFallbackPayload,
} = require('./_lib/_free-resource.js');
```

Replace the entire `handleResourceLead` function with:

```javascript
async function handleResourceLead(body, res, req) {
  const lead = normaliseResourceLead(body);
  if (lead.error) return res.status(400).json({ error: lead.error });

  const rl = await checkRateLimit(req, { bucket: 'leads', email: lead.email });
  if (rl.limited) return res.status(429).json({ error: rl.message });

  let resource;
  try {
    const result = await sendDeliveryEmail(lead);
    resource = getFreeResource(lead.resourceKey);
    console.log(`[leads/resource] Delivered ${lead.resourceKey} to ${lead.email} (resend id: ${result.id || 'n/a'})`);
  } catch (error) {
    console.error(`[leads/resource] Delivery email failed for ${lead.resourceKey}:`, error.message);
    const fallback = buildFallbackPayload({ resourceKey: lead.resourceKey, emailSent: false });
    return res.status(202).json({
      ok: true,
      status: 'fallback',
      resource: { key: fallback.resource.key, name: fallback.resource.name },
      message: fallback.message,
      fallback: fallback.fallback,
    });
  }

  // Delivery already succeeded above. Kit sync is best-effort and never throws,
  // so a Kit outage cannot turn a delivered lead into a failure.
  await syncKitForResource(lead);

  return res.status(200).json({
    ok: true,
    status: 'delivered',
    resource: { key: resource.key, name: resource.name },
  });
}
```

- [ ] **Step 4: Remove the dead Kit-primary functions from `api/_lib/_free-resource.js`**

Delete the `submitKitResourceLead` function and the `sendFallbackEmail` function entirely, and remove `submitKitResourceLead,` and `sendFallbackEmail,` from `module.exports`. Keep `buildDeliveryEmailHtml`, `buildFallbackPayload`, `buildSupportMailtoUrl`, `getBackupUrl`, and `getFreeResource`. (`buildFallbackEmailHtml` is now unused — delete it too and confirm nothing else references it.)

Verify no remaining references:

Run: `cd site && grep -rn "submitKitResourceLead\|sendFallbackEmail\|buildFallbackEmailHtml" api/ tests/ js/`
Expected: no output.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd site && node --test tests/free-resource-lead.test.js`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add api/leads.js api/_lib/_free-resource.js tests/free-resource-lead.test.js
git commit -m "feat(leads): deliver-first handler flow; drop Kit-primary delivery path"
```

---

## Task 6: Update frontend delivery-analytics gate

**Files:**
- Modify: `js/tracker.js:77`
- Modify: `js/s1-mock.js:41`

The success status the API returns changed from `kit` to `delivered`. Two frontend files gate the `free_resource_download` analytics event on the old value.

- [ ] **Step 1: Update `js/tracker.js`**

Find:

```javascript
      if (status === 'kit') {
        fireDeliveryEvent();
      }
```

Replace with:

```javascript
      if (status === 'delivered') {
        fireDeliveryEvent();
      }
```

- [ ] **Step 2: Update `js/s1-mock.js`**

Make the identical change in `js/s1-mock.js` (the `onLeadCaptured` callback):

```javascript
      if (status === 'delivered') {
        fireDeliveryEvent();
      }
```

- [ ] **Step 3: Confirm no other frontend file gates on the old value**

Run: `cd site && grep -rn "=== 'kit'" js/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add js/tracker.js js/s1-mock.js
git commit -m "fix(leads): gate download analytics on the new delivered status"
```

---

## Task 7: Full suite + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd site && npm test`
Expected: all tests pass, including the new `tests/kit-sequence.test.js` and the rewritten `tests/free-resource-lead.test.js`.

- [ ] **Step 2: Local smoke test of each form (requires real KIT_API_KEY + RESEND_API_KEY in env)**

Start the site (`cd site && python3 -m http.server 8000` will not run the serverless functions; use `vercel dev` instead):

Run: `cd site && vercel dev`

Submit each of the three forms (S1 Tracker, S1 Mini Mock, S2 Slam System) with a test inbox and confirm:
- The delivery email arrives from `hello@rohanstutoring.com` with the correct download link.
- The subscriber appears in the matching Kit form and nurture sequence.

- [ ] **Step 3: Pre-ship checklist (manual, outside this repo)**

Confirm before deploying:
- [ ] `hello@rohanstutoring.com` is a verified sender/domain in Resend.
- [ ] Rohan deletes email #1 (the "here's your resource" email) from each of the three Kit funnels (2723708, 2718570, 2786194) so students do not receive the asset twice.

- [ ] **Step 4: Final commit if any verification-driven fixes were made**

```bash
git add -A
git commit -m "test(leads): verify server-owned lead magnet delivery"
```

---

## Self-Review notes

- **Spec coverage:** asset registry (Task 2), primary Resend delivery (Task 3), deliver-first handler flow (Task 5), deterministic nurture enrollment (Tasks 1 + 4), on-page fallback on Resend failure (Task 5), testing (Tasks 1-5), manual verification incl. the Kit email-#1 trim + Resend domain check (Task 7). Interview Calculator explicitly out of scope.
- **Type/name consistency:** `sendDeliveryEmail`, `syncKitForResource`, `addSubscriberToSequence`, `buildDeliveryEmailHtml`, and status value `'delivered'` are used identically across every task and the frontend gate.
