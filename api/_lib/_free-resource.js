const { Resend } = require('resend');
const {
  isValidEmail,
  upsertSubscriber,
  findSubscriberByEmail,
  tagSubscriber,
  addSubscriberToForm,
  addSubscriberToSequence,
} = require('./_kit.js');

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
  // No Kit form or sequence yet: Resend delivers the PDF, then the lead is
  // tagged lm_march27_gameplan in Kit so broadcasts and automations can reach them.
  'game-plan': {
    key: 'game-plan',
    name: 'March 2027 Game Plan',
    kitTagId: '24104655',
    downloadUrl: 'https://www.rohanstutoring.com/assets/free-resources/march-2027-game-plan.pdf',
    fromName: "Rohan's GAMSAT",
    emailSubject: 'Your March 2027 Game Plan',
    emailPreheader: "March is two exam days this time. Here's how to plan for both.",
    buildEmail: buildGamePlanEmail,
    backupUrlEnv: 'FREE_RESOURCE_GAME_PLAN_BACKUP_URL',
    backupUrl: 'https://www.rohanstutoring.com/assets/free-resources/march-2027-game-plan.pdf',
    backupLabel: 'Open the Game Plan PDF',
  },
};

let resendFactory = (apiKey) => new Resend(apiKey);

function normaliseFirstName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFreeResource(resourceKey) {
  const key = String(resourceKey || '').trim();
  return FREE_RESOURCES[key] || null;
}

function getBackupUrl(resource) {
  if (!resource) return '';
  return String(process.env[resource.backupUrlEnv] || resource.backupUrl || '').trim();
}

