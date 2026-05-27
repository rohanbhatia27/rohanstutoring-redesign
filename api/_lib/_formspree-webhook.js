'use strict';

const crypto = require('crypto');

const DEFAULT_TOLERANCE_SECONDS = 300;

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

function normaliseWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseSignatureHeader(signatureHeader) {
  if (!signatureHeader) return null;

  try {
    const parts = Object.fromEntries(
      String(signatureHeader)
        .split(',')
        .map((entry) => entry.trim().split('=', 2))
        .filter((entry) => entry.length === 2)
    );

    const timestamp = Number(parts.t || 0);
    const signature = String(parts.v1 || '').trim();
    if (!Number.isFinite(timestamp) || !signature) return null;

    return { timestamp, signature };
  } catch (error) {
    return null;
  }
}

function verifySignature({
  rawBody,
  signatureHeader,
  secret = getRequiredEnv('FORMSPREE_WEBHOOK_SECRET'),
  now = () => Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
} = {}) {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const currentTime = Number(now());
  if (Math.abs(currentTime - parsed.timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${String(rawBody || '')}`, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(parsed.signature, 'utf8');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    return req.rawBody.toString('utf8');
  }

  if (typeof req.rawBody === 'string') {
    return req.rawBody;
  }

  if (req && typeof req.on === 'function') {
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    if (chunks.length > 0) {
      return Buffer.concat(chunks).toString('utf8');
    }
  }

  if (typeof req.body === 'string') {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }

  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  return '';
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    const trimmed = normaliseWhitespace(value);
    if (trimmed) return trimmed;
  }
  return '';
}

function normalisePayload(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const submission = safePayload.submission && typeof safePayload.submission === 'object'
    ? safePayload.submission
    : {};

  const firstName = pickFirstNonEmpty([submission.firstName, submission.first_name]);
  const lastName = pickFirstNonEmpty([submission.lastName, submission.last_name]);
  const fullName = pickFirstNonEmpty([
    submission.name,
    submission.fullName,
    [firstName, lastName].filter(Boolean).join(' '),
  ]);

  const email = pickFirstNonEmpty([submission.email, submission.emailAddress]).toLowerCase();
  const phone = pickFirstNonEmpty([submission.phone, submission.phoneNumber, submission.mobile]);
  const message = pickFirstNonEmpty([
    submission.message,
    submission.enquiry,
    submission.details,
    submission.notes,
  ]);
  const subject = pickFirstNonEmpty([submission.subject, safePayload.subject]);
  const service = pickFirstNonEmpty([submission.service, submission.interest, submission.offer]);
  const source = pickFirstNonEmpty([submission.source, safePayload.form, 'formspree']);
  const page = pickFirstNonEmpty([submission.page, submission.path, '']);
  const submittedAt = pickFirstNonEmpty([submission._date, safePayload.created_at, '']);

  return {
    formId: pickFirstNonEmpty([safePayload.form, submission.formId]),
    keys: Array.isArray(safePayload.keys) ? safePayload.keys.slice() : [],
    enquiry: {
      name: fullName,
      firstName,
      lastName,
      email,
      phone,
      message,
      subject,
      service,
      source,
      page,
      submittedAt,
      rawSubmission: submission,
    },
  };
}

module.exports = {
  DEFAULT_TOLERANCE_SECONDS,
  normalisePayload,
  parseSignatureHeader,
  readRawBody,
  verifySignature,
};
