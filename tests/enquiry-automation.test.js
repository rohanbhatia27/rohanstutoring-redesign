const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const formspreeWebhookHandler = require('../api/formspree-webhook.js');
const testDraftHandler = require('../api/test-draft.js');
const formspree = require('../api/_lib/_formspree-webhook.js');
const enquiryOffers = require('../api/_lib/_enquiry-offers.js');
const enquiryPipeline = require('../api/_lib/_enquiry-pipeline.js');
const gmailDrafts = require('../api/_lib/_gmail-drafts.js');
const gmailOAuth = require('../api/_lib/_gmail-oauth.js');
const gmailOAuthHandler = require('../api/gmail/oauth.js');
const aiEnquiry = require('../api/_lib/_openai-enquiry.js');

function createJsonResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };
}

function buildSignature(secret, timestamp, rawBody) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

test('enquiry offer router sends urgent, high-friction leads to a consult path', () => {
  const route = enquiryOffers.routeRecommendedOffer({
    leadType: 'student',
    urgency: 'critical',
    buyerIntent: 'ready_to_book',
    emotionalState: 'overwhelmed',
    recommendedNextStep: '1:1 consult',
    subjectNeed: 'essay_help',
  });

  assert.equal(route.offerKey, 'privateMentoring');
  assert.match(route.url, /\/courses\/private-mentoring$/);
  assert.match(route.cta, /consult/i);
});

test('enquiry offer router sends essay-specific, lower-friction leads to essay support', () => {
  const route = enquiryOffers.routeRecommendedOffer({
    leadType: 'student',
    urgency: 'medium',
    buyerIntent: 'needs_reassurance',
    emotionalState: 'confused',
    recommendedNextStep: 'course page',
    subjectNeed: 'essay_help',
  });

  assert.equal(route.offerKey, 'essayMarking');
  assert.match(route.url, /\/courses\/essay-marking$/);
});

test('gmail draft helper refreshes an access token and creates a draft message', async () => {
  const calls = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GMAIL_REFRESH_TOKEN = 'gmail_refresh_token';

  gmailDrafts.__setFetch(async (url, options = {}) => {
    calls.push({ url, options });

    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'gmail_access_token' }),
      };
    }

    if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/drafts') {
      const payload = JSON.parse(options.body);
      assert.ok(payload.message.raw);
      const decoded = Buffer.from(payload.message.raw, 'base64url').toString('utf8');
      assert.match(decoded, /^To: jane@example.com/m);
      assert.match(decoded, /^Subject: Re: Tutoring enquiry/m);
      assert.match(decoded, /\r?\n\r?\nHi Jane,/);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'r_draft_123', message: { id: 'msg_123' } }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const draft = await gmailDrafts.createDraft({
    to: 'jane@example.com',
    subject: 'Re: Tutoring enquiry',
    body: 'Hi Jane,\n\nThanks for reaching out.\n\nWarmly,\nRohan',
  });

  assert.equal(draft.id, 'r_draft_123');
  assert.equal(calls.length, 2);

  gmailDrafts.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GMAIL_REFRESH_TOKEN;
});

test('Formspree webhook handler verifies the signature and passes the normalized enquiry to the pipeline', async () => {
  const received = [];
  const rawBody = JSON.stringify({
    form: 'mvzvldzo',
    keys: ['firstName', 'lastName', 'email', 'service', 'message', 'source', 'page', 'subject'],
    submission: {
      firstName: 'Sarah',
      lastName: 'Nguyen',
      email: 'sarah@example.com',
      service: '1-1 Classes',
      message: 'I sat the GAMSAT before and need help urgently with essays before September.',
      source: 'contact-form',
      page: 'contact',
      subject: 'New contact enquiry from rohanstutoring.com',
    },
  });

  process.env.FORMSPREE_WEBHOOK_SECRET = 'formspree_secret';

  enquiryPipeline.__setProcessFormspreeEnquiry(async (payload) => {
    received.push(payload);
    return {
      ok: true,
      classification: { recommendedPath: 'private_mentoring', confidence: 0.92 },
      recommendedOffer: { offerKey: 'privateMentoring', url: 'https://www.rohanstutoring.com/courses/private-mentoring' },
      draft: { id: 'r_draft_123' },
    };
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const req = {
    method: 'POST',
    headers: {
      'formspree-signature': buildSignature(process.env.FORMSPREE_WEBHOOK_SECRET, timestamp, rawBody),
    },
    rawBody,
    body: JSON.parse(rawBody),
  };
  const res = createJsonResponseRecorder();

  await formspreeWebhookHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(received.length, 1);
  assert.equal(received[0].enquiry.email, 'sarah@example.com');
  assert.equal(received[0].enquiry.name, 'Sarah Nguyen');
  assert.equal(received[0].enquiry.source, 'contact-form');

  enquiryPipeline.__resetForTests();
  delete process.env.FORMSPREE_WEBHOOK_SECRET;
});

test('Formspree webhook handler rejects an invalid signature', async () => {
  process.env.FORMSPREE_WEBHOOK_SECRET = 'formspree_secret';

  const req = {
    method: 'POST',
    headers: { 'formspree-signature': 't=1,v1=bad' },
    rawBody: '{"submission":{"email":"bad@example.com"}}',
    body: { submission: { email: 'bad@example.com' } },
  };
  const res = createJsonResponseRecorder();

  await formspreeWebhookHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Invalid Formspree signature.' });

  delete process.env.FORMSPREE_WEBHOOK_SECRET;
});

test('test draft handler returns a dry-run preview for authorized requests', async () => {
  process.env.ENQUIRY_AUTOMATION_TOKEN = 'automation_secret';

  enquiryPipeline.__setPreviewDraft(async ({ enquiry }) => ({
    classification: {
      recommendedPath: 'blueprint',
      confidence: 0.78,
    },
    recommendedOffer: {
      offerKey: 'blueprint',
      url: 'https://www.rohanstutoring.com/courses/blueprint',
    },
    emailDraft: {
      subject: 'Re: Blueprint question',
      body: 'Hi Alex,\n\nBlueprint is likely the best next step here.\n\nWarmly,\nRohan',
    },
  }));

  const req = {
    method: 'POST',
    headers: { 'x-enquiry-automation-token': 'automation_secret' },
    body: {
      dryRun: true,
      enquiry: {
        name: 'Alex',
        email: 'alex@example.com',
        message: 'I am studying on my own and want structure before September.',
        source: 'manual-test',
      },
    },
  };
  const res = createJsonResponseRecorder();

  await testDraftHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.mode, 'preview');
  assert.equal(res.body.emailDraft.subject, 'Re: Blueprint question');

  enquiryPipeline.__resetForTests();
  delete process.env.ENQUIRY_AUTOMATION_TOKEN;
});

test('gmail OAuth helper builds a compose-scoped auth URL', () => {
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GMAIL_REDIRECT_URI = 'https://www.rohanstutoring.com/api/gmail/oauth/callback';

  const url = new URL(gmailOAuth.buildAuthUrl({
    headers: { host: 'www.rohanstutoring.com' },
  }));

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.compose');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://www.rohanstutoring.com/api/gmail/oauth/callback');

  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GMAIL_REDIRECT_URI;
});

