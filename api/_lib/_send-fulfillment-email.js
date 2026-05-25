const { Resend } = require('resend');

let resendFactory = (apiKey) => new Resend(apiKey);

function esc(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFulfillmentHtml({ firstName, customerEmail, driveFolderUrl }) {
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
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">You now have permanent viewer access to The GAMSAT Blueprint Drive.</p>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Access it here:</p>
          <p style="margin:0 0 20px;">
            <a href="${esc(driveFolderUrl)}" style="color:#3b82f6;font-size:15px;word-break:break-all;">${esc(driveFolderUrl)}</a>
          </p>
          <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">Use the same email you used at checkout:</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;font-weight:600;">${esc(customerEmail)}</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">If you have any trouble opening it, just reply to this email and I'll sort it out.</p>
          <p style="margin:0 0 4px;font-size:15px;color:#374151;line-height:1.6;">Rohan</p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Rohan's GAMSAT</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">This is an automated email from Rohan's GAMSAT. You're receiving this because you purchased a product at rohanstutoring.com.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendFulfillmentEmail({ firstName, customerEmail, driveFolderUrl }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[send-fulfillment-email] RESEND_API_KEY not set — skipping');
    return { skipped: true, reason: 'no_api_key' };
  }

  if (!driveFolderUrl) {
    console.warn('[send-fulfillment-email] BLUEPRINT_DRIVE_URL not set — skipping');
    return { skipped: true, reason: 'no_drive_url' };
  }

  const from = String(process.env.FULFILLMENT_FROM_EMAIL || '').trim() || "Rohan's GAMSAT <support@rohanstutoring.com>";

  const resend = resendFactory(apiKey);
  await resend.emails.send({
    from,
    to: customerEmail,
    reply_to: 'support@rohanstutoring.com',
    subject: "Your GAMSAT Blueprint access is ready",
    html: buildFulfillmentHtml({ firstName, customerEmail, driveFolderUrl }),
    text: [
      `Hey ${firstName},`,
      '',
      'You now have permanent viewer access to The GAMSAT Blueprint Drive.',
      '',
      'Access it here:',
      driveFolderUrl,
      '',
      'Use the same email you used at checkout:',
      customerEmail,
      '',
      "If you have any trouble opening it, just reply to this email and I'll sort it out.",
      '',
      'Rohan',
      "Rohan's GAMSAT",
    ].join('\n'),
  });

  return { sent: true };
}

sendFulfillmentEmail.__setResendFactory = (factory) => { resendFactory = factory; };
sendFulfillmentEmail.__resetForTests = () => { resendFactory = (apiKey) => new Resend(apiKey); };

module.exports = sendFulfillmentEmail;
