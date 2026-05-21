const { Resend } = require('resend');
const { syncPurchaseTag } = require('./_kit.js');
const { shareProductAccess } = require('./_google-drive.js');
const { SERVER_CATALOG } = require('./catalog.server.js');
const {
  ESSAY_UPLOAD_INSTRUCTIONS,
  buildEssayUploadToken,
  buildEssayUploadUrl,
} = require('./_essay-upload.js');
const sendFulfillmentAlert = require('./_fulfillment-alerts.js');

let resendFactory = (apiKey) => new Resend(apiKey);
let alertFn = sendFulfillmentAlert;

async function safeAlert(args) {
  try {
    await alertFn(args);
  } catch (err) {
    console.error('[fulfill-payment-intent] Alert send failed:', err.message);
  }
}

function productLabel(baseSlug, upsellSlug) {
  const base = (SERVER_CATALOG[baseSlug] && SERVER_CATALOG[baseSlug].name) || baseSlug;
  if (!upsellSlug) return base;
  const upsell = (SERVER_CATALOG[upsellSlug] && SERVER_CATALOG[upsellSlug].name) || upsellSlug;
  return `${base} + ${upsell}`;
}

function esc(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${esc(firstName)},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">We've received your payment for <strong>${esc(productLine)}</strong>. Your content will be sent to this email address within 24 hours.</p>
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

function buildCourseWelcomeHtml(firstName, startLine) {
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
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hey ${esc(firstName)},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Good to see your enrolment come through. I'm excited to have you in the cohort.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">You should have just received a separate email with your link to access the Blueprint library via Google Drive. If you haven't seen it yet, just reply to this email and let me know.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">${startLine} I'll be in touch with more details before then.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Talk soon,</p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Rohan</p>
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
  const variant = SERVER_CATALOG[baseSlug] ? SERVER_CATALOG[baseSlug].cohortEmail : null;

  const resend = resendFactory(apiKey);
  let emailOptions;

  if (variant) {
    emailOptions = {
      from: 'hello@rohanstutoring.com',
      to: customerEmail,
      subject: variant.subject,
      html: buildCourseWelcomeHtml(firstName, variant.startLine),
      text: `Hey ${firstName},\n\nGood to see your enrolment come through. I'm excited to have you in the cohort.\n\nYou should have just received a separate email with your link to access the Blueprint library via Google Drive. If you haven't seen it yet, just reply to this email and let me know.\n\n${variant.startLine} I'll be in touch with more details before then.\n\nTalk soon,\n\nRohan`,
    };
  } else {
    emailOptions = {
      from: 'hello@rohanstutoring.com',
      to: customerEmail,
      subject: `Payment confirmed — ${productLine}`,
      html: buildConfirmationHtml(firstName, productLine),
      text: `Hi ${firstName},\n\nWe've received your payment for ${productLine}. Your content will be sent to this email address within 24 hours.\n\nIf you have any questions, contact us at hello@rohanstutoring.com.\n\nRohan's GAMSAT`,
    };
  }

  await resend.emails.send(emailOptions);

  console.log(`[fulfill-payment-intent] Confirmation email sent to ${customerEmail} for ${productLine}`);
}

function getFulfillmentPlan(productSlug, upsellSlug) {
  const baseEntry = SERVER_CATALOG[String(productSlug || '').trim()] || null;
  if (!baseEntry) return null;

  const basePlan = {
    productSlug: baseEntry.fulfillmentSlug || productSlug,
    deliveryType: baseEntry.deliveryType,
    fulfillmentLabel: baseEntry.fulfillmentLabel,
  };

  const normalizedUpsellSlug = String(upsellSlug || '').trim();
  if (!normalizedUpsellSlug) return basePlan;

  const upsellEntry = SERVER_CATALOG[normalizedUpsellSlug] || null;
  if (!upsellEntry) return basePlan;

  return {
    productSlug: basePlan.productSlug,
    upsellSlug: upsellEntry.fulfillmentSlug || normalizedUpsellSlug,
    deliveryType: `${basePlan.deliveryType}+${upsellEntry.deliveryType}`,
    fulfillmentLabel: `${basePlan.fulfillmentLabel} + ${upsellEntry.fulfillmentLabel}`,
  };
}

function needsStarterPackAutomation(metadata, baseSlug) {
  if (String(baseSlug || '').trim() !== 'starter-pack') return false;

  return (
    metadata.drive_share_status !== 'shared' &&
    metadata.drive_share_status !== 'already_shared'
  ) || metadata.kit_purchase_tag_status !== 'tagged';
}

function buildFulfillmentMetadata({
  metadata,
  baseSlug,
  upsellSlug,
  plan,
  fulfillmentProductSlugs,
  requestedAt,
  extra = {},
}) {
  return {
    ...metadata,
    product_slug: baseSlug,
    base_slug: baseSlug,
    ...(upsellSlug ? { upsell_slug: upsellSlug } : {}),
    fulfillment_status: 'manual_fulfillment_pending',
    manual_fulfillment_required: 'true',
    fulfillment_requested_at: requestedAt,
    fulfillment_source: 'stripe-webhook',
    fulfillment_delivery_type: plan.deliveryType,
    fulfillment_label: plan.fulfillmentLabel,
    fulfillment_product_slugs: fulfillmentProductSlugs,
    ...extra,
  };
}

async function fulfillPaymentIntent(options) {
  const paymentIntent = options && options.paymentIntent ? options.paymentIntent : null;
  const stripeClient = options && options.stripeClient ? options.stripeClient : null;
  const now = options && typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const forceAutomation = Boolean(options && options.forceAutomation);

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
  if (
    finalFulfillmentStatuses.has(metadata.fulfillment_status) &&
    !forceAutomation &&
    !needsStarterPackAutomation(metadata, baseSlug)
  ) {
    return {
      alreadyFulfilled: true,
      plan: getFulfillmentPlan(baseSlug, upsellSlug),
    };
  }

  const plan = getFulfillmentPlan(baseSlug, upsellSlug);
  if (!plan) {
    const unknownEmail = String(metadata.customer_email || currentPaymentIntent.receipt_email || '').trim();
    await safeAlert({
      baseSlug: baseSlug || 'unknown',
      upsellSlug,
      customerEmail: unknownEmail,
      provider: 'stripe',
      paymentId: paymentIntent.id,
      failedStep: 'unknown_product',
      errorMessage: `No fulfillment plan for slug: ${baseSlug || 'unknown'}`,
    });
    throw new Error(`Unsupported fulfillment product slug: ${baseSlug || 'unknown'}`);
  }

  const fulfillmentProductSlugs = plan.upsellSlug
    ? `${plan.productSlug},${plan.upsellSlug}`
    : plan.productSlug;
  const requestedAt = now();
  const needsEssayUpload = !!(SERVER_CATALOG[baseSlug] || {}).requiresEssayUpload;
  const essayUploadToken = needsEssayUpload
    ? buildEssayUploadToken({
        paymentIntentId: paymentIntent.id,
        productSlug: baseSlug,
        upsellSlug,
      })
    : '';
  const essayUploadMetadata = needsEssayUpload
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
    metadata: buildFulfillmentMetadata({
      metadata,
      baseSlug,
      upsellSlug,
      plan,
      fulfillmentProductSlugs,
      requestedAt,
      extra: essayUploadMetadata,
    }),
  });

  const customerEmail = String(metadata.customer_email || currentPaymentIntent.receipt_email || '').trim();
  const customerName = String(metadata.customer_name || '').trim();

  if (customerEmail) {
    try {
      const driveResult = await shareProductAccess({
        baseSlug,
        email: customerEmail,
      });

      if (driveResult && !driveResult.skipped) {
        console.log(
          `[fulfill-payment-intent] Google Drive access ${driveResult.alreadyShared ? 'already existed' : 'shared'} for ${customerEmail} (${baseSlug})`
        );

        await stripeClient.paymentIntents.update(paymentIntent.id, {
          metadata: buildFulfillmentMetadata({
            metadata,
            baseSlug,
            upsellSlug,
            plan,
            fulfillmentProductSlugs,
            requestedAt,
            extra: {
            drive_share_status: driveResult.alreadyShared ? 'already_shared' : 'shared',
            drive_share_folder_id: driveResult.folderId || '',
            drive_share_folder_env: driveResult.folderEnvName || '',
            drive_share_permission_id: driveResult.permissionId || '',
            ...essayUploadMetadata,
            },
          }),
        });
      } else if (driveResult && driveResult.reason === 'missing_folder_mapping') {
        console.warn(`[fulfill-payment-intent] No Google Drive folder configured for ${baseSlug} (${driveResult.folderEnvName})`);
      }
    } catch (driveErr) {
      console.error('[fulfill-payment-intent] Google Drive sharing failed:', driveErr.message);
      await safeAlert({
        baseSlug,
        upsellSlug,
        customerEmail,
        provider: 'stripe',
        paymentId: paymentIntent.id,
        failedStep: 'drive',
        errorMessage: driveErr.message,
      });
    }

    try {
      await sendConfirmationEmail({ customerName, customerEmail, baseSlug, upsellSlug });
    } catch (emailErr) {
      console.error('[fulfill-payment-intent] Confirmation email failed:', emailErr.message);
      await safeAlert({
        baseSlug,
        upsellSlug,
        customerEmail,
        provider: 'stripe',
        paymentId: paymentIntent.id,
        failedStep: 'email',
        errorMessage: emailErr.message,
      });
    }

    try {
      const kitResult = await syncPurchaseTag({
        baseSlug,
        email: customerEmail,
        customerName,
      });

      if (kitResult && !kitResult.skipped) {
        console.log(`[fulfill-payment-intent] Kit purchase tag synced for ${customerEmail}`);
        await stripeClient.paymentIntents.update(paymentIntent.id, {
          metadata: buildFulfillmentMetadata({
            metadata,
            baseSlug,
            upsellSlug,
            plan,
            fulfillmentProductSlugs,
            requestedAt,
            extra: {
              kit_purchase_tag_status: 'tagged',
              kit_purchase_tagged_at: requestedAt,
              ...essayUploadMetadata,
            },
          }),
        });
      }
    } catch (kitErr) {
      console.error('[fulfill-payment-intent] Kit purchase sync failed:', kitErr.message);
      await safeAlert({
        baseSlug,
        upsellSlug,
        customerEmail,
        provider: 'stripe',
        paymentId: paymentIntent.id,
        failedStep: 'kit',
        errorMessage: kitErr.message,
      });
    }
  } else {
    console.warn('[fulfill-payment-intent] No customer email found — skipping confirmation email');
  }

  return {
    alreadyFulfilled: false,
    plan,
  };
}

