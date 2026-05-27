'use strict';

function getBaseUrl() {
  const configured = String(process.env.PUBLIC_SITE_URL || '').trim();
  return (configured || 'https://www.rohanstutoring.com').replace(/\/+$/, '');
}

function makeUrl(pathname, envName) {
  const override = String(process.env[envName] || '').trim();
  if (override) return override;
  return `${getBaseUrl()}${pathname}`;
}

const OFFERS = Object.freeze({
  privateMentoring: Object.freeze({
    key: 'privateMentoring',
    offerKey: 'privateMentoring',
    name: 'Private Mentoring',
    url: makeUrl('/courses/private-mentoring', 'ENQUIRY_URL_PRIVATE_MENTORING'),
    cta: 'book a strategy consult',
  }),
  blueprint: Object.freeze({
    key: 'blueprint',
    offerKey: 'blueprint',
    name: "Rohan's Blueprint",
    url: makeUrl('/courses/blueprint', 'ENQUIRY_URL_BLUEPRINT'),
    cta: 'see the Blueprint',
  }),
  essayMarking: Object.freeze({
    key: 'essayMarking',
    offerKey: 'essayMarking',
    name: 'Essay Marking',
    url: makeUrl('/courses/essay-marking', 'ENQUIRY_URL_ESSAY_MARKING'),
    cta: 'start with essay marking',
  }),
  leadMagnet: Object.freeze({
    key: 'leadMagnet',
    offerKey: 'leadMagnet',
    name: 'S2 Slam System',
    url: makeUrl('/s2-slam-system', 'ENQUIRY_URL_LEAD_MAGNET'),
    cta: 'start with the free S2 Slam System',
  }),
  clarifyingReply: Object.freeze({
    key: 'clarifyingReply',
    offerKey: 'clarifyingReply',
    name: 'Clarifying Reply',
    url: '',
    cta: 'reply with a little more context',
  }),
  manualReview: Object.freeze({
    key: 'manualReview',
    offerKey: 'manualReview',
    name: 'Manual Review',
    url: '',
    cta: 'review manually before sending',
  }),
});

function routeRecommendedOffer(classification = {}) {
  const recommendedPath = String(
    classification.recommendedPath ||
    classification.recommendedCta ||
    ''
  ).trim().toLowerCase();
  const recommendedNextStep = String(classification.recommendedNextStep || '').trim().toLowerCase();
  const subjectNeed = String(classification.subjectNeed || '').trim().toLowerCase();
  const urgency = String(classification.urgency || '').trim().toLowerCase();
  const buyerIntent = String(classification.buyerIntent || classification.intent || '').trim().toLowerCase();

  if (
    recommendedPath === 'manual_review' ||
    recommendedNextStep === 'manual review only'
  ) {
    return OFFERS.manualReview;
  }

  if (
    recommendedPath === 'clarifying_reply' ||
    recommendedNextStep === 'clarifying reply'
  ) {
    return OFFERS.clarifyingReply;
  }

  if (
    recommendedPath === 'lead_magnet' ||
    recommendedNextStep === 'free lead magnet'
  ) {
    return OFFERS.leadMagnet;
  }

  if (
    recommendedPath === 'private_mentoring' ||
    recommendedNextStep === '1:1 consult' ||
    urgency === 'critical' ||
    urgency === 'high' ||
    buyerIntent === 'ready_to_book' ||
    buyerIntent === 'high_trust_high_fit'
  ) {
    return OFFERS.privateMentoring;
  }

  if (
    recommendedPath === 'essay_marking' ||
    subjectNeed === 'essay_help'
  ) {
    return OFFERS.essayMarking;
  }

  if (
    recommendedPath === 'blueprint' ||
    recommendedNextStep === 'course page'
  ) {
    return OFFERS.blueprint;
  }

  return OFFERS.blueprint;
}

module.exports = {
  OFFERS,
  routeRecommendedOffer,
};
