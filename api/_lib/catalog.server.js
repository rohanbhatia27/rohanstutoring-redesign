/**
 * Server-only product catalog extension.
 *
 * Extends the shared catalog (js/catalog.js) with fields that must never
 * ship to the browser: fulfillment types, Google Drive folder slugs,
 * Kit tag env-var names, and cohort email variants.
 *
 * Usage:
 *   const { SERVER_CATALOG, getServerEntry } = require('./catalog.server.js');
 */
'use strict';

const {
  CATALOG,
  getEntry,
  getUpsellPriceCents,
  isAllowedUpsell,
  getUnavailableSlugs,
  getHighTicketSlugs,
} = require('../../js/catalog.js');

// ─── Server-only fields ──────────────────────────────────────────────────────
//
// deliveryType:         how the purchase is fulfilled
// fulfillmentLabel:     label shown in the admin retry-fulfillment UI
// fulfillmentSlug:      the slug used inside fulfillment logic (usually same
//                       as purchase slug, except mentoring-single/pack → private-mentoring)
// driveFolderSlug:      resolved slug used to build GOOGLE_DRIVE_FOLDER_ID_* env var;
//                       null for products that have no Drive delivery
// purchaseTagEnv:       env var name holding the Kit tag id for purchase events;
//                       null for products with no Kit tag
// cohortEmail:          subject + startLine for the cohort-onboarding welcome email;
//                       null for non-cohort products

const SERVER_EXTENSIONS = {
  blueprint: {
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
    fulfillmentSlug: 'blueprint',
    driveFolderSlug: 'blueprint',
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_BLUEPRINT',
    cohortEmail: null,
  },

  advanced: {
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
    fulfillmentSlug: 'advanced',
    driveFolderSlug: 'advanced',
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'essay-collection': {
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
    fulfillmentSlug: 'essay-collection',
    driveFolderSlug: 'essay-collection',
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'starter-pack': {
    deliveryType: 'digital-access',
    fulfillmentLabel: 'Send Google Drive access',
    fulfillmentSlug: 'starter-pack',
    driveFolderSlug: 'starter-pack',
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_ESSENTIALS_PLAYBOOK',
    cohortEmail: null,
  },

  'essay-marking': {
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay submission instructions',
    fulfillmentSlug: 'essay-marking',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'essay-pack-10': {
    deliveryType: 'essay-submission',
    fulfillmentLabel: 'Send essay pack submission instructions',
    fulfillmentSlug: 'essay-pack-10',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  comprehensive: {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 'comprehensive',
    driveFolderSlug: 'blueprint', // shares Blueprint Drive folder
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_COMPREHENSIVE',
    cohortEmail: {
      subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
      startLine: 'Your June cohort starts on Monday 15 June. You now have immediate access to the course library before Week 1.',
    },
  },

  's1-comprehensive': {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 's1-comprehensive',
    driveFolderSlug: 'blueprint', // shares Blueprint Drive folder
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_COMPREHENSIVE',
    cohortEmail: {
      subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
      startLine: 'Your June cohort starts on Monday 15 June. You now have immediate access to the course library before Week 1.',
    },
  },

  's2-comprehensive': {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 's2-comprehensive',
    driveFolderSlug: 'blueprint', // shares Blueprint Drive folder
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_COMPREHENSIVE',
    cohortEmail: {
      subject: "Welcome to the Comprehensive Course 👋 Let's get started.",
      startLine: 'Your June cohort starts on Monday 15 June. You now have immediate access to the course library before Week 1.',
    },
  },

  mastery: {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 'mastery',
    driveFolderSlug: 'blueprint', // shares Blueprint Drive folder
    purchaseTagEnv: 'KIT_TAG_ID_PURCHASED_MASTERY',
    cohortEmail: null,
  },

  's1-rescue-sprint': {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 's1-rescue-sprint',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  's2-rescue-sprint': {
    deliveryType: 'cohort-onboarding',
    fulfillmentLabel: 'Send cohort onboarding email',
    fulfillmentSlug: 's2-rescue-sprint',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'mentoring-single': {
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
    fulfillmentSlug: 'private-mentoring',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'mentoring-pack': {
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
    fulfillmentSlug: 'private-mentoring',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },

  'private-mentoring': {
    deliveryType: 'booking-link',
    fulfillmentLabel: 'Send mentoring booking link',
    fulfillmentSlug: 'private-mentoring',
    driveFolderSlug: null,
    purchaseTagEnv: null,
    cohortEmail: null,
  },
};

// ─── Merged catalog ──────────────────────────────────────────────────────────

const SERVER_CATALOG = (function () {
  const merged = {};
  const allSlugs = new Set([...Object.keys(CATALOG), ...Object.keys(SERVER_EXTENSIONS)]);
  allSlugs.forEach(function (slug) {
    merged[slug] = Object.assign({}, CATALOG[slug] || {}, SERVER_EXTENSIONS[slug] || {});
  });
  return merged;
}());

function getServerEntry(slug) {
  const entry = SERVER_CATALOG[String(slug || '').trim()];
  if (!entry) throw new Error('Unknown product slug: ' + slug);
  return entry;
}

module.exports = {
  SERVER_CATALOG: SERVER_CATALOG,
  SERVER_EXTENSIONS: SERVER_EXTENSIONS,
  getServerEntry: getServerEntry,
  // re-exports of shared helpers for convenience
  CATALOG: CATALOG,
  getEntry: getEntry,
  getUpsellPriceCents: getUpsellPriceCents,
  isAllowedUpsell: isAllowedUpsell,
  getUnavailableSlugs: getUnavailableSlugs,
  getHighTicketSlugs: getHighTicketSlugs,
};
