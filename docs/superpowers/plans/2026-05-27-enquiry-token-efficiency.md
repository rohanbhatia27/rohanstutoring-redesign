# Enquiry Token Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce DeepSeek token usage for Gmail enquiry drafts while preserving warm, specific, conversion-aware replies.

**Architecture:** Add deterministic pre-routing before AI, split classifier and draft models, compact the AI payloads, and cap output tokens. Keep Gmail draft creation, routing config, and public API behavior unchanged.

**Tech Stack:** Vercel serverless functions, Node.js built-in test runner, vanilla CommonJS helpers, DeepSeek/OpenAI-compatible HTTP APIs.

---

## File Structure

- Modify: `api/_lib/_enquiry-pipeline.js`
  - Owns pre-routing before model calls.
  - Keeps fallback and clarifying draft behavior.
  - Exports small test hooks for pre-router behavior if needed.
- Modify: `api/_lib/_openai-enquiry.js`
  - Owns provider/model selection, payload compaction, prompt shape, and output token caps.
  - Keeps existing public functions: `classifyEnquiry` and `generateReplyDraft`.
- Modify: `tests/enquiry-automation.test.js`
  - Adds regression tests for skipped classifier calls, model split, compact payloads, and DeepSeek `max_tokens`.
- Optional docs update: `api/.env.example` or `.env.example`
  - Add optional model/cap env vars only if implementation introduces new names.

---

## Configuration Decisions

Use these defaults unless tests or real responses suggest otherwise:

- `DEEPSEEK_CLASSIFIER_MODEL`: optional, defaults to `deepseek-v4-flash`
- `DEEPSEEK_DRAFT_MODEL`: optional, defaults to `DEEPSEEK_MODEL || deepseek-v4-pro`
- `OPENAI_CLASSIFIER_MODEL`: optional, defaults to `OPENAI_ENQUIRY_MODEL || gpt-4.1-mini`
- `OPENAI_DRAFT_MODEL`: optional, defaults to `OPENAI_ENQUIRY_MODEL || gpt-4.1-mini`
- Classifier output cap: `350` tokens
- Draft output cap: `700` tokens

Do not remove `DEEPSEEK_MODEL`; keep it as a backward-compatible draft-model fallback.

---

### Task 1: Add Local Pre-Router Before AI Classification

**Files:**
- Modify: `api/_lib/_enquiry-pipeline.js`
- Test: `tests/enquiry-automation.test.js`

- [ ] **Step 1: Write failing tests for pre-router AI skips**

Add tests that prove obvious enquiries do not call DeepSeek/OpenAI classification.

