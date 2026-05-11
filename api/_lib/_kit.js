const KIT_API_BASE = 'https://api.kit.com/v4';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

let fetchImpl = (...args) => fetch(...args);

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

function getOptionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

function normaliseFirstName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function firstNameFromFullName(value) {
  return normaliseFirstName(String(value || '').split(' ')[0] || '');
}

async function kitRequest(path, { method = 'GET', body } = {}) {
  const response = await fetchImpl(`${KIT_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Kit-Api-Key': getRequiredEnv('KIT_API_KEY'),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = Array.isArray(payload.errors) ? payload.errors.join('; ') : '';
    throw new Error(`Kit API request failed (${response.status})${errors ? `: ${errors}` : ''}`);
  }

  return payload;
}

async function upsertSubscriber({ email, firstName = '', fields = {} }) {
  if (!isValidEmail(email)) {
    throw new Error('Invalid subscriber email address');
  }

  const payload = {
    email_address: String(email).trim(),
    state: 'active',
  };

  const safeFirstName = normaliseFirstName(firstName);
  if (safeFirstName) {
    payload.first_name = safeFirstName;
  }

  const filteredFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => String(value || '').trim())
  );
  if (Object.keys(filteredFields).length > 0) {
    payload.fields = filteredFields;
  }

  const data = await kitRequest('/subscribers', {
    method: 'POST',
    body: payload,
  });

  return data && data.subscriber ? data.subscriber : null;
}

async function tagSubscriber({ subscriberId, tagId }) {
  const safeSubscriberId = String(subscriberId || '').trim();
  const safeTagId = String(tagId || '').trim();

  if (!safeSubscriberId || !safeTagId) {
    throw new Error('Missing Kit subscriber id or tag id');
  }

  const data = await kitRequest(`/tags/${encodeURIComponent(safeTagId)}/subscribers/${encodeURIComponent(safeSubscriberId)}`, {
    method: 'POST',
    body: {},
  });

  return data && data.subscriber ? data.subscriber : null;
}

async function syncQuizLead({ email, firstName = '', outcome = '' }) {
  const safeOutcome = String(outcome || '').trim();
  const subscriber = await upsertSubscriber({
    email,
    firstName,
    fields: safeOutcome ? { quiz_outcome: safeOutcome } : {},
  });

  if (!subscriber) {
    throw new Error('Kit subscriber upsert failed');
  }

  if (safeOutcome === 'START_HERE') {
    await tagSubscriber({
      subscriberId: subscriber.id,
      tagId: getRequiredEnv('KIT_TAG_ID_QUIZ_START_HERE'),
    });
  }

  return subscriber;
}

async function syncPurchaseTag({ baseSlug, email, customerName = '' }) {
  if (String(baseSlug || '').trim() !== 'starter-pack') {
    return { skipped: true, reason: 'unsupported_product' };
  }

  if (!isValidEmail(email)) {
    return { skipped: true, reason: 'missing_email' };
  }

  const apiKey = getOptionalEnv('KIT_API_KEY');
  const purchasedTagId = getOptionalEnv('KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK');

  if (!apiKey || !purchasedTagId) {
    return { skipped: true, reason: 'missing_kit_config' };
  }

  const subscriber = await upsertSubscriber({
    email,
    firstName: firstNameFromFullName(customerName),
  });

  if (!subscriber) {
    throw new Error('Kit subscriber upsert failed');
  }

  await tagSubscriber({
    subscriberId: subscriber.id,
    tagId: purchasedTagId,
  });

  return { skipped: false, subscriberId: subscriber.id };
}

module.exports = {
  isValidEmail,
  upsertSubscriber,
  tagSubscriber,
  syncQuizLead,
  syncPurchaseTag,
  firstNameFromFullName,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
