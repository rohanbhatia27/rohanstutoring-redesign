'use strict';

const { Resend } = require('resend');
let resendFactory = (key) => new Resend(key);

async function sendResourceSyncAlert({ kind, resourceKey = 'game-plan', email = '', detail = '' }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const adminEmail = String(process.env.ADMIN_ALERT_EMAIL || '').trim();
  if (!apiKey || !adminEmail) {
    console.error('[leads/resource] Cannot alert: RESEND_API_KEY or ADMIN_ALERT_EMAIL missing');
    return false;
  }
  const safeKind = String(kind || 'Resource sync issue').slice(0, 100);
  const text = [
    `Issue: ${safeKind}`,
    `Resource: ${resourceKey}`,
    ...(email ? [`Lead: ${email}`] : []),
    `Detail: ${String(detail).slice(0, 1000)}`,
    '',
    'Check the free_resource.lead records in Supabase purchase_events and the resource sync cron logs.',
  ].join('\n');
  try {
    const result = await resendFactory(apiKey).emails.send({
      from: 'hello@rohanstutoring.com',
      to: adminEmail,
      subject: `[RESOURCE ALERT] ${safeKind}: ${resourceKey}`,
      text,
    });
    if (result?.error || !(result?.data?.id || result?.id)) {
      throw new Error(result?.error?.message || 'Resend returned no alert email id');
    }
    return true;
  } catch (error) {
    console.error('[leads/resource] Alert email failed:', error.message);
    return false;
  }
}

sendResourceSyncAlert.__setResendFactory = (factory) => { resendFactory = factory; };
sendResourceSyncAlert.__resetForTests = () => { resendFactory = (key) => new Resend(key); };

module.exports = sendResourceSyncAlert;
