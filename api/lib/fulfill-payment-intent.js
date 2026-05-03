const {
  ESSAY_UPLOAD_INSTRUCTIONS,
  buildEssayUploadToken,
  buildEssayUploadUrl,
} = require('./essay-upload.js');

const FULFILLMENT_PLANS = {
  blueprint: {
    productSlug: 'blueprint',
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
  },
  advanced: {
    productSlug: 'advanced',
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
  },
  'essay-collection': {
    productSlug: 'essay-collection',
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
  },
  'starter-pack': {
    productSlug: 'starter-pack',
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
  },
  'essay-marking': {
    productSlug: 'essay-marking',
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay submission instructions',
  },
  'essay-pack-10': {
    productSlug: 'essay-pack-10',
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay pack submission instructions',
  },
  comprehensive: {
    productSlug: 'comprehensive',
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
  },
  mastery: {
    productSlug: 'mastery',
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
  },
  's1-rescue-sprint': {
    productSlug: 's1-rescue-sprint',
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
  },
  's2-rescue-sprint': {
    productSlug: 's2-rescue-sprint',
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
  },
  'mentoring-single': {
    productSlug: 'private-mentoring',
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
  },
  'mentoring-pack': {
    productSlug: 'private-mentoring',
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
  },
  'private-mentoring': {
    productSlug: 'private-mentoring',
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
  },
};

function getFulfillmentPlan(productSlug, upsellSlug) {
  const basePlan = FULFILLMENT_PLANS[String(productSlug || '').trim()] || null;
  const normalizedUpsellSlug = String(upsellSlug || '').trim();

  if (!basePlan || !normalizedUpsellSlug) {
    return basePlan;
  }

  const upsellPlan = FULFILLMENT_PLANS[normalizedUpsellSlug] || null;
  if (!upsellPlan) {
    return basePlan;
  }

  return {
    productSlug: basePlan.productSlug,
    upsellSlug: upsellPlan.productSlug,
    deliveryType: `${basePlan.deliveryType}+${upsellPlan.deliveryType}`,
    fulfillmentLabel: `${basePlan.fulfillmentLabel} + ${upsellPlan.fulfillmentLabel}`,
  };
}

async function fulfillPaymentIntent(options) {
  const paymentIntent = options && options.paymentIntent ? options.paymentIntent : null;
  const stripeClient = options && options.stripeClient ? options.stripeClient : null;
  const now = options && typeof options.now === 'function' ? options.now : () => new Date().toISOString();

  if (!paymentIntent || !paymentIntent.id) {
    throw new Error('Missing PaymentIntent to fulfill.');
  }

  if (!stripeClient || !stripeClient.paymentIntents || typeof stripeClient.paymentIntents.update !== 'function') {
    throw new Error('Missing Stripe client.');
  }

  const currentPaymentIntent = stripeClient.paymentIntents.retrieve
    ? await stripeClient.paymentIntents.retrieve(paymentIntent.id)
    : paymentIntent;

  const metadata = currentPaymentIntent.metadata && typeof currentPaymentIntent.metadata === 'object'
    ? currentPaymentIntent.metadata
    : {};
  const baseSlug = String(metadata.base_slug || metadata.product_slug || '').trim();
  const upsellSlug = String(metadata.upsell_slug || '').trim();

  const finalFulfillmentStatuses = new Set(['fulfilled', 'manual_fulfillment_pending']);
  if (finalFulfillmentStatuses.has(metadata.fulfillment_status)) {
    return {
      alreadyFulfilled: true,
      plan: getFulfillmentPlan(baseSlug, upsellSlug),
    };
  }

  const plan = getFulfillmentPlan(baseSlug, upsellSlug);
  if (!plan) {
    throw new Error(`Unsupported fulfillment product slug: ${baseSlug || 'unknown'}`);
  }

  const fulfillmentProductSlugs = plan.upsellSlug
    ? `${plan.productSlug},${plan.upsellSlug}`
    : plan.productSlug;
  const essayUploadToken = baseSlug === 'essay-marking'
    ? buildEssayUploadToken({
        paymentIntentId: paymentIntent.id,
        productSlug: baseSlug,
        upsellSlug,
      })
    : '';
  const essayUploadMetadata = baseSlug === 'essay-marking'
    ? {
        essay_upload_required: 'true',
        essay_upload_url: buildEssayUploadUrl({
          paymentIntentId: paymentIntent.id,
          productSlug: baseSlug,
          upsellSlug,
          uploadToken: essayUploadToken,
          source: 'stripe_webhook',
        }),
        essay_upload_token: essayUploadToken,
        essay_upload_instructions: ESSAY_UPLOAD_INSTRUCTIONS,
      }
    : {};

  await stripeClient.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...metadata,
      product_slug: baseSlug,
      base_slug: baseSlug,
      ...(upsellSlug ? { upsell_slug: upsellSlug } : {}),
      fulfillment_status: 'manual_fulfillment_pending',
      manual_fulfillment_required: 'true',
      fulfillment_requested_at: now(),
      fulfillment_source: 'stripe-webhook',
      fulfillment_delivery_type: plan.deliveryType,
      fulfillment_label: plan.fulfillmentLabel,
      fulfillment_product_slugs: fulfillmentProductSlugs,
      ...essayUploadMetadata,
    },
  });

  return {
    alreadyFulfilled: false,
    plan,
  };
}

fulfillPaymentIntent.getFulfillmentPlan = getFulfillmentPlan;
fulfillPaymentIntent.buildEssayUploadToken = buildEssayUploadToken;
fulfillPaymentIntent.buildEssayUploadUrl = buildEssayUploadUrl;
fulfillPaymentIntent.fulfillPaymentIntent = fulfillPaymentIntent;

module.exports = fulfillPaymentIntent;
