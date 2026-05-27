'use strict';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

let fetchImpl = (...args) => fetch(...args);

function getOptionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function getAiProvider() {
  const provider = getOptionalEnv('AI_PROVIDER').toLowerCase();
  return provider === 'deepseek' ? 'deepseek' : 'openai';
}

function requireApiKey(provider) {
  if (provider === 'deepseek') {
    const key = getOptionalEnv('DEEPSEEK_API_KEY');
    if (!key) throw new Error('Missing DEEPSEEK_API_KEY environment variable');
    return key;
  }

  const key = getOptionalEnv('OPENAI_API_KEY');
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

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

function getOutputTokenCap(purpose) {
  if (purpose === 'classification') {
    return Number(getOptionalEnv('AI_CLASSIFIER_MAX_TOKENS')) || 350;
  }

  return Number(getOptionalEnv('AI_DRAFT_MAX_TOKENS')) || 700;
}

function getOutputText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts = [];
  output.forEach((item) => {
    const content = Array.isArray(item.content) ? item.content : [];
    content.forEach((entry) => {
      if (entry.type === 'output_text' && entry.text) {
        parts.push(entry.text);
      }
    });
  });

  return parts.join('\n').trim();
}

function getDeepSeekMessageContent(payload) {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice && choice.message ? choice.message.content : '';
  return typeof content === 'string' ? content.trim() : '';
}

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

function validateType(value, expectedType) {
  if (expectedType === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (expectedType === 'boolean') {
    return typeof value === 'boolean';
  }

  if (expectedType === 'string') {
    return typeof value === 'string';
  }

  return true;
}

function validateStructuredOutput(payload, schema) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('AI output was not a JSON object.');
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  required.forEach((key) => {
    if (!(key in payload)) {
      throw new Error(`AI output missing required field: ${key}`);
    }
  });

  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties
    : {};

  Object.entries(properties).forEach(([key, config]) => {
    if (!(key in payload) || !config || !config.type) return;
    if (!validateType(payload[key], config.type)) {
      throw new Error(`AI output field has wrong type: ${key}`);
    }
  });

  return payload;
}

async function requestOpenAiStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose }) {
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey('openai')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel('openai', purpose),
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
      max_output_tokens: getOutputTokenCap(purpose),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${payload.error?.message || 'Unknown OpenAI error'}`
    );
  }

  const outputText = getOutputText(payload);
  if (!outputText) {
    throw new Error('OpenAI returned an empty response.');
  }

  return validateStructuredOutput(JSON.parse(outputText), schema);
}

async function requestDeepSeekStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose }) {
  const schemaPrompt = [
    `Return only one valid JSON object for ${schemaName}.`,
    'Do not include markdown, code fences, or commentary.',
    'Every required field must be present.',
    `JSON schema: ${JSON.stringify(schema)}`,
  ].join(' ');

  const response = await fetchImpl(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey('deepseek')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel('deepseek', purpose),
      messages: [
        { role: 'system', content: `${systemPrompt} ${schemaPrompt}`.trim() },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: getOutputTokenCap(purpose),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `DeepSeek request failed (${response.status}): ${payload.error?.message || 'Unknown DeepSeek error'}`
    );
  }

  const outputText = getDeepSeekMessageContent(payload);
  if (!outputText) {
    throw new Error('DeepSeek returned an empty response.');
  }

  return validateStructuredOutput(JSON.parse(outputText), schema);
}

async function requestStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose }) {
  const provider = getAiProvider();
  if (provider === 'deepseek') {
    return requestDeepSeekStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose });
  }

  return requestOpenAiStructuredOutput({ systemPrompt, userPrompt, schemaName, schema, purpose });
}

function buildClassifierSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      leadType: { type: 'string' },
      studentStage: { type: 'string' },
      examContext: { type: 'string' },
      subjectNeed: { type: 'string' },
      urgency: { type: 'string' },
      buyerIntent: { type: 'string' },
      emotionalState: { type: 'string' },
      recommendedPath: { type: 'string' },
      recommendedNextStep: { type: 'string' },
      manualReview: { type: 'boolean' },
      confidence: { type: 'number' },
      reasoningSummary: { type: 'string' },
    },
    required: [
      'leadType',
      'studentStage',
      'examContext',
      'subjectNeed',
      'urgency',
      'buyerIntent',
      'emotionalState',
      'recommendedPath',
      'recommendedNextStep',
      'manualReview',
      'confidence',
      'reasoningSummary',
    ],
  };
}

function buildDraftSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string' },
      body: { type: 'string' },
      recommendedCta: { type: 'string' },
      confidence: { type: 'number' },
      reviewNotes: { type: 'string' },
    },
    required: ['subject', 'body', 'recommendedCta', 'confidence', 'reviewNotes'],
  };
}

async function classifyEnquiry({ enquiry, offers }) {
  const systemPrompt = [
    'You classify tutoring enquiries for a premium education business.',
    'Be careful, calm, and conversion-aware.',
    'Never promise outcomes.',
    'Recommend exactly one next path from: private_mentoring, blueprint, essay_marking, lead_magnet, clarifying_reply, manual_review.',
    'Use manual_review when the message is sensitive, angry, unsafe, or too ambiguous to route confidently.',
  ].join(' ');

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

  return requestStructuredOutput({
    systemPrompt,
    userPrompt,
    schemaName: 'lead_classification',
    schema: buildClassifierSchema(),
    purpose: 'classification',
  });
}

async function generateReplyDraft({ enquiry, classification, recommendedOffer }) {
  const systemPrompt = [
    'You write short, high-trust email drafts for Rohan, a premium tutoring founder.',
    'Voice: warm, direct, calm, confident, human, helpful before salesy.',
    'Avoid hype, scarcity pressure, corporate phrasing, long paragraphs, and overpromising.',
    'Acknowledge the actual concern, validate it briefly, diagnose what likely matters, recommend one next step, explain why, give one low-friction CTA, and close warmly.',
    'Keep the body to 160-240 words unless the enquiry is unusually complex.',
    'Use short paragraphs, one clear recommendation, and one CTA link.',
    'If confidence is below 0.85, ask 1-2 short clarifying questions and keep the recommendation cautious.',
    'Never claim availability or outcomes you cannot know.',
  ].join(' ');

  const userPrompt = JSON.stringify({
    enquiry: compactEnquiry(enquiry),
    classification: compactClassification(classification),
    recommendedOffer: compactOfferForDraft(recommendedOffer),
  });

  return requestStructuredOutput({
    systemPrompt,
    userPrompt,
    schemaName: 'enquiry_email_draft',
    schema: buildDraftSchema(),
    purpose: 'draft',
  });
}

module.exports = {
  classifyEnquiry,
  generateReplyDraft,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
