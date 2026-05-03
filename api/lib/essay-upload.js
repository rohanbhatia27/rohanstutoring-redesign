const crypto = require('crypto');

const TALLY_ESSAY_FORM_URL = 'https://tally.so/r/zxQdMR';
const ESSAY_UPLOAD_INSTRUCTIONS = 'Upload via essay_upload_url or email essays@rohanstutoring.com with this PaymentIntent ID.';

function normaliseTokenPart(value) {
  return String(value || '').trim();
}

function getEssayUploadTokenSecret() {
  return normaliseTokenPart(process.env.ESSAY_UPLOAD_TOKEN_SECRET || process.env.STRIPE_SECRET_KEY);
}

function buildEssayUploadToken({
  paymentIntentId = '',
  productSlug = 'essay-marking',
  upsellSlug = '',
} = {}) {
  const safePaymentIntentId = normaliseTokenPart(paymentIntentId);
  const safeProductSlug = normaliseTokenPart(productSlug || 'essay-marking');
  const safeUpsellSlug = normaliseTokenPart(upsellSlug);
  const tokenSecret = getEssayUploadTokenSecret();

  if (!safePaymentIntentId || !tokenSecret) return '';

  return crypto
    .createHmac('sha256', tokenSecret)
    .update(`${safePaymentIntentId}:${safeProductSlug}:${safeUpsellSlug}`)
    .digest('hex');
}

function buildEssayUploadUrl({
  paymentIntentId = '',
  productSlug = 'essay-marking',
  upsellSlug = '',
  uploadToken = '',
  source = 'stripe_metadata',
} = {}) {
  const params = new URLSearchParams();
  const safePaymentIntentId = normaliseTokenPart(paymentIntentId);
  const safeProductSlug = normaliseTokenPart(productSlug || 'essay-marking');
  const safeUpsellSlug = normaliseTokenPart(upsellSlug);
  const safeUploadToken = normaliseTokenPart(uploadToken);
  const safeSource = normaliseTokenPart(source || 'stripe_metadata');

  if (safePaymentIntentId) params.set('payment_intent', safePaymentIntentId);
  if (safeProductSlug) params.set('product', safeProductSlug);
  if (safeUpsellSlug) params.set('upsell', safeUpsellSlug);
  if (safeUploadToken) params.set('upload_token', safeUploadToken);
  params.set('source', safeSource);

  return `${TALLY_ESSAY_FORM_URL}?${params.toString()}`;
}

module.exports = {
  TALLY_ESSAY_FORM_URL,
  ESSAY_UPLOAD_INSTRUCTIONS,
  buildEssayUploadToken,
  buildEssayUploadUrl,
};
