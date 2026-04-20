(function (global) {
  const MASTERY_INSTALMENT_URL = 'https://buy.stripe.com/cNi8wP53m5o69Wt7MoeEo0o';
  // Replace with your live Tally form URL once the form is created at tally.so
  const TALLY_ESSAY_FORM_URL = 'https://tally.so/r/REPLACE_ME';
  const EMAIL_PATTERN = /^[^\s@.][^\s@]*@[^\s@]+\.[^\s@.]{2,}$/;
  let checkoutConfigPromise = null;

  const PRODUCTS = {
    blueprint: {
      name: "Rohan's Blueprint",
      tagline: 'Self-paced · Lifetime access · All devices',
      price: 599,
      features: [
        'S1 & S2 Mastery Course (50+ hrs)',
        'GAMSAT Advanced Series (30 hrs)',
        'Expert Essay Collection (25 essays)',
        'Lifetime access · No expiry',
      ],
      isDigital: true,
      instalment: null,
      successType: 'digital',
    },
    advanced: {
      name: 'GAMSAT Advanced Series',
      tagline: '30 hrs of elite-level S1 & S2 strategy · Lifetime access',
      price: 299,
      features: [
        '30 hours of advanced S1 & S2 content',
        'Elite-level strategy for 70+ scores',
        'Worked examples across both sections',
        'Lifetime access · All devices',
      ],
      isDigital: true,
      instalment: null,
      successType: 'digital',
    },
    'essay-collection': {
      name: 'Expert Essay Collection',
      tagline: '25 essays scored 80+ · Immediate access',
      price: 79,
      features: [
        '25 genuine GAMSAT essays scored 80+',
        '24 themes · Task A and Task B',
        '$3.16 per essay',
        'Immediate access · All devices',
      ],
      isDigital: true,
      instalment: null,
      successType: 'digital',
    },
    'starter-pack': {
      name: 'GAMSAT Essentials Playbook',
      tagline: '30-day kickstart · $150 credit toward a full course',
      price: 97,
      features: [
        '10-hour S1 & S2 Essentials Course',
        '2 essays marked with detailed feedback',
        '5 high-scoring model essays',
        '$150 credit toward a full course',
      ],
      isDigital: true,
      instalment: null,
      successType: 'digital',
    },
    'essay-marking': {
      name: 'S2 Essay Marking',
      tagline: '3-day turnaround · Top 1% scorer feedback',
      price: 34.99,
      features: [
        'In-depth corrections on ideas, structure & language',
        '3-day turnaround',
        'Feedback from a top 1% GAMSAT scorer',
        'Send your essay after purchase',
      ],
      isDigital: false,
      instalment: null,
      successType: 'essay-marking',
    },
    'essay-pack-10': {
      name: 'S2 Essay Marking — 10-Essay Pack',
      tagline: '10 essays · Submit over time · Top 1% scorer feedback',
      price: 249,
      features: [
        '10 x in-depth essay markings',
        'Ideas, structure and language corrections',
        'Exemplars and evidence suggestions',
        'Submit essays over time via email',
      ],
      isDigital: false,
      instalment: null,
      successType: 'essay-pack-10',
    },
    comprehensive: {
      name: 'Comprehensive Course',
      tagline: '24 live classes · 50+ hrs content · September cohort',
      price: 1549,
      features: [
        '50+ hours of recorded library content',
        '24 live coaching classes',
        'Live essay feedback in every class',
        'Direct access to Rohan',
        '100% refund guarantee',
      ],
      isDigital: false,
      instalment: {
        label: 'or pay $449 × 4 instalments →',
        url: 'https://buy.stripe.com/8x25kDeDWdUC2u1eaMeEo0m',
      },
      successType: 'cohort',
    },
    mastery: {
      name: 'Mastery Program',
      tagline: 'Private tutorials · Unlimited essay marking · September cohort',
      price: 2249,
      features: [
        'Everything in the Comprehensive Course',
        '5 × 1:1 private tutorials with Rohan',
        'Unlimited essay marking',
        'Monthly 1:1 check-ins',
        'Personalised study roadmap',
      ],
      isDigital: false,
      instalment: {
        label: 'or pay $649 × 4 instalments →',
        url: MASTERY_INSTALMENT_URL,
      },
      successType: 'cohort',
    },
    's1-rescue-sprint': {
      name: 'S1 Rescue Sprint',
      tagline: '3 weeks · Full refund after Week 1 if not satisfied',
      price: 347,
      features: [
        '3-week intensive S1 program',
        'Live coaching sessions',
        'Section 1 reasoning frameworks',
        'Full refund guarantee after Week 1',
      ],
      isDigital: false,
      instalment: null,
      successType: 'cohort',
    },
    's2-rescue-sprint': {
      name: 'S2 Rescue Sprint',
      tagline: '4 weeks · 3 marked essays · Clinic recordings included',
      price: 199,
      features: [
        '4-week S2 writing intensive',
        '3 marked essays with detailed feedback',
        'Live essay clinic sessions',
        'Clinic recordings included',
      ],
      isDigital: false,
      instalment: null,
      successType: 'cohort',
    },
    'private-mentoring': {
      name: '1:1 Private Mentoring',
      tagline: 'Top 5% scorers · Flexible scheduling · S1, S2 & S3',
      isDigital: false,
      instalment: null,
      successType: 'mentoring',
      hasPkgSelector: true,
      packages: [
        {
          slug: 'mentoring-single',
          label: 'Single session',
          sub: 'Book one class · S1, S2, or S3',
          price: 119,
          priceDisplay: '$119',
        },
        {
          slug: 'mentoring-pack',
          label: '10-class pack',
          sub: 'Save $120 · $107/hr',
          price: 1070,
          priceDisplay: '$1,070',
        },
      ],
    },
  };

  const SUCCESS_MESSAGES = {
    digital: "We've received your payment. Access will be shared to your email via Google Drive within a few hours.",
    'essay-marking': "Payment confirmed. Use the button below to upload your essay — it takes about 30 seconds.",
    'essay-pack-10': 'Your 10-essay pack is confirmed. Email your essays whenever you are ready using the address below.',
    mentoring: "We've received your payment. Check your email for a booking link to schedule your first session.",
    cohort: "We've received your payment. You'll receive an email shortly with everything you need to get started.",
  };

  const SUCCESS_STATES = {
    verifying: {
      icon: '…',
      heading: 'Checking payment',
      message: 'We are verifying your payment with Stripe now.',
    },
    succeeded: {
      icon: '✓',
      heading: 'Payment confirmed',
    },
    processing: {
      icon: '…',
      heading: 'Payment processing',
      message: 'Your payment is still processing. We will email you as soon as it is confirmed.',
    },
    failed: {
      icon: '!',
      heading: 'Payment not confirmed',
      message: 'We could not verify this payment. Please check your email or contact us before trying again.',
    },
  };

  function fmtPrice(value) {
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
  }

  function getPayButtonLabel(price) {
    return `Pay $${fmtPrice(price)} AUD →`;
  }

  function getProductFromSearch(search) {
    const params = new URLSearchParams(search || '');
    const slug = params.get('product');
    return PRODUCTS[slug] || null;
  }

  function getInitialSelection(pageSlug, product) {
    if (product && product.hasPkgSelector) {
      const defaultIndex = 1;
      const selectedPackage = product.packages[defaultIndex];

      return {
        pageSlug,
        apiSlug: selectedPackage.slug,
        price: selectedPackage.price,
        packageIndex: defaultIndex,
      };
    }

    return {
      pageSlug,
      apiSlug: pageSlug,
      price: product.price,
      packageIndex: null,
    };
  }

  function getSuccessMessage(productSlug) {
    const product = PRODUCTS[productSlug];
    const successType = product ? product.successType : 'cohort';
    return SUCCESS_MESSAGES[successType] || SUCCESS_MESSAGES.cohort;
  }

  function buildSuccessUrl(selection, paymentIntentId) {
    const params = new URLSearchParams({ product: selection.pageSlug });

    if (paymentIntentId) params.set('payment_intent', paymentIntentId);

    return `/checkout/success?${params.toString()}`;
  }

  function getSuccessState(status, productSlug) {
    if (status === 'succeeded') {
      return {
        ...SUCCESS_STATES.succeeded,
        message: getSuccessMessage(productSlug),
      };
    }

    if (status === 'processing') {
      return SUCCESS_STATES.processing;
    }

    return SUCCESS_STATES.failed;
  }

  function getApiServerErrorMessage(responseText) {
    const trimmed = (responseText || '').trim();
    const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<');

    if (isHtml) {
      return 'Checkout API not found on this server. Run the checkout via Vercel dev at http://127.0.0.1:3000/checkout/?product=...';
    }

    return 'Payment setup failed. Please try again.';
  }

  async function parseApiResponse(response) {
    const responseText = await response.text();

    try {
      return {
        ok: response.ok,
        data: JSON.parse(responseText),
      };
    } catch (error) {
      return {
        ok: false,
        data: {
          error: getApiServerErrorMessage(responseText),
        },
      };
    }
  }

  async function fetchPaymentIntentStatus(paymentIntentId) {
    const response = await global.fetch(
      `/api/payment-intent-status?payment_intent=${encodeURIComponent(paymentIntentId)}`
    );
    const result = await parseApiResponse(response);

    if (!result.ok || !result.data.status) {
      throw new Error(result.data.error || 'We could not verify this payment.');
    }

    return result.data.status;
  }

  async function fetchCheckoutConfig() {
    const response = await global.fetch('/api/public-config');
    const result = await parseApiResponse(response);

    if (!result.ok || !result.data.stripePublishableKey) {
      throw new Error(result.data.error || 'Checkout configuration is unavailable.');
    }

    return result.data;
  }

  function loadCheckoutConfig() {
    if (!checkoutConfigPromise) {
      checkoutConfigPromise = fetchCheckoutConfig();
    }

    return checkoutConfigPromise;
  }

  function renderSummaryMarkup(product, selection) {
    if (product.hasPkgSelector) {
      return `
        <div class="summary-badge">Your order</div>
        <h2 class="summary-name">${product.name}</h2>
        <p class="summary-tagline">${product.tagline}</p>
        <hr class="summary-divider">
        <p class="summary-features-label">Choose your package</p>
        <fieldset class="pkg-selector" id="pkg-selector" role="radiogroup" aria-label="Private mentoring package">
          <legend class="pkg-selector-legend">Private mentoring package</legend>
          ${product.packages.map((pkg, index) => `
            <label class="pkg-option${selection.packageIndex === index ? ' pkg-option--active' : ''}" data-index="${index}">
              <input
                class="pkg-option-input"
                type="radio"
                name="mentoring-package"
                value="${pkg.slug}"
                ${selection.packageIndex === index ? 'checked' : ''}
              >
              <span class="pkg-radio" aria-hidden="true"></span>
              <span class="pkg-details">
                <strong>${pkg.label}</strong>
                <span>${pkg.sub}</span>
              </span>
              <span class="pkg-price">${pkg.priceDisplay}</span>
            </label>
          `).join('')}
        </fieldset>
        <hr class="summary-divider">
        <div class="summary-total-row">
          <span>Total due today</span>
          <span id="summary-total">$${fmtPrice(selection.price)} AUD</span>
        </div>
        <p class="summary-note">Booking link sent to your email after payment</p>
      `;
    }

    return `
      <div class="summary-badge">Your order</div>
      <h2 class="summary-name">${product.name}</h2>
      <p class="summary-tagline">${product.tagline}</p>
      <div class="summary-price">$${fmtPrice(product.price)} <small>AUD</small></div>
      <hr class="summary-divider">
      <p class="summary-features-label">What's included</p>
      <ul class="summary-features">
        ${product.features.map((feature) => `<li>${feature}</li>`).join('')}
      </ul>
      <hr class="summary-divider">
      <div class="summary-total-row">
        <span>Total due today</span>
        <span id="summary-total">$${fmtPrice(selection.price)} AUD</span>
      </div>
    `;
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function showCardError(message) {
    const errorEl = qs('#card-error');
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.hidden = false;
    if (typeof errorEl.scrollIntoView === 'function') {
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (typeof errorEl.focus === 'function') {
      errorEl.focus();
    }
  }

  function clearCardError() {
    const errorEl = qs('#card-error');
    if (!errorEl) return;

    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function setPayButtonReady(price, isReady) {
    const button = qs('#pay-btn');
    const label = qs('#pay-btn-label');

    if (button) button.disabled = !isReady;
    if (label) label.textContent = isReady ? getPayButtonLabel(price) : '';
  }

  function setLoading(isLoading, price) {
    const button = qs('#pay-btn');
    const label = qs('#pay-btn-label');

    if (button) button.disabled = isLoading;
    if (label) {
      label.textContent = isLoading ? 'Processing...' : getPayButtonLabel(price);
    }
  }

  function renderSummary(product, selection) {
    const container = qs('#checkout-summary');
    if (!container) return;

    container.innerHTML = renderSummaryMarkup(product, selection);
  }

  function syncSelectionUI(selection) {
    const totalEl = qs('#summary-total');

    if (totalEl) totalEl.textContent = `$${fmtPrice(selection.price)} AUD`;

    document.querySelectorAll('.pkg-option').forEach((option, index) => {
      option.classList.toggle('pkg-option--active', index === selection.packageIndex);
      option.setAttribute('aria-checked', String(index === selection.packageIndex));
      const input = option.querySelector('.pkg-option-input');
      if (input) input.checked = index === selection.packageIndex;
    });
  }

  function setupPackageSelector(product, selection) {
    const selector = qs('#pkg-selector');
    if (!selector) return;

    selector.addEventListener('change', (event) => {
      const input = event.target.closest('.pkg-option-input');
      if (!input) return;

      const option = input.closest('.pkg-option');
      const packageIndex = Number(option.dataset.index);
      if (Number.isNaN(packageIndex) || packageIndex === selection.packageIndex) return;

      const nextPackage = product.packages[packageIndex];
      selection.apiSlug = nextPackage.slug;
      selection.price = nextPackage.price;
      selection.packageIndex = packageIndex;

      syncSelectionUI(selection);
    });
  }

  function attachInstalmentLink(product) {
    if (!product.instalment) return;

    const link = qs('#instalment-link');
    if (!link) return;

    link.href = product.instalment.url;
    link.textContent = product.instalment.label;
    link.hidden = false;
  }

  function maybeShowGmailNote(product) {
    if (!product.isDigital) return;

    const note = qs('#gmail-note');
    if (note) note.hidden = false;
  }

  function maybeShowEssayBanner(productSlug) {
    if (productSlug !== 'essay-marking') return;

    const banner = qs('#essay-banner');
    if (banner) banner.hidden = false;
  }

  function validateForm() {
    const firstNameInput = qs('#first-name');
    const lastNameInput = qs('#last-name');
    const emailInput = qs('#email');
    const addressInput = qs('#billing-address');

    const firstName = firstNameInput?.value.trim() || '';
    const lastName = lastNameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const address = addressInput?.value.trim() || '';

    if (!firstName || !lastName || !email || !address) {
      return { ok: false, error: 'Please fill in all fields.' };
    }

    if (!emailInput?.checkValidity() || !EMAIL_PATTERN.test(email)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }

    return {
      ok: true,
      billingDetails: {
        name: `${firstName} ${lastName}`,
        email,
        address: { line1: address },
      },
    };
  }

  function getCustomerPayload(validation) {
    return {
      email: validation.billingDetails.email,
      customerName: validation.billingDetails.name,
    };
  }

  async function initCheckoutPage() {
    const grid = qs('#checkout-grid');
    const notFound = qs('#checkout-not-found');

    if (!grid || !notFound) return;

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get('product');
    const product = PRODUCTS[productSlug];

    if (!product) {
      notFound.hidden = false;
      return;
    }

    const selection = getInitialSelection(productSlug, product);

    grid.hidden = false;
    document.title = `${product.name} — Checkout | Rohan's GAMSAT`;

    renderSummary(product, selection);
    maybeShowGmailNote(product);
    attachInstalmentLink(product);
    maybeShowEssayBanner(productSlug);

    if (product.hasPkgSelector) {
      setupPackageSelector(product, selection);
      syncSelectionUI(selection);
    } else {
      setPayButtonReady(selection.price, false);
    }

    if (typeof global.Stripe !== 'function') {
      showCardError('Stripe.js failed to load. Please refresh and try again.');
      return;
    }

    let stripePublishableKey = '';
    try {
      const config = await loadCheckoutConfig();
      stripePublishableKey = String(config.stripePublishableKey || '').trim();
    } catch (error) {
      showCardError(error.message || 'Checkout configuration is unavailable.');
      const payButton = qs('#pay-btn');
      if (payButton) payButton.disabled = true;
      return;
    }

    if (!stripePublishableKey || stripePublishableKey.includes('REPLACE_ME')) {
      showCardError('Stripe publishable key is not configured yet.');
      const payButton = qs('#pay-btn');
      if (payButton) payButton.disabled = true;
      return;
    }

    let stripe;
    let cardElement;

    try {
      stripe = global.Stripe(stripePublishableKey);
      const elements = stripe.elements();
      cardElement = elements.create('card', {
        style: {
          base: {
            color: '#C9D5E4',
            fontFamily: '"Figtree", system-ui, sans-serif',
            fontSize: '15px',
            fontSmoothing: 'antialiased',
            '::placeholder': { color: '#6B7280' },
          },
          invalid: {
            color: '#ff6b6b',
          },
        },
      });

      cardElement.mount('#card-element');
      cardElement.on('change', (event) => {
        if (event.error) {
          showCardError(event.error.message);
          return;
        }

        clearCardError();
      });
    } catch (error) {
      showCardError('Secure payment failed to load. Please refresh and try again.');
      return;
    }

    setPayButtonReady(selection.price, true);

    const form = qs('#checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const validation = validateForm();
      if (!validation.ok) {
        showCardError(validation.error);
        return;
      }

      setLoading(true, selection.price);

      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: selection.apiSlug,
            ...getCustomerPayload(validation),
          }),
        });

        const resultPayload = await parseApiResponse(response);
        if (!resultPayload.ok) {
          throw new Error(resultPayload.data.error || 'Payment setup failed. Please try again.');
        }

        const result = await stripe.confirmCardPayment(resultPayload.data.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: validation.billingDetails,
          },
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        if (result.paymentIntent?.status !== 'succeeded') {
          throw new Error('Payment was not completed. Please try again.');
        }

        const paymentIntent = result.paymentIntent || null;
        window.location.href = buildSuccessUrl(
          selection,
          paymentIntent?.id
        );
      } catch (error) {
        showCardError(error.message || 'Payment failed. Please try again.');
        setLoading(false, selection.price);
      }
    });
  }

  function renderSuccessAction(productSlug) {
    const actionEl = qs('#success-action');
    if (!actionEl) return;

    const product = PRODUCTS[productSlug];
    if (!product) return;

    if (product.successType === 'essay-pack-10') {
      actionEl.innerHTML = `
        <p class="success-email-label">Send your essays to:</p>
        <a href="mailto:essays@rohanstutoring.com" class="success-email-address">essays@rohanstutoring.com</a>
        <p class="success-email-note">Include your name in the subject line. Your pack covers 10 essays.</p>
      `;
      actionEl.hidden = false;
    }
  }

  async function initSuccessPage() {
    const messageEl = qs('#success-message');
    const headingEl = qs('#success-heading');
    const iconEl = qs('#success-icon');

    if (!messageEl || !headingEl || !iconEl) return;

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get('product');
    const paymentIntentId = params.get('payment_intent');

    function renderState(state) {
      iconEl.textContent = state.icon;
      headingEl.textContent = state.heading;
      messageEl.textContent = state.message;
    }

    renderState(SUCCESS_STATES.verifying);

    // Stripe Payment Link redirects don't include a payment_intent param —
    // trust that Stripe's hosted checkout already confirmed payment.
    const isPaymentLinkProduct = productSlug === 'essay-pack-10';

    if (!paymentIntentId && isPaymentLinkProduct) {
      renderState(getSuccessState('succeeded', productSlug));
      renderSuccessAction(productSlug);
      return;
    }

    if (!paymentIntentId || typeof global.fetch !== 'function') {
      renderState(SUCCESS_STATES.failed);
      return;
    }

    try {
      const status = await fetchPaymentIntentStatus(paymentIntentId);
      renderState(getSuccessState(status, productSlug));
      if (status === 'succeeded') renderSuccessAction(productSlug);
    } catch (error) {
      renderState(SUCCESS_STATES.failed);
    }
  }

  const exported = {
    MASTERY_INSTALMENT_URL,
    EMAIL_PATTERN,
    PRODUCTS,
    fmtPrice,
    getPayButtonLabel,
    getProductFromSearch,
    getInitialSelection,
    getSuccessMessage,
    buildSuccessUrl,
    getSuccessState,
    getApiServerErrorMessage,
    parseApiResponse,
    fetchCheckoutConfig,
    loadCheckoutConfig,
    fetchPaymentIntentStatus,
    getCustomerPayload,
    renderSummaryMarkup,
    initCheckoutPage,
    initSuccessPage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== 'undefined') {
    window.CheckoutPage = exported;
    document.addEventListener('DOMContentLoaded', async () => {
      await initCheckoutPage();
      await initSuccessPage();
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
