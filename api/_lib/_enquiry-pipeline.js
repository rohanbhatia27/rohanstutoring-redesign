'use strict';

const { OFFERS, routeRecommendedOffer } = require('./_enquiry-offers.js');
const { classifyEnquiry, generateReplyDraft } = require('./_openai-enquiry.js');
const { createDraft } = require('./_gmail-drafts.js');

let processFormspreeEnquiryImpl = processFormspreeEnquiry;
let previewDraftImpl = previewDraft;

function fallbackClassification(enquiry) {
  const message = String(enquiry.message || '').toLowerCase();
  const service = String(enquiry.service || '').toLowerCase();
  const urgent = /(urgent|asap|soon|september|march|trial|book|availability)/.test(message);
  const essayOnly = /(essay|essays|section 2|s2)/.test(message);
  const resit = /(resit|re-sit|sat the gamsat before|again|another sitting|second attempt|third attempt)/.test(message);
  const vague = message.length < 24;

  if (/(refund|complaint|lawyer|legal|depressed|self-harm|suicid)/.test(message)) {
    return {
      leadType: 'student',
      studentStage: 'unknown',
      examContext: 'sensitive',
      subjectNeed: 'unknown',
      urgency: 'high',
      buyerIntent: 'needs_reassurance',
      emotionalState: 'overwhelmed',
      recommendedPath: 'manual_review',
      recommendedNextStep: 'manual review only',
      manualReview: true,
      confidence: 0.61,
      reasoningSummary: 'Sensitive or high-risk language detected.',
    };
  }

  if (vague) {
    return {
      leadType: 'student',
      studentStage: 'unknown',
      examContext: 'unclear',
      subjectNeed: 'unknown',
      urgency: 'low',
      buyerIntent: 'browsing',
      emotionalState: 'confused',
      recommendedPath: 'clarifying_reply',
      recommendedNextStep: 'clarifying reply',
      manualReview: false,
      confidence: 0.64,
      reasoningSummary: 'Not enough detail to route confidently.',
    };
  }

  if (urgent || resit || service.includes('1-1')) {
    return {
      leadType: 'student',
      studentStage: 'gamsat_candidate',
      examContext: resit ? 'resitter' : 'time_sensitive',
      subjectNeed: essayOnly ? 'essay_help' : 'general_gamsat',
      urgency: urgent ? 'high' : 'medium',
      buyerIntent: 'ready_to_book',
      emotionalState: 'overwhelmed',
      recommendedPath: 'private_mentoring',
      recommendedNextStep: '1:1 consult',
      manualReview: false,
      confidence: 0.76,
      reasoningSummary: 'Urgency or prior attempts suggest higher-touch support.',
    };
  }

  if (essayOnly) {
    return {
      leadType: 'student',
      studentStage: 'gamsat_candidate',
      examContext: 'essay_only',
      subjectNeed: 'essay_help',
      urgency: 'medium',
      buyerIntent: 'needs_reassurance',
      emotionalState: 'confused',
      recommendedPath: 'essay_marking',
      recommendedNextStep: 'course page',
      manualReview: false,
      confidence: 0.72,
      reasoningSummary: 'The enquiry is narrowly focused on Section 2 help.',
    };
  }

  return {
    leadType: 'student',
    studentStage: 'gamsat_candidate',
    examContext: 'self_study',
    subjectNeed: 'general_gamsat',
    urgency: 'low',
    buyerIntent: 'comparing_options',
    emotionalState: 'ambitious',
    recommendedPath: 'blueprint',
    recommendedNextStep: 'course page',
    manualReview: false,
    confidence: 0.68,
    reasoningSummary: 'The lead appears to want structure more than emergency help.',
  };
}

function buildSubjectLine(enquiry, emailDraft) {
  const preferred = String(emailDraft.subject || '').trim();
  if (preferred) return preferred;

  const incoming = String(enquiry.subject || '').trim();
  if (incoming) {
    return incoming.toLowerCase().startsWith('re:') ? incoming : `Re: ${incoming}`;
  }

  return 'Re: Tutoring enquiry';
}

