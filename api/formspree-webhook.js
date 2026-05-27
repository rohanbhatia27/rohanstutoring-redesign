'use strict';

const {
  normalisePayload,
  readRawBody,
  verifySignature,
} = require('./_lib/_formspree-webhook.js');
const enquiryPipeline = require('./_lib/_enquiry-pipeline.js');

async function formspreeWebhookHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers['formspree-signature'] || req.headers['Formspree-Signature'] || '';

  if (!verifySignature({ rawBody, signatureHeader })) {
    return res.status(401).json({ error: 'Invalid Formspree signature.' });
  }

  let payload;
  try {
    payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(rawBody || '{}');
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const normalised = normalisePayload(payload);
  if (!normalised.enquiry.email || !normalised.enquiry.message) {
    return res.status(400).json({ error: 'Missing enquiry email or message.' });
  }

  try {
    const result = await enquiryPipeline.processFormspreeEnquiry({
      payload,
      enquiry: normalised.enquiry,
    });

    return res.status(200).json({
      ok: true,
      classification: result.classification,
      recommendedOffer: result.recommendedOffer,
      draftId: result.draft && result.draft.id ? result.draft.id : '',
    });
  } catch (error) {
    console.error('[formspree-webhook] Failed to process enquiry:', error.message);
    return res.status(500).json({ error: 'Unable to process enquiry right now.' });
  }
}

module.exports = formspreeWebhookHandler;
