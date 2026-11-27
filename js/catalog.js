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
 * To reopen a sold-out cohort course: map its slug back to 'liveCoaching' in
 * COHORT_STATUS_BY_SLUG.
 * To reopen a rescue sprint: flip `available` to true for that entry.
 * To pause essay marking: set ESSAY_MARKING_AVAILABLE to false.
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
      publicMessage: 'Enrolments are open for the summer cohort. The first class is Sunday 29 November 2026, and enrolment closes Friday 27 November.',
    },
    // Summer cohort sold out (27 Nov 2026) for Comprehensive, S1-only and
    // Mastery. Existing instalment subscriptions are unaffected.
    soldOut: {
      status: 'soldOut',
      available: false,
      label: 'Join Waitlist',
      publicMessage: 'This course is sold out for the summer cohort. Join the waitlist and we will reach out when the next intake opens.',
    },
    // Summer cohort enrolment closed (27 Nov 2026) for S2-only.
    enrolmentClosed: {
      status: 'closed',
      available: false,
      label: 'Join Waitlist',
      publicMessage: 'Enrolment for the summer cohort is closed. Join the waitlist and we will reach out when the next intake opens.',
    },
    // GAMSAT March Intensive (12 Dec 2026 – 13 Mar 2027), capped at 15 seats.
    marchIntensive: {
      status: 'open',
      available: true,
      label: 'Enrol Now',
      publicMessage: 'Enrolments are open for the GAMSAT March Intensive. First class Saturday 12 December 2026; enrolment closes Thursday 10 December.',
    },
  };

  const COHORT_STATUS_BY_SLUG = {
    comprehensive: 'soldOut',
    's1-comprehensive': 'soldOut',
    's2-comprehensive': 'enrolmentClosed',
    mastery: 'soldOut',
    'march-intensive': 'marchIntensive',
    'march-intensive-premium': 'marchIntensive',
  };

  function getCohortStatusForSlug(slug) {
    const statusKey = COHORT_STATUS_BY_SLUG[String(slug || '').trim()];
    return statusKey ? COHORT_STATUSES[statusKey] : null;
  }

  function isCohortAvailable(slug) {
    const status = getCohortStatusForSlug(slug);
    return status ? status.available === true : true;
  }

  // Essay marking is open. Setting this to false pauses new submissions: it hides
  // the single essay, the 10-essay pack, and the essay pack order bumps on the
  // Blueprint checkouts.
  const ESSAY_MARKING_AVAILABLE = true;

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
        'S1 & S2 Mastery Course (included in the 80+ hour library)',
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
      name: 'GAMSAT Advanced Series',
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
      // March 2027 GAMSAT summer cohort (first class Sunday 29 November 2026; the
      // October cohort started Wednesday 28 October 2026). The $1,599
      // early bird ended at 23:59 AEDT on 4 October 2026; the price is now $1,799.
      //
      // Instalments are deliberately priced above the upfront total to push
      // students toward paying upfront: $1,996 vs $1,799, a ~11% premium
      // (Mastery is $2,996 vs $2,699, also ~11%).
      priceCents: 179900,
      available: isCohortAvailable('comprehensive'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: true,
      allowedUpsells: ['mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/courses/comprehensive-course-card.webp',
      tagline: '',
      features: [
        '80+ hours of recorded S1 & S2 library content',
        '20 live coaching classes',
        'Live essay feedback in every class',
        'Direct access to Rohan',
        '100% refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: {
        label: 'or 4 × $499 instalments ($1,996 total) →',
        url: '/checkout/?product=comprehensive&paymentMode=instalments',
        plan: {
          count: 4,
          firstPayment: 499,
          recurringPayment: 499,
          // price_1TZ3gSH5JsZI731GyQagdrkL — $499/month, active in Stripe on
          // prod_TCd5uh3o7P0Nm0 (Comprehensive 4x Payment Plan). The early-bird
          // $449 price (price_1TIRaTH5JsZI731G5kQtd0b7) stays active for
          // subscriptions that started on it.
          priceEnvKey: 'STRIPE_PRICE_COMPREHENSIVE_INSTALMENT',
        },
      },
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

    'march-intensive': {
      slug: 'march-intensive',
      name: 'GAMSAT March Intensive',
      title: 'GAMSAT March Intensive',
      // 16 live classes over 8 weekends (12 Dec 2026 – 13 Mar 2027), Base tier only.
      // Paid in full: $1,699 (+1 bonus marked essay = 3 total).
      // Instalments: 3 x $629/month ($1,887 total, ~11% premium).
      priceCents: 169900,
      available: isCohortAvailable('march-intensive'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: true,
      askSittingNumber: true,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: '/assets/courses/comprehensive-course-card.webp',
      tagline: '16 live classes over 8 weekends  Starts 12 Dec',
      features: [
        '16 live S1 & S2 classes with Rohan (all recorded)',
        'Full Blueprint library from day one (80+ hours)',
        'Weekly Game Plan + No-Backslide Holiday Plan',
        '2 essays marked by Rohan (+1 bonus if paid in full)',
        'Timed S2 mock + live debrief & 2 bonus sessions',
        'Two-class refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: {
        label: 'or 3 × $629 instalments ($1,887 total) →',
        url: '/checkout/?product=march-intensive&paymentMode=instalments',
        plan: {
          count: 3,
          firstPayment: 629,
          recurringPayment: 629,
          // price_1UgOGgH5JsZI731GoLkqqO2P — $629/month, active in Stripe on
          // prod_VhnsORhgTOTM9a (Rohan's GAMSAT March Intensive).
          priceEnvKey: 'STRIPE_PRICE_MARCH_INTENSIVE_INSTALMENT',
        },
      },
      orderBump: null,
      pageSlug: 'march-intensive',
    },

    'march-intensive-premium': {
      slug: 'march-intensive-premium',
      name: 'GAMSAT March Intensive Premium',
      title: 'GAMSAT March Intensive Premium',
      // Premium tier, capped at 6. Everything in Base plus 4 semi-privates
      // with Rohan (max 6 students), 6 extra marked essays (8 total) and a
      // 30-minute private diagnostic with Shayan.
      // Paid in full: $2,599. Instalments: 3 x $959/month ($2,877 total).
      priceCents: 259900,
      available: isCohortAvailable('march-intensive-premium'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: true,
      askSittingNumber: true,
      allowedUpsells: [],
      upsellPriceOverrides: {},
      image: '/assets/courses/comprehensive-course-card.webp',
      tagline: 'Premium · 6 places · Starts 12 Dec',
      features: [
        'Everything in the March Intensive',
        '4 semi-privates with Rohan (max 6 students)',
        '8 essays marked by Rohan in total',
        '30-minute private diagnostic with Shayan',
        '16 live S1 & S2 classes (all recorded) + Blueprint library',
        'Two-class refund guarantee',
      ],
      isDigital: false,
      successType: 'cohort',
      instalment: {
        label: 'or 3 × $959 instalments ($2,877 total) →',
        url: '/checkout/?product=march-intensive-premium&paymentMode=instalments',
        plan: {
          count: 3,
          firstPayment: 959,
          recurringPayment: 959,
          // price_1UgWCOH5JsZI731GOP9uEg4I — $959/month, active in Stripe on
          // prod_Vhw4ZmULxfYOfD (Rohan's GAMSAT March Intensive Premium).
          priceEnvKey: 'STRIPE_PRICE_MARCH_INTENSIVE_PREMIUM_INSTALMENT',
        },
      },
      orderBump: null,
      pageSlug: 'march-intensive',
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
      priceCents: 269900,
      available: isCohortAvailable('mastery'),
      highTicket: true,
      afterpay: false,
      instalmentEligible: true,
      allowedUpsells: ['mentoring-single'],
      upsellPriceOverrides: { 'mentoring-single': 9900 },
      image: '/assets/courses/mastery-course-card.webp',
      tagline: 'Private tutorials  Unlimited essay marking  Sold out',
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
        label: 'or 4 × $749 instalments ($2,996 total) →',
        url: '/checkout/?product=mastery&paymentMode=instalments',
        plan: {
          count: 4,
          firstPayment: 749,
          recurringPayment: 749,
          // price_1UK5Y8H5JsZI731GdLs1DHaH — $749/month, active in Stripe on
          // prod_T41Rxs9Kd1sHFW (GAMSAT Mastery Program).
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
