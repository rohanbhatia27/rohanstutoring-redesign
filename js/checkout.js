(function (global) {
  const STRIPE_PK = 'pk_live_51N6LQ9H5JsZI731GV0KrV8IGOHBN1IvAieWXgM84ajBeB6plCanyRRWnff01XmrfD9j72p4CRQGhr455rgTIktYm00VmKdY03B';
  const MASTERY_INSTALMENT_URL = 'https://buy.stripe.com/cNi8wP53m5o69Wt7MoeEo0o';

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
    'essay-marking': "We've received your payment. Send your essay to essays@rohanstutoring.com and you'll receive detailed feedback within 3 days.",
    mentoring: "We've received your payment. Check your email for a booking link to schedule your first session.",
    cohort: "We've received your payment. You'll receive an email shortly with everything you need to get started.",
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

  function renderSummaryMarkup(product, selection) {
    if (product.hasPkgSelector) {
      return `
        <div class="summary-badge">Your order</div>
        <h2 class="summary-name">${product.name}</h2>
        <p class="summary-tagline">${product.tagline}</p>
        <hr class="summary-divider">
        <p class="summary-features-label">Choose your package</p>
        <div class="pkg-selector" id="pkg-selector">
          ${product.packages.map((pkg, index) => `
            <div class="pkg-option${selection.packageIndex === index ? ' pkg-option--active' : ''}" data-index="${index}">
              <span class="pkg-radio" aria-hidden="true"></span>
              <span class="pkg-details">
                <strong>${pkg.label}</strong>
                <span>${pkg.sub}</span>
              </span>
              <span class="pkg-price">${pkg.priceDisplay}</span>
            </div>
          `).join('')}
        </div>
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
    const payLabel = qs('#pay-btn-label');

    if (totalEl) totalEl.textContent = `$${fmtPrice(selection.price)} AUD`;
    if (payLabel) payLabel.textContent = getPayButtonLabel(selection.price);

    document.querySelectorAll('.pkg-option').forEach((option, index) => {
      option.classList.toggle('pkg-option--active', index === selection.packageIndex);
    });
  }

  function setupPackageSelector(product, selection) {
    const selector = qs('#pkg-selector');
    if (!selector) return;

    selector.addEventListener('click', (event) => {
      const option = event.target.closest('.pkg-option');
      if (!option) return;

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

  function validateForm() {
    const firstName = qs('#first-name')?.value.trim() || '';
    const lastName = qs('#last-name')?.value.trim() || '';
    const email = qs('#email')?.value.trim() || '';
    const address = qs('#billing-address')?.value.trim() || '';

    if (!firstName || !lastName || !email || !address) {
      return { ok: false, error: 'Please fill in all fields.' };
    }

    if (!email.includes('@') || !email.includes('.')) {
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

  function initCheckoutPage() {
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

    if (product.hasPkgSelector) {
      setupPackageSelector(product, selection);
      syncSelectionUI(selection);
    } else {
      const payLabel = qs('#pay-btn-label');
      if (payLabel) payLabel.textContent = getPayButtonLabel(selection.price);
    }

    if (!STRIPE_PK || STRIPE_PK.includes('REPLACE_ME')) {
      showCardError('Stripe publishable key is not configured yet.');
      const payButton = qs('#pay-btn');
      if (payButton) payButton.disabled = true;
      return;
    }

    if (typeof global.Stripe !== 'function') {
      showCardError('Stripe.js failed to load. Please refresh and try again.');
      return;
    }

    const stripe = global.Stripe(STRIPE_PK);
    const elements = stripe.elements();
    const cardElement = elements.create('card', {
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
      const errorEl = qs('#card-error');
      if (!errorEl) return;

      if (event.error) {
        errorEl.textContent = event.error.message;
        errorEl.hidden = false;
        return;
      }

      errorEl.hidden = true;
      errorEl.textContent = '';
    });

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
          body: JSON.stringify({ slug: selection.apiSlug }),
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
          return_url: `${window.location.origin}/checkout/success.html?product=${selection.pageSlug}`,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        window.location.href = `/checkout/success.html?product=${selection.pageSlug}`;
      } catch (error) {
        showCardError(error.message || 'Payment failed. Please try again.');
        setLoading(false, selection.price);
      }
    });
  }

  const exported = {
    STRIPE_PK,
    MASTERY_INSTALMENT_URL,
    PRODUCTS,
    fmtPrice,
    getPayButtonLabel,
    getProductFromSearch,
    getInitialSelection,
    getSuccessMessage,
    getApiServerErrorMessage,
    parseApiResponse,
    renderSummaryMarkup,
    initCheckoutPage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== 'undefined') {
    window.CheckoutPage = exported;
    document.addEventListener('DOMContentLoaded', initCheckoutPage);
  }
})(typeof window !== 'undefined' ? window : globalThis);