function buildClarifyingDraft({ enquiry, recommendedOffer, classification }) {
  const firstName = String(enquiry.firstName || enquiry.name || 'there').trim().split(' ')[0];
  const offerLine = recommendedOffer.url
    ? `If it helps, you can also have a quick look here before you reply:\n${recommendedOffer.url}\n\n`
    : '';

  return {
    subject: buildSubjectLine(enquiry, {}),
    body: [
      `Hi ${firstName || 'there'},`,
      '',
      'Thanks for reaching out. I can see you are trying to figure out the right next step, and I do not want to point you in the wrong direction with a generic answer.',
      '',
      'Before I recommend anything properly, could you reply with:',
      '1. Which GAMSAT sitting you are working toward',
      '2. Which section is giving you the most trouble right now',
      '3. Whether you are choosing between self-paced study, live support, or essay-only help',
      '',
      offerLine.trim(),
      'Once I have that, I can point you in the right direction.',
      '',
      'Warmly,',
      'Rohan',
    ].filter(Boolean).join('\n'),
    recommendedCta: recommendedOffer.key,
    confidence: Number(classification.confidence || 0.6),
    reviewNotes: 'Low-confidence enquiry. Clarifying reply drafted instead of a stronger sales recommendation.',
  };
}

function buildFallbackDraft({ enquiry, recommendedOffer, classification }) {
  const firstName = String(enquiry.firstName || enquiry.name || 'there').trim().split(' ')[0];
  const message = String(enquiry.message || '').trim();
  const sentence = message ? `especially if ${message.charAt(0).toLowerCase()}${message.slice(1)}` : 'especially when prep feels unclear';

  return {
    subject: buildSubjectLine(enquiry, {}),
    body: [
      `Hi ${firstName || 'there'},`,
      '',
      `Thanks for reaching out. I can understand why this would feel stressful, ${sentence}.`,
      '',
      `Based on what you have shared, I would suggest ${recommendedOffer.cta}. The reason is that it is the clearest next step for getting specific direction without adding more noise.`,
      '',
      recommendedOffer.url ? `You can do that here:\n${recommendedOffer.url}` : 'Reply here and I can point you in the right direction.',
      '',
      'If you reply with your current sitting timeline and the section causing the most trouble, I can make the recommendation more precise before you commit.',
      '',
      'Warmly,',
      'Rohan',
    ].join('\n'),
    recommendedCta: recommendedOffer.key,
    confidence: Number(classification.confidence || 0.7),
    reviewNotes: 'Fallback draft generated because the AI drafting step was unavailable.',
  };
}

async function buildPreview({ enquiry }) {
  let classification;
  try {
    classification = await classifyEnquiry({ enquiry, offers: OFFERS });
  } catch (error) {
    classification = fallbackClassification(enquiry);
  }

  const recommendedOffer = routeRecommendedOffer(classification);

  let emailDraft;
  if (classification.manualReview || Number(classification.confidence || 0) < 0.65) {
    emailDraft = buildClarifyingDraft({ enquiry, recommendedOffer, classification });
  } else {
    try {
      emailDraft = await generateReplyDraft({ enquiry, classification, recommendedOffer });
    } catch (error) {
      emailDraft = buildFallbackDraft({ enquiry, recommendedOffer, classification });
    }
  }

  emailDraft.subject = buildSubjectLine(enquiry, emailDraft);

  return {
    classification,
    recommendedOffer,
    emailDraft,
  };
}

async function previewDraft({ enquiry }) {
  return buildPreview({ enquiry });
}

async function processFormspreeEnquiry({ enquiry, payload }) {
  const preview = await buildPreview({ enquiry, payload });
  const draft = await createDraft({
    to: enquiry.email,
    subject: preview.emailDraft.subject,
    body: preview.emailDraft.body,
  });

  console.log('[enquiry-automation] Draft created', {
    email: enquiry.email,
    recommendedPath: preview.classification.recommendedPath,
    confidence: preview.classification.confidence,
    offerKey: preview.recommendedOffer.key,
    draftId: draft.id,
  });

  return Object.assign({}, preview, { draft });
}

module.exports = {
  previewDraft: (...args) => previewDraftImpl(...args),
  processFormspreeEnquiry: (...args) => processFormspreeEnquiryImpl(...args),
  __setPreviewDraft: (value) => {
    previewDraftImpl = value;
  },
  __setProcessFormspreeEnquiry: (value) => {
    processFormspreeEnquiryImpl = value;
  },
  __resetForTests: () => {
    previewDraftImpl = previewDraft;
    processFormspreeEnquiryImpl = processFormspreeEnquiry;
  },
};
