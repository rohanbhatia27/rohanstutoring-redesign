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

function getFulfillmentPlan(productSlug) {
  return FULFILLMENT_PLANS[String(productSlug || '').trim()] || null;
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

  const metadata = paymentIntent.metadata && typeof paymentIntent.metadata === 'object'
    ? paymentIntent.metadata
    : {};

  if (metadata.fulfillment_status === 'fulfilled') {
    return {
      alreadyFulfilled: true,
      plan: getFulfillmentPlan(metadata.product_slug),
    };
  }

  const plan = getFulfillmentPlan(metadata.product_slug);
  if (!plan) {
    throw new Error(`Unsupported fulfillment product slug: ${metadata.product_slug || 'unknown'}`);
  }

  await stripeClient.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...metadata,
      fulfillment_status: 'fulfilled',
      fulfilled_at: now(),
      fulfillment_source: 'stripe-webhook',
      fulfillment_delivery_type: plan.deliveryType,
      fulfillment_label: plan.fulfillmentLabel,
    },
  });

  return {
    alreadyFulfilled: false,
    plan,
  };
}

fulfillPaymentIntent.getFulfillmentPlan = getFulfillmentPlan;
fulfillPaymentIntent.fulfillPaymentIntent = fulfillPaymentIntent;

module.exports = fulfillPaymentIntent;