test('gmail OAuth handler serves start and callback actions from one route', async () => {
  process.env.ENQUIRY_AUTOMATION_TOKEN = 'automation_secret';
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GMAIL_REDIRECT_URI = 'https://www.rohanstutoring.com/api/gmail/oauth/callback';

  gmailOAuth.__setFetch(async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('client_id'), 'google_client_id');
    assert.equal(body.get('client_secret'), 'google_client_secret');
    assert.equal(body.get('redirect_uri'), 'https://www.rohanstutoring.com/api/gmail/oauth/callback');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ refresh_token: 'gmail_refresh_token_123' }),
    };
  });

  const startReq = {
    method: 'GET',
    headers: { 'x-enquiry-automation-token': 'automation_secret', host: 'www.rohanstutoring.com' },
    query: { action: 'start' },
  };
  const startRes = createJsonResponseRecorder();
  await gmailOAuthHandler(startReq, startRes);

  assert.equal(startRes.statusCode, 200);
  assert.match(startRes.body.authUrl, /accounts\.google\.com/);
  assert.equal(startRes.body.redirectUri, 'https://www.rohanstutoring.com/api/gmail/oauth/callback');

  const callbackReq = {
    method: 'GET',
    headers: { host: 'www.rohanstutoring.com' },
    query: {
      action: 'callback',
      code: 'auth_code_123',
      state: gmailOAuth.buildState(),
    },
  };
  const callbackRes = createJsonResponseRecorder();
  await gmailOAuthHandler(callbackReq, callbackRes);

  assert.equal(callbackRes.statusCode, 200);
  assert.match(callbackRes.body, /gmail_refresh_token_123/);

  gmailOAuth.__resetForTests();
  delete process.env.ENQUIRY_AUTOMATION_TOKEN;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GMAIL_REDIRECT_URI;
});

test('AI enquiry helper supports DeepSeek chat completions for structured classification', async () => {
  process.env.AI_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'deepseek_api_key';
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';

  aiEnquiry.__setFetch(async (url, options = {}) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer deepseek_api_key');

    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'deepseek-v4-flash');
    assert.equal(payload.response_format.type, 'json_object');
    assert.equal(payload.messages[0].role, 'system');
    assert.equal(payload.messages[1].role, 'user');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'chatcmpl_123',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                leadType: 'student',
                studentStage: 'gamsat_candidate',
                examContext: 'resitter',
                subjectNeed: 'essay_help',
                urgency: 'high',
                buyerIntent: 'ready_to_book',
                emotionalState: 'overwhelmed',
                recommendedPath: 'private_mentoring',
                recommendedNextStep: '1:1 consult',
                manualReview: false,
                confidence: 0.91,
                reasoningSummary: 'Urgent repeat-sitter asking for specific help.',
              }),
            },
          },
        ],
      }),
    };
  });

  const result = await aiEnquiry.classifyEnquiry({
    enquiry: {
      email: 'jane@example.com',
      message: 'I have sat the GAMSAT before and urgently need help with essays.',
    },
    offers: enquiryOffers.OFFERS,
  });

  assert.equal(result.recommendedPath, 'private_mentoring');
  assert.equal(result.confidence, 0.91);

  aiEnquiry.__resetForTests();
  delete process.env.AI_PROVIDER;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
});