```js
test('previewDraft skips AI classification for sensitive enquiries', async () => {
  let aiCalled = false;
  aiEnquiry.__setFetch(async () => {
    aiCalled = true;
    return { ok: true, json: async () => ({}) };
  });

  const result = await enquiryPipeline.previewDraft({
    enquiry: {
      name: 'Concerned Student',
      email: 'student@example.com',
      message: 'I am really angry and want a refund. This feels like a legal issue.',
    },
  });

  assert.equal(aiCalled, false);
  assert.equal(result.classification.manualReview, true);
  assert.equal(result.recommendedOffer.key, 'manualReview');

  aiEnquiry.__resetForTests();
});

test('previewDraft skips AI classification for short vague enquiries', async () => {
  let aiCalled = false;
  aiEnquiry.__setFetch(async () => {
    aiCalled = true;
    return { ok: true, json: async () => ({}) };
  });

  const result = await enquiryPipeline.previewDraft({
    enquiry: {
      name: 'Ari',
      email: 'ari@example.com',
      message: 'Need help',
    },
  });

  assert.equal(aiCalled, false);
  assert.equal(result.classification.recommendedPath, 'clarifying_reply');
  assert.equal(result.emailDraft.recommendedCta, 'clarifyingReply');

  aiEnquiry.__resetForTests();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: the new tests fail because `previewDraft` still calls `classifyEnquiry` first.

- [ ] **Step 3: Implement the pre-router**

In `api/_lib/_enquiry-pipeline.js`, introduce a local function and use it before `classifyEnquiry`.

```js
function getLocalClassification(enquiry) {
  const message = String(enquiry.message || '').toLowerCase();
  const service = String(enquiry.service || '').toLowerCase();

  const sensitive = /(refund|complaint|lawyer|legal|depressed|self-harm|suicid|angry|scam)/.test(message);
  if (sensitive) return fallbackClassification(enquiry);

  const compactMessage = message.replace(/\s+/g, ' ').trim();
  if (compactMessage.length < 24) return fallbackClassification(enquiry);

  const essayOnly = /(essay|essays|section 2|s2)/.test(message);
  const urgent = /(urgent|asap|soon|trial|book|booking|availability|consult|call)/.test(message);
  const resit = /(resit|re-sit|sat the gamsat before|again|another sitting|second attempt|third attempt)/.test(message);

  if (essayOnly && !urgent && !resit) return fallbackClassification(enquiry);
  if ((urgent || resit || service.includes('1-1')) && compactMessage.length < 280) {
    return fallbackClassification(enquiry);
  }

  return null;
}
```

Then update `buildPreview`:

```js
async function buildPreview({ enquiry }) {
  let classification = getLocalClassification(enquiry);

  if (!classification) {
    try {
      classification = await classifyEnquiry({ enquiry, offers: OFFERS });
    } catch (error) {
      classification = fallbackClassification(enquiry);
    }
  }

  const recommendedOffer = routeRecommendedOffer(classification);
  // keep the rest of the function unchanged
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: new pre-router tests pass.

---

### Task 2: Split Classifier And Draft Models

**Files:**
- Modify: `api/_lib/_openai-enquiry.js`
- Test: `tests/enquiry-automation.test.js`

- [ ] **Step 1: Write failing test for DeepSeek model split**

Add a test that classification uses `DEEPSEEK_CLASSIFIER_MODEL` and draft generation uses `DEEPSEEK_DRAFT_MODEL`.

```js
test('DeepSeek classifier and draft calls use separate model settings', async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousClassifier = process.env.DEEPSEEK_CLASSIFIER_MODEL;
  const previousDraft = process.env.DEEPSEEK_DRAFT_MODEL;
  const previousKey = process.env.DEEPSEEK_API_KEY;

  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'deepseek_test_key';
  process.env.DEEPSEEK_CLASSIFIER_MODEL = 'deepseek-v4-flash';
  process.env.DEEPSEEK_DRAFT_MODEL = 'deepseek-v4-pro';

  const seenModels = [];
  aiEnquiry.__setFetch(async (url, options) => {
    const body = JSON.parse(options.body);
    seenModels.push(body.model);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: seenModels.length === 1
              ? JSON.stringify({
                  leadType: 'student',
                  studentStage: 'gamsat_candidate',
                  examContext: 'self_study',
                  subjectNeed: 'general_gamsat',
                  urgency: 'low',
                  buyerIntent: 'comparing_options',
                  emotionalState: 'ambitious',
                  recommendedPath: 'blueprint',
                  recommendedNextStep: 'course page',
                  manualReview: false,
                  confidence: 0.88,
                  reasoningSummary: 'Structured self-study enquiry.',
                })
              : JSON.stringify({
                  subject: 'Re: GAMSAT support',
                  body: 'Hi Sam,\\n\\nThanks for reaching out. Based on what you shared, I would start with the Blueprint.\\n\\nWarmly,\\nRohan',
                  recommendedCta: 'blueprint',
                  confidence: 0.88,
                  reviewNotes: 'Clear self-study fit.',
                }),
          },
        }],
      }),
    };
  });

  const enquiry = {
    name: 'Sam',
    email: 'sam@example.com',
    message: 'I am comparing options for GAMSAT study structure and want help deciding where to start.',
  };

  const classification = await aiEnquiry.classifyEnquiry({ enquiry, offers: enquiryOffers.OFFERS });
  await aiEnquiry.generateReplyDraft({
    enquiry,
    classification,
    recommendedOffer: enquiryOffers.OFFERS.blueprint,
  });

  assert.deepEqual(seenModels, ['deepseek-v4-flash', 'deepseek-v4-pro']);

  process.env.AI_PROVIDER = previousProvider;
  process.env.DEEPSEEK_CLASSIFIER_MODEL = previousClassifier;
  process.env.DEEPSEEK_DRAFT_MODEL = previousDraft;
  process.env.DEEPSEEK_API_KEY = previousKey;
  aiEnquiry.__resetForTests();
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: test fails because `getModel(provider)` does not distinguish classifier and draft calls.

- [ ] **Step 3: Update model selection**

In `api/_lib/_openai-enquiry.js`, replace `getModel(provider)` with purpose-aware model selection.

```js
function getModel(provider, purpose = 'draft') {
  if (provider === 'deepseek') {
    if (purpose === 'classification') {
      return getOptionalEnv('DEEPSEEK_CLASSIFIER_MODEL') || 'deepseek-v4-flash';
    }
    return getOptionalEnv('DEEPSEEK_DRAFT_MODEL') || getOptionalEnv('DEEPSEEK_MODEL') || 'deepseek-v4-pro';
  }

  if (purpose === 'classification') {
    return getOptionalEnv('OPENAI_CLASSIFIER_MODEL') || getOptionalEnv('OPENAI_ENQUIRY_MODEL') || 'gpt-4.1-mini';
  }
  return getOptionalEnv('OPENAI_DRAFT_MODEL') || getOptionalEnv('OPENAI_ENQUIRY_MODEL') || 'gpt-4.1-mini';
}
```

Change `requestStructuredOutput` and provider functions to accept `purpose`.

```js
async function requestStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose }) {
  const provider = getAiProvider();
  if (provider === 'deepseek') {
    return requestDeepSeekStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose });
  }
  return requestOpenAiStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose });
}
```

Set `purpose: 'classification'` in `classifyEnquiry` and `purpose: 'draft'` in `generateReplyDraft`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: model split test passes.

---

### Task 3: Compact AI Prompt Payloads

**Files:**
- Modify: `api/_lib/_openai-enquiry.js`
- Test: `tests/enquiry-automation.test.js`

- [ ] **Step 1: Write failing test for compact classifier payload**

Add a test that the classifier does not send full offer URLs and does not pretty-print the JSON payload.

```js
test('classifier sends compact routing payload without offer URLs', async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'deepseek_test_key';

  let userContent = '';
  aiEnquiry.__setFetch(async (url, options) => {
    const body = JSON.parse(options.body);
    userContent = body.messages[1].content;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              leadType: 'student',
              studentStage: 'gamsat_candidate',
              examContext: 'self_study',
              subjectNeed: 'general_gamsat',
              urgency: 'low',
              buyerIntent: 'comparing_options',
              emotionalState: 'ambitious',
              recommendedPath: 'blueprint',
              recommendedNextStep: 'course page',
              manualReview: false,
              confidence: 0.88,
              reasoningSummary: 'Structured self-study enquiry.',
            }),
          },
        }],
      }),
    };
  });

  await aiEnquiry.classifyEnquiry({
    enquiry: {
      name: 'Sam Example',
      email: 'sam@example.com',
      subject: 'GAMSAT help',
      message: 'I want a structured way to prepare for the GAMSAT and compare options.',
      irrelevantInternalField: 'this should not be sent',
    },
    offers: enquiryOffers.OFFERS,
  });

  assert.doesNotMatch(userContent, /https?:\\/\\//);
  assert.doesNotMatch(userContent, /irrelevantInternalField/);
  assert.doesNotMatch(userContent, /\\n\\s{2,}"/);

  process.env.AI_PROVIDER = previousProvider;
  process.env.DEEPSEEK_API_KEY = previousKey;
  aiEnquiry.__resetForTests();
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: test fails because the current classifier sends pretty-printed full enquiry and offer URLs.

- [ ] **Step 3: Add compact payload helpers**

In `api/_lib/_openai-enquiry.js`, add:

```js
function compactEnquiry(enquiry = {}) {
  return {
    name: String(enquiry.firstName || enquiry.name || '').trim(),
    email: String(enquiry.email || '').trim(),
    subject: String(enquiry.subject || '').trim(),
    service: String(enquiry.service || '').trim(),
    source: String(enquiry.source || '').trim(),
    message: String(enquiry.message || '').trim().slice(0, 2500),
  };
}

function compactClassification(classification = {}) {
  return {
    leadType: classification.leadType,
    studentStage: classification.studentStage,
    subjectNeed: classification.subjectNeed,
    urgency: classification.urgency,
    buyerIntent: classification.buyerIntent,
    emotionalState: classification.emotionalState,
    recommendedPath: classification.recommendedPath,
    recommendedNextStep: classification.recommendedNextStep,
    manualReview: classification.manualReview,
    confidence: classification.confidence,
    reasoningSummary: classification.reasoningSummary,
  };
}

function compactOfferForDraft(offer = {}) {
  return {
    key: offer.key,
    name: offer.name,
    cta: offer.cta,
    url: offer.url,
  };
}
```

- [ ] **Step 4: Use compact JSON.stringify without formatting**

Update `classifyEnquiry`:

```js
const userPrompt = JSON.stringify({
  enquiry: compactEnquiry(enquiry),
  allowedPaths: [
    'private_mentoring',
    'blueprint',
    'essay_marking',
    'lead_magnet',
    'clarifying_reply',
    'manual_review',
  ],
});
```

Update `generateReplyDraft`:

```js
const userPrompt = JSON.stringify({
  enquiry: compactEnquiry(enquiry),
  classification: compactClassification(classification),
  recommendedOffer: compactOfferForDraft(recommendedOffer),
});
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: compact payload test passes.

---

### Task 4: Add Output Token Caps

**Files:**
- Modify: `api/_lib/_openai-enquiry.js`
- Test: `tests/enquiry-automation.test.js`

- [ ] **Step 1: Write failing test for DeepSeek max token caps**

Add a test that DeepSeek requests include smaller caps for classification and larger but bounded caps for drafts.

```js
test('DeepSeek requests include output token caps by purpose', async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'deepseek_test_key';

  const seenCaps = [];
  aiEnquiry.__setFetch(async (url, options) => {
    const body = JSON.parse(options.body);
    seenCaps.push(body.max_tokens);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: seenCaps.length === 1
              ? JSON.stringify({
                  leadType: 'student',
                  studentStage: 'gamsat_candidate',
                  examContext: 'self_study',
                  subjectNeed: 'general_gamsat',
                  urgency: 'low',
                  buyerIntent: 'comparing_options',
                  emotionalState: 'ambitious',
                  recommendedPath: 'blueprint',
                  recommendedNextStep: 'course page',
                  manualReview: false,
                  confidence: 0.88,
                  reasoningSummary: 'Structured self-study enquiry.',
                })
              : JSON.stringify({
                  subject: 'Re: GAMSAT support',
                  body: 'Hi Sam,\\n\\nThanks for reaching out. Based on what you shared, I would start with the Blueprint.\\n\\nWarmly,\\nRohan',
                  recommendedCta: 'blueprint',
                  confidence: 0.88,
                  reviewNotes: 'Clear self-study fit.',
                }),
          },
        }],
      }),
    };
  });

  const enquiry = {
    name: 'Sam',
    email: 'sam@example.com',
    message: 'I am comparing options for GAMSAT study structure and want help deciding where to start.',
  };
  const classification = await aiEnquiry.classifyEnquiry({ enquiry, offers: enquiryOffers.OFFERS });
  await aiEnquiry.generateReplyDraft({
    enquiry,
    classification,
    recommendedOffer: enquiryOffers.OFFERS.blueprint,
  });

  assert.deepEqual(seenCaps, [350, 700]);

  process.env.AI_PROVIDER = previousProvider;
  process.env.DEEPSEEK_API_KEY = previousKey;
  aiEnquiry.__resetForTests();
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: test fails because `max_tokens` is not currently sent.