async function fulfillInstalmentCheckout({ session }) {
  const metadata = (session && session.metadata) || {};
  const baseSlug = String(metadata.base_slug || metadata.product_slug || '').trim();
  const upsellSlug = String(metadata.upsell_slug || '').trim();
  const customerDetails = (session && session.customer_details) || {};
  const customerEmail = String(metadata.customer_email || session.customer_email || customerDetails.email || '').trim();
  const customerName = String(metadata.customer_name || customerDetails.name || '').trim();

  if (!customerEmail) {
    console.warn('[fulfill-instalment-checkout] No customer email found — skipping fulfillment');
    return { skipped: true };
  }

  const instalmentSessionId = (session && session.id) || '';

  const plan = getFulfillmentPlan(baseSlug, upsellSlug);
  if (!plan) {
    await safeAlert({
      baseSlug: baseSlug || 'unknown',
      upsellSlug,
      customerEmail,
      provider: 'stripe',
      paymentId: instalmentSessionId,
      failedStep: 'unknown_product',
      errorMessage: `No fulfillment plan for slug: ${baseSlug || 'unknown'}`,
    });
    throw new Error(`Unsupported fulfillment product slug: ${baseSlug || 'unknown'}`);
  }

  try {
    const driveResult = await shareProductAccess({ baseSlug, email: customerEmail });
    if (driveResult && !driveResult.skipped) {
      console.log(
        `[fulfill-instalment-checkout] Google Drive access ${driveResult.alreadyShared ? 'already existed' : 'shared'} for ${customerEmail} (${baseSlug})`
      );
    }
  } catch (driveErr) {
    console.error('[fulfill-instalment-checkout] Google Drive sharing failed:', driveErr.message);
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'stripe',
      paymentId: instalmentSessionId,
      failedStep: 'drive',
      errorMessage: driveErr.message,
    });
  }

  try {
    await sendConfirmationEmail({ customerName, customerEmail, baseSlug, upsellSlug });
  } catch (emailErr) {
    console.error('[fulfill-instalment-checkout] Confirmation email failed:', emailErr.message);
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'stripe',
      paymentId: instalmentSessionId,
      failedStep: 'email',
      errorMessage: emailErr.message,
    });
  }

  try {
    const kitResult = await syncPurchaseTag({
      baseSlug,
      email: customerEmail,
      customerName,
    });

    if (kitResult && !kitResult.skipped) {
      console.log(`[fulfill-instalment-checkout] Kit purchase tag synced for ${customerEmail}`);
    }
  } catch (kitErr) {
    console.error('[fulfill-instalment-checkout] Kit purchase sync failed:', kitErr.message);
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'stripe',
      paymentId: instalmentSessionId,
      failedStep: 'kit',
      errorMessage: kitErr.message,
    });
  }

  return { plan };
}

fulfillPaymentIntent.getFulfillmentPlan = getFulfillmentPlan;
fulfillPaymentIntent.needsStarterPackAutomation = needsStarterPackAutomation;
fulfillPaymentIntent.buildEssayUploadToken = buildEssayUploadToken;
fulfillPaymentIntent.buildEssayUploadUrl = buildEssayUploadUrl;
fulfillPaymentIntent.sendConfirmationEmail = sendConfirmationEmail;
fulfillPaymentIntent.fulfillPaymentIntent = fulfillPaymentIntent;
fulfillPaymentIntent.__setResendFactory = (factory) => { resendFactory = factory; };
fulfillPaymentIntent.__setAlertFn = (fn) => { alertFn = fn; };
fulfillPaymentIntent.__resetForTests = () => {
  resendFactory = (apiKey) => new Resend(apiKey);
  alertFn = sendFulfillmentAlert;
};
fulfillPaymentIntent.fulfillInstalmentCheckout = fulfillInstalmentCheckout;

module.exports = fulfillPaymentIntent;
