const { Resend } = require('resend');
const { isValidEmail, addSubscriberToForm, addSubscriberToSequence } = require('./_kit.js');

const SUPPORT_EMAIL = 'hello@rohanstutoring.com';

const FREE_RESOURCES = {
  's1-tracker': {
    key: 's1-tracker',
    name: 'S1 Question Tracker',
    kitFormId: '8683298',
    kitSequenceId: '2723708',
    downloadUrl: 'https://docs.google.com/spreadsheets/d/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/edit?gid=788264791#gid=788264791',
    emailSubject: 'Your free S1 Question Tracker is inside',
    backupUrlEnv: 'FREE_RESOURCE_S1_TRACKER_BACKUP_URL',
    backupLabel: 'Open the tracker backup link',
  },
  's1-mock': {
    key: 's1-mock',
    name: 'S1 Mini Mock',
    kitFormId: '8717603',
    kitSequenceId: '2718570',
    downloadUrl: 'https://drive.google.com/file/d/12rRPRFxmef7Oe8FU2oTWP3Sp0jdnLztt/view?usp=sharing',
    emailSubject: 'Your free S1 Mini Mock is inside',
    backupUrlEnv: 'FREE_RESOURCE_S1_MOCK_BACKUP_URL',
    backupLabel: 'Open the mini-mock backup link',
  },
  's2-slam-system': {
    key: 's2-slam-system',
    name: 'S2 Slam System',
    kitFormId: '8526774',
    kitSequenceId: '2786194',
    downloadUrl: 'https://www.rohanstutoring.com/assets/free-resources/s2-slam-system.pdf',
    emailSubject: 'Your free S2 Slam System is inside',
    backupUrlEnv: 'FREE_RESOURCE_S2_SLAM_SYSTEM_BACKUP_URL',
    backupLabel: 'Open the S2 Slam System backup link',
  },
  'interview-calculator': {
    key: 'interview-calculator',
    name: 'Interview Chances Calculator',
    kitFormId: '9502408',
    backupUrlEnv: 'FREE_RESOURCE_INTERVIEW_CALCULATOR_BACKUP_URL',
    backupLabel: 'Open the calculator results backup link',
  },
};

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

function buildDeliveryEmailHtml({ firstName, resource }) {
  const safeFirstName = normaliseFirstName(firstName) || 'there';

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
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0a0f1e;line-height:1.3;">Your ${resource.name} is ready</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">Hi ${safeFirstName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">Here is the ${resource.name} you asked for. Open it with the button below.</p>
          <p style="margin:0 0 28px;">
            <a href="${resource.downloadUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:6px;">Open your ${resource.name}</a>
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">If the button does not work, use this link: <a href="${resource.downloadUrl}" style="color:#2563eb;text-decoration:none;">${resource.downloadUrl}</a></p>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">Talk soon,<br>Rohan</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendDeliveryEmail({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    throw new Error('Unknown free resource');
  }
  if (!resource.downloadUrl) {
    throw new Error(`No download URL configured for ${resourceKey}`);
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const safeEmail = String(email || '').trim();
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable');
  }
  if (!isValidEmail(safeEmail)) {
    throw new Error('Invalid subscriber email address');
  }

  const resend = resendFactory(apiKey);
  const result = await resend.emails.send({
    from: SUPPORT_EMAIL,
    to: safeEmail,
    subject: resource.emailSubject || `Your free ${resource.name}`,
    html: buildDeliveryEmailHtml({ firstName, resource }),
    text: `Hi ${normaliseFirstName(firstName) || 'there'},\n\nHere is your ${resource.name}:\n${resource.downloadUrl}\n\nTalk soon,\nRohan\n`,
  });

  return { sent: true, id: result && result.id ? result.id : null };
}

// Best-effort Kit sync run after delivery has already succeeded. Never throws:
// a Kit outage must not affect the student who already has their resource.
async function syncKitForResource({ resourceKey, email, firstName = '' }) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    return { synced: false, reason: 'unknown_resource' };
  }

  try {
    await addSubscriberToForm({ formId: resource.kitFormId, email, firstName });
  } catch (error) {
    console.error(`[leads/resource] Kit form add failed for ${resourceKey}:`, error.message);
  }

  if (resource.kitSequenceId) {
    try {
      await addSubscriberToSequence({ sequenceId: resource.kitSequenceId, email, firstName });
    } catch (error) {
      console.error(`[leads/resource] Kit sequence enroll failed for ${resourceKey}:`, error.message);
    }
  }

  return { synced: true };
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

module.exports = {
  SUPPORT_EMAIL,
  getFreeResource,
  buildFallbackPayload,
  sendDeliveryEmail,
  syncKitForResource,
  __setResendFactory: (value) => {
    resendFactory = value;
  },
  __resetForTests: () => {
    resendFactory = (apiKey) => new Resend(apiKey);
  },
};
