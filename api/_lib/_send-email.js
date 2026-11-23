async function sendEmail({ resendFactory, options, idempotencyKey }) {
  const restriction = String(process.env.SANDBOX_ALLOWED_EMAILS || '').trim();
  if (restriction) {
    const allowed = new Set(restriction.split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
    const recipients = [options.to, options.cc, options.bcc].flat().filter(Boolean);
    if (!recipients.length || recipients.some(email => !allowed.has(String(email).trim().toLowerCase()))) {
      const error = new Error('Sandbox recipient is not allowed');
      error.notAccepted = true;
      throw error;
    }
  }
  const apiKey = String(process.env.FULFILLMENT_RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) { const error = new Error('RESEND_API_KEY not set'); error.notAccepted = true; throw error; }
  const result = await resendFactory(apiKey).emails.send(options, idempotencyKey ? { idempotencyKey } : undefined);
  if (result?.error) {
    const error = new Error(result.error.message || 'Resend rejected email');
    const status = Number(result.error.statusCode);
    if (status >= 400 && status < 500 && status !== 409) error.notAccepted = true;
    throw error;
  }
  if (!result?.data?.id) throw new Error('Resend did not return a message ID');
  return { messageId: result.data.id };
}
module.exports = sendEmail;
