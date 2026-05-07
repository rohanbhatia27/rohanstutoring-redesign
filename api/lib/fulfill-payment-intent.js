const { Resend } = require('resend');
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

const PRODUCT_NAMES = {
  blueprint: "Rohan's Blueprint",
  advanced: 'Elite Excellence Course',
  'essay-collection': 'Expert Essay Collection',
  'starter-pack': 'Essentials Playbook',
  'essay-marking': 'Essay Marking',
  'essay-pack-10': 'Essay Marking Pack (10 credits)',
  comprehensive: 'Comprehensive Course',
  mastery: 'Mastery Program',
  's1-rescue-sprint': 'S1 Rescue Sprint',
  's2-rescue-sprint': 'S2 Rescue Sprint',
  'mentoring-single': 'Private Mentoring Session',
  'mentoring-pack': 'Private Mentoring Pack',
  'private-mentoring': 'Private Mentoring',
};

function productLabel(baseSlug, upsellSlug) {
  const base = PRODUCT_NAMES[baseSlug] || baseSlug;
  if (!upsellSlug) return base;
  return `${base} + ${PRODUCT_NAMES[upsellSlug] || upsellSlug}`;
}

function buildConfirmationHtml(firstName, productLine) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0a0f1e;padding:28px 32px;">
          <p style="margin:0;color:#3b82f6;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">ROHAN'S GAMSAT</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0a0f1e;line-height:1.3;">Payment confirmed.</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">We've received your payment for <strong>${productLine}</strong>. Your content will be sent to this email address within 24 hours.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">If you have any questions in the meantime, reply to this email or contact us at <a href="mailto:hello@rohanstutoring.com" style="color:#3b82f6;text-decoration:none;">hello@rohanstutoring.com</a>.</p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Rohan's GAMSAT</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">This is an automated confirmation from Rohan's GAMSAT. You're receiving this because you made a purchase at rohanstutoring.com.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendConfirmationEmail({ customerName, customerEmail, baseSlug, upsellSlug }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[fulfill-payment-intent] RESEND_API_KEY not set — skipping confirmation email');
    return;
  }

  const firstName = (customerName || '').split(' ')[0] || 'there';
  const productLine = productLabel(baseSlug, upsellSlug);

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: 'noreply@rohanstutoring.com',
    to: customerEmail,
    subject: `Payment confirmed — ${productLine}`,
    html: buildConfirmationHtml(firstName, productLine),
    text: `Hi ${firstName},\n\nWe've received your payment for ${productLine}. Your content will be sent to this email address within 24 hours.\n\nIf you have any questions, contact us at hello@rohanstutoring.com.\n\nRohan's GAMSAT`,
  });

  console.log(`[fulfill-payment-intent] Confirmation email sent to ${customerEmail} for ${productLine}`);
}

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

  const customerEmail = String(metadata.customer_email || currentPaymentIntent.receipt_email || '').trim();
  const customerName = String(metadata.customer_name || '').trim();

  if (customerEmail) {
    try {
      await sendConfirmationEmail({ customerName, customerEmail, baseSlug, upsellSlug });
    } catch (emailErr) {
      console.error('[fulfill-payment-intent] Confirmation email failed:', emailErr.message);
    }
  } else {
    console.warn('[fulfill-payment-intent] No customer email found — skipping confirmation email');
  }

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
