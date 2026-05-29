'use strict';

const { BUSINESS_CONTEXT } = require('./_business-context.js');

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

let fetchImpl = (...args) => fetch(...args);

function getModel() {
  return String(process.env.DEEPSEEK_INSIGHTS_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro').trim();
}

function getMaxTokens() {
  return Number(process.env.AI_INSIGHTS_MAX_TOKENS) || 2200;
}

// Trim the raw dashboard payload to the signal the model needs, so we don't
// burn tokens on spark arrays and full trend series.
function compactDashboard(data) {
  return {
    range_days: data.range,
    metrics: (data.metrics || []).map((m) => ({
      label: m.label,
      value: m.value,
      previous: m.prev,
      delta_pct: m.prev ? Math.round(((m.value - m.prev) / m.prev) * 1000) / 10 : null,
    })),
    traffic_sources: (data.sources || []).map((s) => ({
      source: s.name, sessions: s.sessions, engaged_pct: s.eng, leads: s.leads,
    })),
    pages: (data.pages || []).map((p) => ({
      title: p.title, url: p.url, views: p.views, conversion_pct: p.conv, status: p.status,
    })),
    lead_magnets: (data.magnets || []).map((m) => ({
      name: m.name, views: m.views, signups: m.signups,
    })),
    winners: data.winners || [],
    underperformers: data.traps || [],
    tracking_gaps: (data.gaps || []).map((g) => g.name),
  };
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string' },
      insights: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            observation: { type: 'string' },
            business_mapping: { type: 'string' },
            recommended_next_step: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['title', 'observation', 'business_mapping', 'recommended_next_step', 'priority'],
        },
      },
    },
    required: ['headline', 'insights'],
  };
}

async function generateWeeklyInsights({ data, businessContext = BUSINESS_CONTEXT }) {
  const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();
  if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY environment variable');

  const systemPrompt = [
    'You are the analyst for a premium, founder-led GAMSAT prep business.',
    'You receive a weekly GA4 analytics snapshot and the durable business context.',
    'Produce 5 to 10 sharp insights. For each: state what the data shows, map it',
    'explicitly to the business context (offer ladder, funnel stage, current priority),',
    'and give ONE concrete next step to investigate or act on this week.',
    'Be specific and commercial. Reference real numbers from the data. Do not invent',
    'metrics that are not present. If a tracking gap blocks a conclusion, say so as an insight.',
    'Respect the current priority: if the workshop is full, do not flag low workshop',
    'numbers as a problem. Order insights by priority (highest first).',
    'Set each insight priority to exactly one of: "high", "medium", or "low".',
    'Return ONLY a JSON object matching this schema, no markdown or code fences:',
    JSON.stringify(buildSchema()),
  ].join(' ');

  const userPrompt = [
    '## BUSINESS CONTEXT',
    businessContext,
    '',
    '## ANALYTICS SNAPSHOT (JSON)',
    JSON.stringify(compactDashboard(data)),
  ].join('\n');

  const response = await fetchImpl(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: getMaxTokens(),
      temperature: 0.4,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`DeepSeek request failed (${response.status}): ${payload.error?.message || 'Unknown DeepSeek error'}`);
  }

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice && choice.message ? String(choice.message.content || '').trim() : '';
  if (!content) throw new Error('DeepSeek returned an empty response.');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error('DeepSeek output was not valid JSON.');
  }
  if (!parsed || !Array.isArray(parsed.insights) || !parsed.insights.length) {
    throw new Error('DeepSeek output had no insights.');
  }
  return parsed;
}

module.exports = {
  generateWeeklyInsights,
  compactDashboard,
  __setFetch: (value) => { fetchImpl = value; },
  __resetForTests: () => { fetchImpl = (...args) => fetch(...args); },
};