function buildSupportMailtoUrl(resource) {
  const params = new URLSearchParams({
    subject: `Please send my ${resource.name}`,
    body: `Hi,\n\nI signed up for the ${resource.name} but it did not arrive.\n\nPlease send the access link manually.\n`,
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

function buildDeliveryEmailHtml({ firstName, resource }) {
  const safeFirstName = escapeHtml(normaliseFirstName(firstName) || 'there');

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

const EMAIL_LOGO_URL = 'https://www.rohanstutoring.com/assets/email/rohans-gamsat-logo.png';
const GAME_PLAN_QUIZ_URL = 'https://www.rohanstutoring.com/quiz?utm_source=email&utm_medium=delivery&utm_campaign=march27_gameplan';

function buildGamePlanEmail({ firstName, resource }) {
  const plainName = normaliseFirstName(firstName) || 'there';
  const name = escapeHtml(plainName);
  const pdf = resource.downloadUrl;
  const p = (html) => `<p style="margin:0 0 18px;font-size:15px;color:#374151;line-height:1.6;">${html}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${resource.emailPreheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#0a0f1e;padding:20px 32px;">
          <img src="${EMAIL_LOGO_URL}" width="96" height="96" alt="Rohan's GAMSAT" style="display:block;border:0;outline:none;text-decoration:none;width:96px;height:96px;color:#ffffff;font-size:16px;font-weight:600;">
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          ${p(`Hi ${name},`)}
          ${p('Here&#39;s your March 2027 Game Plan.')}
          <p style="margin:0 0 24px;">
            <a href="${pdf}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:6px;">Open your Game Plan (PDF)</a>
          </p>
          ${p('Quick heads up before you open it. March 2027 isn&#39;t one exam day. Section 2 is expected in late February, from home, and Sections 1 and 3 about three weeks later at a test centre. So your essays need to be ready earlier than most people think.')}
          ${p('The plan breaks the next six months into four phases, with how many hours a week each one needs and what to actually focus on in S1 and S2.')}
          ${p('If you only do one thing this week, make it the review habit on page 4. After every S1 question you get wrong, name the mistake, write one sentence on what you&#39;ll do differently, and do another question of the same type straight away. It adds a minute or two per question, BUT by December your top three mistake patterns should be pretty obvious.')}
          ${p('And chuck a reminder in your calendar for November. That&#39;s when March registrations open.')}
          ${p('Talk soon,<br>Rohan')}
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">P.S. Not sure how much support you actually need between now and March? The <a href="${GAME_PLAN_QUIZ_URL}" style="color:#2563eb;">2-minute quiz</a> will point you to the right fit.</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">If the button doesn&#39;t work, use this link: <a href="${pdf}" style="color:#2563eb;text-decoration:none;">${pdf}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${plainName},

Here's your March 2027 Game Plan:
${pdf}

Quick heads up before you open it. March 2027 isn't one exam day. Section 2 is expected in late February, from home, and Sections 1 and 3 about three weeks later at a test centre. So your essays need to be ready earlier than most people think.

The plan breaks the next six months into four phases, with how many hours a week each one needs and what to actually focus on in S1 and S2.

If you only do one thing this week, make it the review habit on page 4. After every S1 question you get wrong, name the mistake, write one sentence on what you'll do differently, and do another question of the same type straight away. It adds a minute or two per question, BUT by December your top three mistake patterns should be pretty obvious.

And chuck a reminder in your calendar for November. That's when March registrations open.

Talk soon,
Rohan

P.S. Not sure how much support you actually need between now and March? The 2-minute quiz will point you to the right fit:
${GAME_PLAN_QUIZ_URL}
`;

  return { html, text };
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

  const content = resource.buildEmail
    ? resource.buildEmail({ firstName, resource })
    : {
      html: buildDeliveryEmailHtml({ firstName, resource }),
      text: `Hi ${normaliseFirstName(firstName) || 'there'},\n\nHere is your ${resource.name}:\n${resource.downloadUrl}\n\nTalk soon,\nRohan\n`,
    };

  const resend = resendFactory(apiKey);
  const result = await resend.emails.send({
    from: resource.fromName ? `"${resource.fromName}" <${SUPPORT_EMAIL}>` : SUPPORT_EMAIL,
    to: safeEmail,
    subject: resource.emailSubject || `Your free ${resource.name}`,
    html: content.html,
    text: content.text,
  });

  if (result && result.error) {
    throw new Error(result.error.message || 'Resend rejected the delivery email');
  }
  if (!result || !(result.data?.id || result.id)) {
    throw new Error('Resend returned no delivery email id');
  }

  return { sent: true, id: result.data?.id || result.id };
}

// Report failed steps so the caller can persist and retry them after delivery.
async function syncKitForResource({ resourceKey, email, firstName = '' }, { steps, preserveInactive = false } = {}) {
  const resource = getFreeResource(resourceKey);
  if (!resource) {
    return { synced: false, reason: 'unknown_resource' };
  }

  const failedSteps = [];
  const shouldRun = (step) => !steps || steps.includes(step);

  if (preserveInactive) {
    try {
      const existing = await findSubscriberByEmail(email);
      if (existing && existing.state !== 'active') {
        return { synced: false, reason: 'inactive_subscriber', permanent: true };
      }
    } catch (error) {
      console.error(`[leads/resource] Kit subscriber state check failed for ${resourceKey}:`, error.message);
      return { synced: false, reason: 'state_check_failed', failedSteps: steps || ['form', 'sequence', 'tag'].filter((step) => Boolean(resource[`kit${step[0].toUpperCase()}${step.slice(1)}Id`])) };
    }
  }

  if (resource.kitFormId && shouldRun('form')) {
    try {
      await addSubscriberToForm({ formId: resource.kitFormId, email, firstName });
    } catch (error) {
      console.error(`[leads/resource] Kit form add failed for ${resourceKey}:`, error.message);
      failedSteps.push('form');
    }
  }

  if (resource.kitSequenceId && shouldRun('sequence')) {
    try {
      await addSubscriberToSequence({ sequenceId: resource.kitSequenceId, email, firstName });
    } catch (error) {
      console.error(`[leads/resource] Kit sequence enroll failed for ${resourceKey}:`, error.message);
      failedSteps.push('sequence');
    }
  }

  if (resource.kitTagId && shouldRun('tag')) {
    try {
      const subscriber = await upsertSubscriber({ email, firstName });
      if (!subscriber || !subscriber.id) throw new Error('Kit returned no subscriber id');
      await tagSubscriber({ subscriberId: subscriber.id, tagId: resource.kitTagId });
    } catch (error) {
      console.error(`[leads/resource] Kit tag failed for ${resourceKey}:`, error.message);
      failedSteps.push('tag');
    }
  }

  return failedSteps.length ? { synced: false, failedSteps } : { synced: true };
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
      ? `Email delivery is taking longer than usual. Use the backup link below so you can keep moving today.`
      : `Email delivery is taking longer than usual. Use the backup contact option below and we'll send it manually.`,
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