- [ ] **Step 3: Add cap helpers**

In `api/_lib/_openai-enquiry.js`, add:

```js
function getOutputTokenCap(purpose) {
  if (purpose === 'classification') {
    return Number(getOptionalEnv('AI_CLASSIFIER_MAX_TOKENS')) || 350;
  }
  return Number(getOptionalEnv('AI_DRAFT_MAX_TOKENS')) || 700;
}
```

In `requestDeepSeekStructuredOutput`, include:

```js
max_tokens: getOutputTokenCap(purpose),
```

In `requestOpenAiStructuredOutput`, include:

```js
max_output_tokens: getOutputTokenCap(purpose),
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: token cap tests pass.

---

### Task 5: Tighten Draft Length Instructions Without Flattening Voice

**Files:**
- Modify: `api/_lib/_openai-enquiry.js`
- Test: `tests/enquiry-automation.test.js`

- [ ] **Step 1: Write failing test for concise draft prompt**

Add a test that the draft generation prompt explicitly asks for a short, premium reply.

```js
test('draft prompt asks for concise premium replies', async () => {
  const previousProvider = process.env.AI_PROVIDER;
  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'deepseek_test_key';

  let systemContent = '';
  aiEnquiry.__setFetch(async (url, options) => {
    const body = JSON.parse(options.body);
    systemContent = body.messages[0].content;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              subject: 'Re: GAMSAT support',
              body: 'Hi Sam,\\n\\nThanks for reaching out. Based on what you shared, I would start with the Blueprint.\\n\\nWarmly,\\nRohan',
              recommendedCta: 'blueprint',
              confidence: 0.88,
              reviewNotes: 'Clear self-study fit.',
            }),
          },
        }],
      }),
    };
  });

  await aiEnquiry.generateReplyDraft({
    enquiry: {
      name: 'Sam',
      email: 'sam@example.com',
      message: 'I am comparing options for GAMSAT study structure.',
    },
    classification: {
      recommendedPath: 'blueprint',
      confidence: 0.88,
      manualReview: false,
    },
    recommendedOffer: enquiryOffers.OFFERS.blueprint,
  });

  assert.match(systemContent, /160-240 words/);
  assert.match(systemContent, /one CTA/i);
  assert.match(systemContent, /short paragraphs/i);

  process.env.AI_PROVIDER = previousProvider;
  process.env.DEEPSEEK_API_KEY = previousKey;
  aiEnquiry.__resetForTests();
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: test fails because the current draft prompt does not include a word range.

