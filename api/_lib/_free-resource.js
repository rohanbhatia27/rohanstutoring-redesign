const { Resend } = require('resend');
const { isValidEmail } = require('./_kit.js');

const KIT_FORM_BASE = 'https://app.kit.com/forms';
const SUPPORT_EMAIL = 'hello@rohanstutoring.com';
const KIT_TIMEOUT_MS = 8000;

const FREE_RESOURCES = {
  's1-tracker': {
    key: 's1-tracker',
    name: 'S1 Question Tracker',
    kitFormId: '8683298',
    backupUrlEnv: 'FREE_RESOURCE_S1_TRACKER_BACKUP_URL',
    backupLabel: 'Open the tracker backup link',
  },
  's1-mock': {
    key: 's1-mock',
    name: 'S1 Mini Mock',
    kitFormId: '8717603',
    backupUrlEnv: 'FREE_RESOURCE_S1_MOCK_BACKUP_URL',
    backupLabel: 'Open the mini-mock backup link',
  },
  's2-slam-system': {
    key: 's2-slam-system',
    name: 'S2 Slam System',
    kitFormId: '8526774',
    backupUrlEnv: 'FREE_RESOURCE_S2_SLAM_SYSTEM_BACKUP_URL',
    backupLabel: 'Open the S2 Slam System backup link',
  },
};

let fetchImpl = (...args) => fetch(...args);
let resendFactory = (apiKey) => new Resend(apiKey);

function normaliseFirstName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getFreeResource(resourceKey) {
  const key = String(resourceKey || '').trim();
  return FREE_RESOURCES[key] || null;
}

function getBackupUrl(resource) {
  if (!resource) return '';
  return String(process.env[resource.backupUrlEnv] || '').trim();
}

function buildSupportMailtoUrl(resource) {
  const params = new URLSearchParams({
    subject: `Please send my ${resource.name}`,
    body: `Hi,\n\nI signed up for the ${resource.name} but it did not arrive.\n\nPlease send the access link manually.\n`,
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

async function submitKitResourceLead({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    throw new Error('Unknown free resource');
  }

  const safeEmail = String(email || '').trim();
  if (!isValidEmail(safeEmail)) {
    throw new Error('Invalid subscriber email address');
  }

  const formBody = new URLSearchParams();
  const safeFirstName = normaliseFirstName(firstName);
  if (safeFirstName) {
    formBody.set('fields[first_name]', safeFirstName);
  }
  formBody.set('email_address', safeEmail);

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(new Error('Kit form request timed out')), KIT_TIMEOUT_MS)
    : null;

  try {
    const response = await fetchImpl(`${KIT_FORM_BASE}/${resource.kitFormId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
      redirect: 'manual',
      signal: controller ? controller.signal : undefined,
    });

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Kit form submission failed (${response.status})`);
    }

    return {
      resource,
      accepted: true,
      status: response.status,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildFallbackPayload({ resourceKey, emailSent = false }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    throw new Error('Unknown free resource');
  }

  const backupUrl = getBackupUrl(resource);
  const hasBackupUrl = Boolean(backupUrl);

  return {
    resource,
    message: hasBackupUrl
      ? `Kit is taking longer than usual. Use the backup link below so you can keep moving today.`
      : `Kit is taking longer than usual. Use the backup contact option below and we'll send it manually.`,
    fallback: {
      kind: hasBackupUrl ? 'download' : 'contact',
      url: hasBackupUrl ? backupUrl : buildSupportMailtoUrl(resource),
      label: hasBackupUrl ? resource.backupLabel : `Email ${SUPPORT_EMAIL}`,
      contactEmail: SUPPORT_EMAIL,
      emailSent,
    },
  };
}

function buildFallbackEmailHtml({ firstName, resource, backupUrl }) {
  const safeFirstName = normaliseFirstName(firstName) || 'there';
  const safeBackupHtml = backupUrl
    ? `<p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Use this backup link now: <a href="${backupUrl}" style="color:#2563eb;text-decoration:none;">${backupUrl}</a></p>`
    : `<p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;text-decoration:none;">${SUPPORT_EMAIL}</a> and we'll send it manually.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0a0f1e;padding:28px 32px;">
          <p style="margin:0;color:#60a5fa;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">ROHAN'S GAMSAT</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0a0f1e;line-height:1.3;">Backup access for your ${resource.name}</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${safeFirstName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Kit did not confirm delivery straight away, so I'm sending a backup path here so you are not left waiting.</p>
          ${safeBackupHtml}
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Rohan's GAMSAT</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendFallbackEmail({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    throw new Error('Unknown free resource');
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const safeEmail = String(email || '').trim();
  if (!apiKey || !isValidEmail(safeEmail)) {
    return { sent: false };
  }

  const backupUrl = getBackupUrl(resource);
  const resend = resendFactory(apiKey);

  await resend.emails.send({
    from: SUPPORT_EMAIL,
    to: safeEmail,
    subject: `Backup access for your ${resource.name}`,
    html: buildFallbackEmailHtml({ firstName, resource, backupUrl }),
    text: backupUrl
      ? `Hi ${normaliseFirstName(firstName) || 'there'},\n\nKit did not confirm delivery for your ${resource.name} straight away.\n\nUse this backup link now: ${backupUrl}\n\nIf you still need help, reply to this email or contact ${SUPPORT_EMAIL}.\n`
      : `Hi ${normaliseFirstName(firstName) || 'there'},\n\nKit did not confirm delivery for your ${resource.name} straight away.\n\nReply to this email or contact ${SUPPORT_EMAIL} and we'll send it manually.\n`,
  });

  return { sent: true };
}

module.exports = {
  SUPPORT_EMAIL,
  getFreeResource,
  submitKitResourceLead,
  buildFallbackPayload,
  sendFallbackEmail,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __setResendFactory: (value) => {
    resendFactory = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
    resendFactory = (apiKey) => new Resend(apiKey);
  },
};
