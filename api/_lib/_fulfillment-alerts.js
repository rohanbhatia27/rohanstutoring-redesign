const { Resend } = require('resend');

let resendFactory = (apiKey) => new Resend(apiKey);

function esc(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildAlertHtml({ baseSlug, upsellSlug, customerEmail, provider, paymentId, failedStep, errorMessage }) {
  const rows = [
    ['Product', esc(baseSlug)],
    ...(upsellSlug ? [['Upsell', esc(upsellSlug)]] : []),
    ['Customer email', esc(customerEmail)],
    ['Provider', esc(provider)],
    ['Payment ID', esc(paymentId)],
    ['Failed step', esc(failedStep)],
    ['Error', esc(errorMessage)],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#7f1d1d;padding:28px 32px;">
          <p style="margin:0;color:#fca5a5;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">ROHAN'S GAMSAT — INTERNAL ALERT</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#7f1d1d;">Fulfillment step failed</h2>
          <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">A payment succeeded but a fulfillment step failed. Manual review may be required to ensure the customer receives their product.</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;border:1px solid #e5e7eb;border-radius:4px;">
            ${tableRows}
          </table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Internal alert from Rohan's GAMSAT fulfillment system. Do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendFulfillmentAlert({
  baseSlug,
  upsellSlug,
  customerEmail,
  provider,
  paymentId,
  failedStep,
  errorMessage,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const adminEmail = String(process.env.ADMIN_ALERT_EMAIL || '').trim();

  if (!apiKey || !adminEmail) {
    console.warn('[fulfillment-alerts] Skipping alert — RESEND_API_KEY or ADMIN_ALERT_EMAIL not configured');
    return;
  }

  try {
    const resend = resendFactory(apiKey);
    const subject = `[FULFILLMENT ALERT] ${failedStep} failed — ${baseSlug}${upsellSlug ? '+' + upsellSlug : ''} (${provider})`;
    const textBody = [
      'Fulfillment step failed after a successful payment.',
      '',
      `Product: ${baseSlug}`,
      ...(upsellSlug ? [`Upsell: ${upsellSlug}`] : []),
      `Customer email: ${customerEmail}`,
      `Provider: ${provider}`,
      `Payment ID: ${paymentId}`,
      `Failed step: ${failedStep}`,
      `Error: ${errorMessage}`,
    ].join('\n');

    await resend.emails.send({
      from: 'hello@rohanstutoring.com',
      to: adminEmail,
      subject,
      html: buildAlertHtml({ baseSlug, upsellSlug, customerEmail, provider, paymentId, failedStep, errorMessage }),
      text: textBody,
    });

    console.log(`[fulfillment-alerts] Alert sent for ${failedStep} failure on ${paymentId}`);
  } catch (alertErr) {
    console.error('[fulfillment-alerts] Failed to send alert email:', alertErr.message);
  }
}

sendFulfillmentAlert.__setResendFactory = (factory) => {
  resendFactory = factory;
};
sendFulfillmentAlert.__resetForTests = () => {
  resendFactory = (apiKey) => new Resend(apiKey);
};

module.exports = sendFulfillmentAlert;