- [ ] **Step 3: Update draft prompt**

In `generateReplyDraft`, add concise length guidance while keeping the existing tone rules.

```js
'Keep the body to 160-240 words unless the enquiry is unusually complex.',
'Use short paragraphs, one clear recommendation, and one CTA link.',
```

Keep the existing rules:

```js
'Acknowledge the actual concern, validate it briefly, diagnose what likely matters, recommend one next step, explain why, give one low-friction CTA, and close warmly.',
'Never claim availability or outcomes you cannot know.',
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd site
node --test tests/enquiry-automation.test.js
```

Expected: concise draft prompt test passes.

---

### Task 6: Final Verification

**Files:**
- No additional source changes expected.

- [ ] **Step 1: Run full test suite**

Run:

```bash
cd site
npm test
```

Expected:

```txt
fail 0
```

- [ ] **Step 2: Verify function count is unchanged**

Run:

```bash
cd site
find api -type f | grep -v '/_lib/' | wc -l
```

Expected:

```txt
12
```

- [ ] **Step 3: Run dry preview through the existing endpoint**

Use the existing `/api/test-draft` dry-run path with a representative enquiry. Expected behavior:

- Urgent/obvious cases skip classifier and still produce a relevant draft or clarifying draft.
- Normal nuanced enquiries still call AI.
- Draft output remains warm, specific, and concise.

- [ ] **Step 4: Review git diff**

Run:

```bash
cd site
git diff -- api/_lib/_enquiry-pipeline.js api/_lib/_openai-enquiry.js tests/enquiry-automation.test.js
```

Expected:

- No changes to Gmail draft sending behavior.
- No changes to public API response shape.
- No hardcoded secrets.
- No new serverless functions.

---

## Self-Review

**Spec coverage:** This plan implements items 1, 3, 4, and 5 from the recommendation list: local pre-router, DeepSeek model split, compact payloads, and output caps/short draft shape.

**Intentionally excluded:** The single-call combined classifier+draft path is not included because the user chose not to implement that item now.

**Quality guard:** The draft prompt keeps the empathy, diagnosis, recommendation, reason, CTA, and warm close requirements. The savings come from fewer calls for obvious cases, cheaper classification, smaller payloads, and bounded output.

