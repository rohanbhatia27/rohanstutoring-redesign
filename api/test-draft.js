'use strict';

const enquiryPipeline = require('./_lib/_enquiry-pipeline.js');

function getExpectedToken() {
  return String(
    process.env.ENQUIRY_AUTOMATION_TOKEN ||
    process.env.FULFILLMENT_RETRY_TOKEN ||
    ''
  ).trim();
}

function getRequestToken(req) {
  return String(
    req.headers['x-enquiry-automation-token'] ||
    req.body?.token ||
    req.query?.token ||
    ''
  ).trim();
}

async function testDraftHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedToken = getExpectedToken();
  if (!expectedToken || getRequestToken(req) !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) {
    return res.status(400).json({ error: 'Missing request body.' });
  }

  const enquiry = body.enquiry && typeof body.enquiry === 'object' ? body.enquiry : body;
  if (!String(enquiry.email || '').trim() || !String(enquiry.message || '').trim()) {
    return res.status(400).json({ error: 'Missing enquiry email or message.' });
  }

  try {
    if (body.dryRun) {
      const preview = await enquiryPipeline.previewDraft({ enquiry });
      return res.status(200).json(Object.assign({ ok: true, mode: 'preview' }, preview));
    }

    const result = await enquiryPipeline.processFormspreeEnquiry({
      enquiry,
      payload: { source: 'manual-test-draft' },
    });

    return res.status(200).json({
      ok: true,
      mode: 'draft_created',
      classification: result.classification,
      recommendedOffer: result.recommendedOffer,
      draftId: result.draft && result.draft.id ? result.draft.id : '',
    });
  } catch (error) {
    console.error('[test-draft] Failed to build draft:', error.message);
    return res.status(500).json({ error: 'Unable to build a draft right now.' });
  }
}

module.exports = testDraftHandler;
