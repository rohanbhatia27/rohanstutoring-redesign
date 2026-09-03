/**
 * Product catalog — single source of truth for all purchase slugs.
 *
 * Consumers:
 *   Browser  : loaded via <script src="/js/catalog.js"> before checkout.js
 *   Node/API : require('../../js/catalog.js') or require('../js/catalog.js')
 *   Tests    : require('../js/catalog.js')
 *
 * Server-only fields (fulfillment, kit, drive) live in api/_lib/catalog.server.js.
 *
 * To reopen live coaching: update COHORT_STATUSES.liveCoaching.
 * To reopen a rescue sprint: flip `available` to true for that entry.
 * To reopen essay marking: set ESSAY_MARKING_AVAILABLE to true.
 */
(function (global) {
  'use strict';

  // ─── Core catalog ───────────────────────────────────────────────────────────
  // Each entry is keyed by its purchase slug (the value sent to the API).
  // `private-mentoring` is a page-level alias; its purchases go via
  // `mentoring-single` or `mentoring-pack`.

  const COHORT_STATUSES = {
    liveCoaching: {
      status: 'open',
      available: true,
      label: 'Enrol Now',
      publicMessage: 'Enrolments are open for the March 2027 cohort.',
    },
  };

  const COHORT_STATUS_BY_SLUG = {
    comprehensive: 'liveCoaching',
    's1-comprehensive': 'liveCoaching',
    's2-comprehensive': 'liveCoaching',
    mastery: 'liveCoaching',
  };

  function getCohortStatusForSlug(slug) {
    const statusKey = COHORT_STATUS_BY_SLUG[String(slug || '').trim()];
    return statusKey ? COHORT_STATUSES[statusKey] : null;
  }

  function isCohortAvailable(slug) {
    const status = getCohortStatusForSlug(slug);
    return status ? status.available === true : true;
  }

  // Essay marking is paused. Submissions reopen September 2026.
  // Flipping this to true restores the single essay, the 10-essay pack, and the
  // essay pack order bumps on the Blueprint checkouts.
  const ESSAY_MARKING_AVAILABLE = false;

  const CATALOG = {
    blueprint: {
      slug: 'blueprint',
      name: "Rohan's Blueprint",
      title: "Rohan's Blueprint",
      priceCents: 59900,
      available: true,
      highTicket: false,
      afterpay: true,
      instalmentEligible: false,
      allowedUpsells: ['mentoring-single', 'essay-pack-10'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/courses/blueprint-course-card.webp',
      tagline: 'Self-paced  Lifetime access  All devices',
      features: [
        'S1 & S2 Mastery Course (50+ hrs)',
        'GAMSAT Advanced Series (30 hrs)',
        'Expert Essay Collection (25 essays)',
        'Lifetime access  No expiry',
      ],
      isDigital: true,
      successType: 'digital',
      instalment: null,
      orderBump: {
        slug: 'mentoring-single',
        title: 'Add one 1:1 Strategy Class with a Top GAMSAT Tutor',
        description: 'A private 1-hour session with a top GAMSAT tutor to build a personalised study plan, target your weak areas, and answer any questions about the Blueprint.',
        priceWas: 119,
        badge: 'Blueprint-only offer',
        lockRuntimePrice: true,
      },
      secondOrderBump: {
        slug: 'essay-pack-10',
        title: 'Add the 10x Essay Marking Pack',
        description: 'Get clear feedback on ideas, structure, and expression across 10 full essays. Submit over time as you work through the course.',
        badge: 'Save $100',
      },
      pageSlug: 'blueprint',
    },

    'blueprint-s1': {
      slug: 'blueprint-s1',
      name: "Rohan's Blueprint: Section 1",
      title: "Rohan's Blueprint: Section 1 Only",
      priceCents: 39900,
      available: true,
      highTicket: false,
      afterpay: true,
      instalmentEligible: false,
      allowedUpsells: ['essay-pack-10', 'mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/blueprint-product.jpg',
      tagline: 'Section 1 only  40+ hours  Lifetime access',
      features: [
        '40+ hours of S1 instruction',
        '27 focused S1 modules',
        'S1 reasoning frameworks & drills',
        'Lifetime access  No expiry',
      ],
      isDigital: true,
      successType: 'digital',
      instalment: null,
      orderBump: {
        slug: 'mentoring-single',
        title: 'Add one 1:1 Strategy Class with a Top GAMSAT Tutor',
        description: 'A private 1-hour session with a top GAMSAT tutor to build a personalised study plan and target your weak areas in Section 1.',
        priceWas: 119,
        badge: 'Blueprint S1-only offer',
        lockRuntimePrice: true,
      },
      secondOrderBump: {
        slug: 'essay-pack-10',
        title: 'Add the 10x Essay Marking Pack',
        description: 'Get clear feedback on ideas, structure, and expression across 10 full S2 essays.',
        badge: 'Optional add-on',
      },
      pageSlug: 'blueprint-s1',
    },

    'blueprint-s2': {
      slug: 'blueprint-s2',
      name: "Rohan's Blueprint: Section 2",
      title: "Rohan's Blueprint: Section 2 Only",
      priceCents: 39900,
      available: true,
      highTicket: false,
      afterpay: true,
      instalmentEligible: false,
      allowedUpsells: ['essay-pack-10', 'essay-collection', 'mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/blueprint-product.jpg',
      tagline: 'Section 2 only  40+ hours  Lifetime access',
      features: [
        '40+ hours of S2 instruction',
        '27 focused S2 modules',
        'Essay frameworks, worked examples & model essays',
        'Lifetime access  No expiry',
      ],
      isDigital: true,
      successType: 'digital',
      instalment: null,
      orderBump: {
        slug: 'essay-pack-10',
        title: 'Add the 10x Essay Marking Pack',
        description: 'Get clear feedback on ideas, structure, and expression across 10 full essays. Submit over time as you work through the course.',
        badge: 'Save $100',
      },
      secondOrderBump: {
        slug: 'mentoring-single',
        title: 'Add one 1:1 Strategy Class with a Top GAMSAT Tutor',
        description: 'A private 1-hour session with a top GAMSAT tutor to build a personalised study plan and target your weak areas in Section 2.',
        priceWas: 119,
        badge: 'Blueprint S2-only offer',
        lockRuntimePrice: true,
      },
      pageSlug: 'blueprint-s2',
    },

    advanced: {
      slug: 'advanced',
      name: 'Elite Excellence Course',
      title: 'GAMSAT Advanced Series',
      priceCents: 29900,
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: '/assets/courses/advanced-course-card.webp',
      tagline: '30 hrs of elite-level S1 & S2 strategy  Lifetime access',
      features: [
        '30 hours of advanced S1 & S2 content',
        'Elite-level strategy for 70+ scores',
        'Worked examples across both sections',
        'Lifetime access  All devices',
      ],
      isDigital: true,
      successType: 'digital',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'advanced',
    },

    'essay-collection': {
      slug: 'essay-collection',
      name: 'Expert Essay Collection',
      title: 'Expert Essay Collection',
      priceCents: 7900,
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: '/assets/courses/essay-collection-cover.webp',
      tagline: '25 essays scored 80+  Immediate access',
      features: [
        '25 genuine GAMSAT essays scored 80+',
        '24 themes  Task A and Task B',
        '$3.16 per essay',
        'Immediate access  All devices',
      ],
      isDigital: true,
      successType: 'digital-download',
      instalment: null,
      orderBump: null,
      pageSlug: 'essay-collection',
    },

    'starter-pack': {
      slug: 'starter-pack',
      name: 'Essentials Playbook',
      title: 'GAMSAT Essentials Playbook',
      priceCents: 9700,
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: null,
      tagline: '30-day kickstart  $150 credit toward a full course',
      features: [
        '10-hour S1 & S2 Essentials Course',
        '2 essays marked with detailed feedback',
        '5 high-scoring model essays',
        '$150 credit toward a full course',
      ],
      isDigital: true,
      successType: 'digital',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'starter-pack',
    },

    'essay-marking': {
      slug: 'essay-marking',
      name: 'Essay Marking',
      title: 'S2 Essay Marking',
      priceCents: 3499,
      available: ESSAY_MARKING_AVAILABLE,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: '/assets/courses/essay-collection-cover.webp',
      tagline: '3-day turnaround  Top 1% scorer feedback',
      features: [
        'In-depth corrections on ideas, structure & language',
        '3-day turnaround',
        'Feedback from a top 1% GAMSAT scorer',
        'Send your essay after purchase',
      ],
      isDigital: false,
      requiresEssayUpload: true,
      successType: 'essay-marking',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'essay-marking',
    },

    'essay-pack-10': {
      slug: 'essay-pack-10',
      name: 'Essay Marking Pack (10 credits)',
      title: 'S2 Essay Marking — 10-Essay Pack',
      priceCents: 24900,
      available: ESSAY_MARKING_AVAILABLE,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: '/assets/courses/essay-collection-cover.webp',
      tagline: '10 essays  Submit over time  Top 1% scorer feedback',
      features: [
        '10 x in-depth essay markings',
        'Ideas, structure and language corrections',
        'Exemplars and evidence suggestions',
        'Submit essays over time via email',
      ],
      isDigital: false,
      successType: 'essay-pack-10',
      instalment: null,
      orderBump: null,
      pageSlug: null,
    },

    comprehensive: {
      slug: 'comprehensive',
      name: 'Comprehensive Course',
      title: 'GAMSAT S1 & S2 Comprehensive Course',
      // Early bird for the March 2027 cohort: $1,599 until 1 October 2026, or
      // until the first 10 enrolments land (tracked manually in Stripe — the
      // site has no seat counter). At cutover, restore priceCents to 179900,
      // set instalmentEligible back to true, and restore the instalment block
      // below at $539 x 4 against a new STRIPE_PRICE_COMPREHENSIVE_INSTALMENT.
      priceCents: 159900,
      available: isCohortAvailable('comprehensive'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/courses/comprehensive-course-card.webp',
      tagline: '',
      features: [
        '50+ hours of recorded library content',
        '20 live coaching classes',
        'Live essay feedback in every class',
        'Direct access to Rohan',
        '100% refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      // No instalment option during the early bird window. See the pricing
      // note above for what to restore at the 1 October cutover.
      instalment: null,
      orderBump: {
        slug: 'mentoring-single',
        title: 'Add one 1:1 Strategy Class With Rohan',
        description: 'A private 40 minute 1:1 session with Rohan before the course begins. Build your study plan, target your weak areas, and go into Week 1 with a clear direction.',
        priceWas: 119,
        badge: 'Enrolment-only offer',
        lockRuntimePrice: true,
      },
      pageSlug: 'comprehensive',
    },

    's1-comprehensive': {
      slug: 's1-comprehensive',
      name: 'Section 1 Comprehensive Course',
      title: 'GAMSAT Section 1 Comprehensive Course',
      priceCents: 99900,
      available: isCohortAvailable('s1-comprehensive'),
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: null,
      tagline: '',
      features: [
        'Section 1 live coaching classes',
        'Recorded strategy library',
        'Direct access to Rohan',
        '100% refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: null,
      orderBump: null,
      pageSlug: 's1-comprehensive',
    },

    's2-comprehensive': {
      slug: 's2-comprehensive',
      name: 'Section 2 Comprehensive Course',
      title: 'GAMSAT Section 2 Comprehensive Course',
      priceCents: 99900,
      available: isCohortAvailable('s2-comprehensive'),
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: null,
      tagline: '',
      features: [
        'Section 2 live coaching classes',
        'Essay feedback and writing frameworks',
        'Direct access to Rohan',
        '100% refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: null,
      orderBump: null,
      pageSlug: 's2-comprehensive',
    },

    mastery: {
      slug: 'mastery',
      name: 'Mastery Program',
      title: 'Mastery Program',
      priceCents: 249900,
      available: isCohortAvailable('mastery'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: true,
      allowedUpsells: ['mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/courses/mastery-course-card.webp',
      tagline: 'Private tutorials  Unlimited essay marking  Waitlist open',
      features: [
        'Everything in the Comprehensive Course',
        '5 × 1:1 private tutorials with Rohan',
        'Unlimited essay marking',
        'Monthly 1:1 check-ins',
        'Personalised study roadmap',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: {
        label: 'or pay $699 × 4 instalments →',
        url: '/checkout/?product=mastery&paymentMode=instalments',
        plan: {
          count: 4,
          firstPayment: 699,
          recurringPayment: 699,
          priceEnvKey: 'STRIPE_PRICE_MASTERY_INSTALMENT',
        },
      },
      orderBump: {
        slug: 'mentoring-single',
        title: 'Add extra 1:1 classes',
        description: 'Add as many private strategy classes as you want at the Mastery-only rate.',
        priceWas: 119,
        badge: 'Mastery-only offer',
        quantityEnabled: true,
        quantityLabel: 'Extra classes',
        minQuantity: 1,
        lockRuntimePrice: true,
      },
      pageSlug: 'mastery',
    },

    's1-rescue-sprint': {
      slug: 's1-rescue-sprint',
      name: 'S1 Rescue Sprint',
      title: 'S1 Rescue Sprint',
      priceCents: 34700,
      available: false, // reopening soon — flip to true when enrolments reopen
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: '/assets/courses/s1-rescue-sprint-hero.webp',
      tagline: '3 weeks  Full refund after Week 1 if not satisfied',
      features: [
        '3-week intensive S1 program',
        'Live coaching sessions',
        'Section 1 reasoning frameworks',
        'Full refund guarantee after Week 1',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 's1-rescue-sprint',
    },

    's2-rescue-sprint': {
      slug: 's2-rescue-sprint',
      name: 'S2 Rescue Sprint',
      title: 'S2 Rescue Sprint',
      priceCents: 19900,
      available: false, // reopening soon — flip to true when enrolments reopen
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: '/assets/courses/s2-rescue-sprint-hero.webp',
      tagline: '4 weeks  3 marked essays  Clinic recordings included',
      features: [
        '4-week S2 writing intensive',
        '3 marked essays with detailed feedback',
        'Live essay clinic sessions',
        'Clinic recordings included',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 's2-rescue-sprint',
    },

    'mentoring-single': {
      slug: 'mentoring-single',
      name: 'Private Mentoring Session',
      title: 'Single session',
      priceCents: 11900,
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: null,
      tagline: 'Book one class  S1, S2, or S3',
      features: [],
      isDigital: false,
      successType: 'mentoring',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'private-mentoring',
    },

    'mentoring-pack': {
      slug: 'mentoring-pack',
      name: 'Private Mentoring Pack',
      title: '10-class pack',
      priceCents: 107000,
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: null,
      tagline: 'Save $120  $107/hr',
      features: [],
      isDigital: false,
      successType: 'mentoring',
      instalment: null,
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'private-mentoring',
    },

    'private-mentoring': {
      slug: 'private-mentoring',
      name: 'Private Mentoring',
      title: '1:1 Private Mentoring',
      priceCents: null, // page-level entry only; purchase via mentoring-single or mentoring-pack
      available: true,
      highTicket: false,
      afterpay: false,
      instalmentEligible: false,
      allowedUpsells: ['essay-collection'],
      upsellPriceOverrides: {},
      image: null,
      tagline: 'Top 5% scorers  Flexible scheduling  S1, S2 & S3',
      features: [],
      isDigital: false,
      successType: 'mentoring',
      instalment: null,
      hasPkgSelector: true,
      packages: [
        { slug: 'mentoring-single', label: 'Single session', sub: 'Book one class  S1, S2, or S3' },
        { slug: 'mentoring-pack', label: '10-class pack', sub: 'Save $120  $107/hr' },
      ],
      orderBump: {
        slug: 'essay-collection',
        title: 'Add the Essay Collection',
        description: '25 essays scored 80+  Immediate access',
        badge: 'Optional add-on',
      },
      pageSlug: 'private-mentoring',
    },
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function getEntry(slug) {
    const entry = CATALOG[String(slug || '').trim()];
    if (!entry) throw new Error('Unknown product slug: ' + slug);
    return entry;
  }

  function getUpsellPriceCents(baseSlug, upsellSlug) {
    const base = CATALOG[baseSlug];
    if (!base) return null;
    if (base.upsellPriceOverrides && upsellSlug in base.upsellPriceOverrides) {
      return base.upsellPriceOverrides[upsellSlug];
    }
    const upsell = CATALOG[upsellSlug];
    return upsell ? upsell.priceCents : null;
  }

  function isAllowedUpsell(baseSlug, upsellSlug) {
    const base = CATALOG[baseSlug];
    return !!(base && base.allowedUpsells && base.allowedUpsells.includes(upsellSlug));
  }

  function getUnavailableSlugs() {
    return Object.keys(CATALOG).filter(function (k) { return !CATALOG[k].available; });
  }

  function getHighTicketSlugs() {
    return Object.keys(CATALOG).filter(function (k) { return CATALOG[k].highTicket; });
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  const ProductCatalog = {
    COHORT_STATUSES: COHORT_STATUSES,
    COHORT_STATUS_BY_SLUG: COHORT_STATUS_BY_SLUG,
    CATALOG: CATALOG,
    getEntry: getEntry,
    getCohortStatusForSlug: getCohortStatusForSlug,
    getUpsellPriceCents: getUpsellPriceCents,
    isAllowedUpsell: isAllowedUpsell,
    getUnavailableSlugs: getUnavailableSlugs,
    getHighTicketSlugs: getHighTicketSlugs,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductCatalog;
  }

  if (global && typeof global.ProductCatalog === 'undefined') {
    global.ProductCatalog = ProductCatalog;
  }
}(typeof window !== 'undefined' ? window : globalThis));
