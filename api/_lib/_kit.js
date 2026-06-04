const KIT_API_BASE = 'https://api.kit.com/v4';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const QUIZ_OUTCOME_TAG_ENV = {
  START_HERE: 'KIT_TAG_ID_QUIZ_START_HERE',
  BLUEPRINT: 'KIT_TAG_ID_QUIZ_BLUEPRINT',
  COMPREHENSIVE: 'KIT_TAG_ID_QUIZ_COMPREHENSIVE',
  MASTERY_CALL: 'KIT_TAG_ID_QUIZ_MASTERY',
};
const { SERVER_CATALOG } = require('./catalog.server.js');

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
  const apiKey = getRequiredEnv('KIT_API_KEY');
  const response = await fetchImpl(`${KIT_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Kit-Api-Key': apiKey,
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

  const quizTagEnv = QUIZ_OUTCOME_TAG_ENV[safeOutcome];
  if (quizTagEnv) {
    const quizTagId = getOptionalEnv(quizTagEnv);
    if (!quizTagId) {
      console.warn(`[kit] Missing ${quizTagEnv}; quiz lead saved without outcome tag.`);
      return subscriber;
    }

    await tagSubscriber({
      subscriberId: subscriber.id,
      tagId: quizTagId,
    });
  }

  return subscriber;
}

async function syncPurchaseTag({ baseSlug, email, customerName = '' }) {
  if (!isValidEmail(email)) {
    return { skipped: true, reason: 'missing_email' };
  }

  const apiKey = getOptionalEnv('KIT_API_KEY');
  if (!apiKey) {
    return { skipped: true, reason: 'missing_kit_config' };
  }

  const entry = SERVER_CATALOG[String(baseSlug || '').trim()];
  const purchaseTagEnv = entry ? entry.purchaseTagEnv : null;
  const purchasedTagId = purchaseTagEnv ? getOptionalEnv(purchaseTagEnv) : '';
  // Single master "Customer" tag so the abandoned-checkout (and any future)
  // suppression automation works with one rule for every product, including
  // ones that have no product-specific purchase tag (e.g. essay marking).
  const customerTagId = getOptionalEnv('KIT_TAG_ID_CUSTOMER');

  if (!purchasedTagId && !customerTagId) {
    return { skipped: true, reason: purchaseTagEnv ? 'missing_kit_config' : 'unsupported_product' };
  }

  const subscriber = await upsertSubscriber({
    email,
    firstName: firstNameFromFullName(customerName),
  });

  if (!subscriber) {
    throw new Error('Kit subscriber upsert failed');
  }

  if (purchasedTagId) {
    await tagSubscriber({
      subscriberId: subscriber.id,
      tagId: purchasedTagId,
    });
  }

  if (customerTagId) {
    try {
      await tagSubscriber({ subscriberId: subscriber.id, tagId: customerTagId });
    } catch (err) {
      console.warn('[kit] Customer master tag failed:', err.message);
    }
  }

  return { skipped: false, subscriberId: subscriber.id };
}

// Best-effort capture of someone who reached payment intent but has not (yet)
// purchased. Tags them so Kit's abandoned-checkout automation can follow up.
// Never throws on missing config — checkout must never fail because of Kit.
async function syncCheckoutStartedTag({ baseSlug, email, customerName = '', value = '' }) {
  if (!isValidEmail(email)) {
    return { skipped: true, reason: 'missing_email' };
  }

  const apiKey = getOptionalEnv('KIT_API_KEY');
  const abandonedTagId = getOptionalEnv('KIT_TAG_ID_CHECKOUT_ABANDONED');

  if (!apiKey || !abandonedTagId) {
    return { skipped: true, reason: 'missing_kit_config' };
  }

  const safeBaseSlug = String(baseSlug || '').trim();
  const entry = SERVER_CATALOG[safeBaseSlug];
  const productName = entry ? (entry.title || entry.name || '') : '';
  const resumeSlug = (entry && entry.pageSlug) || safeBaseSlug;
  const checkoutUrl = resumeSlug
    ? `https://www.rohanstutoring.com/checkout/?product=${encodeURIComponent(resumeSlug)}`
    : '';

  const subscriber = await upsertSubscriber({
    email,
    firstName: firstNameFromFullName(customerName),
    fields: {
      checkout_product: productName,
      checkout_value: value === '' || value === null || value === undefined ? '' : String(value),
      checkout_url: checkoutUrl,
    },
  });

  if (!subscriber) {
    throw new Error('Kit subscriber upsert failed');
  }

  await tagSubscriber({
    subscriberId: subscriber.id,
    tagId: abandonedTagId,
  });

  return { skipped: false, subscriberId: subscriber.id };
}

module.exports = {
  isValidEmail,
  upsertSubscriber,
  tagSubscriber,
  syncQuizLead,
  syncPurchaseTag,
  syncCheckoutStartedTag,
  firstNameFromFullName,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
